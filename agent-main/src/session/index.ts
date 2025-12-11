// Модуль управления сеансами (Session) - управляет сессиями взаимодействия с ИИ
// Включает создание, обновление, удаление сеансов, управление сообщениями и расчет стоимости

import { Decimal } from "decimal.js"
import z from "zod"
import { type LanguageModelUsage, type ProviderMetadata } from "ai"
import { Bus } from "../bus"
import { Config } from "../config/config"
import { Flag } from "../flag/flag"
import { Identifier } from "../id/id"
import type { ModelsDev } from "../provider/models"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"
import { MessageV2 } from "./message-v2"
import { Instance } from "../project/instance"
import { SessionPrompt } from "./prompt"
import { fn } from "../util/fn"
import { Command } from "../command"
import { Snapshot } from "../snapshot"

export namespace Session {
  // Логгер для отслеживания событий сеанса
  const log = Log.create({ service: "session" })

  // Префиксы для названий новых и дочерних сеансов
  const parentTitlePrefix = "New session - "
  const childTitlePrefix = "Child session - "

  // Создает стандартное название сеанса с временной меткой ISO
  function createDefaultTitle(isChild = false) {
    return (isChild ? childTitlePrefix : parentTitlePrefix) + new Date().toISOString()
  }

  // Проверяет, является ли заголовок стандартным (автоматически сгенерированным с временной меткой)
  export function isDefaultTitle(title: string) {
    return new RegExp(
      `^(${parentTitlePrefix}|${childTitlePrefix})\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$`,
    ).test(title)
  }

  // Схема валидации информации о сеансе (Zod)
  // Содержит: ID, ID проекта, директорию, заголовок, версию, временные метки, сводку по изменениям
  export const Info = z
    .object({
      // Уникальный идентификатор сеанса
      id: Identifier.schema("session"),
      // ID проекта, к которому принадлежит сеанс
      projectID: z.string(),
      // Директория проекта
      directory: z.string(),
      // ID родительского сеанса (если это дочерний сеанс)
      parentID: Identifier.schema("session").optional(),
      // Сводка по изменениям файлов (добавления, удаления, количество файлов, дифы)
      summary: z
        .object({
          additions: z.number(),
          deletions: z.number(),
          files: z.number(),
          diffs: Snapshot.FileDiff.array().optional(),
        })
        .optional(),
      // Название сеанса
      title: z.string(),
      // Версия формата данных сеанса
      version: z.string(),
      // Временные метки создания, обновления и компактирования
      time: z.object({
        created: z.number(),
        updated: z.number(),
        compacting: z.number().optional(),
      }),
      // Информация для отката к предыдущему состоянию
      revert: z
        .object({
          messageID: z.string(),
          partID: z.string().optional(),
          snapshot: z.string().optional(),
          diff: z.string().optional(),
        })
        .optional(),
    })
    .meta({
      ref: "Session",
    })
  // Тип информации о сеансе (автоматически выводится из схемы)
  export type Info = z.output<typeof Info>

  // ShareInfo removed - share not supported

  // События сеанса (шина событий для публикации/подписки)
  export const Event = {
    // Событие создания нового сеанса
    Created: Bus.event(
      "session.created",
      z.object({
        info: Info,
      }),
    ),
    // Событие обновления информации сеанса
    Updated: Bus.event(
      "session.updated",
      z.object({
        info: Info,
      }),
    ),
    // Событие удаления сеанса
    Deleted: Bus.event(
      "session.deleted",
      z.object({
        info: Info,
      }),
    ),
    // Событие изменения файлов в сеансе
    Diff: Bus.event(
      "session.diff",
      z.object({
        sessionID: z.string(),
        diff: Snapshot.FileDiff.array(),
      }),
    ),
    // Событие ошибки при обработке сеанса
    Error: Bus.event(
      "session.error",
      z.object({
        sessionID: z.string().optional(),
        error: MessageV2.Assistant.shape.error,
      }),
    ),
  }

  // Создает новый сеанс (основной метод для инициализации)
  export const create = fn(
    z
      .object({
        parentID: Identifier.schema("session").optional(),
        title: z.string().optional(),
      })
      .optional(),
    async (input) => {
      return createNext({
        parentID: input?.parentID,
        directory: Instance.directory,
        title: input?.title,
      })
    },
  )

  // Создает ветвь (fork) от существующего сеанса с копированием сообщений
  // Может скопировать сообщения до определенного messageID
  export const fork = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
    }),
    async (input) => {
      // Создание нового сеанса для ветви
      const session = await createNext({
        directory: Instance.directory,
      })
      // Получение всех сообщений из исходного сеанса
      const msgs = await messages({ sessionID: input.sessionID })
      // Копирование сообщений и их частей в новый сеанс
      for (const msg of msgs) {
        if (input.messageID && msg.info.id >= input.messageID) break
        const cloned = await updateMessage({
          ...msg.info,
          sessionID: session.id,
          id: Identifier.ascending("message"),
        })

        // Копирование всех частей сообщения (текст, рассуждения и т.д.)
        for (const part of msg.parts) {
          await updatePart({
            ...part,
            id: Identifier.ascending("part"),
            messageID: cloned.id,
            sessionID: session.id,
          })
        }
      }
      return session
    },
  )

  // Обновляет время последнего обновления сеанса (для отметки активности)
  export const touch = fn(Identifier.schema("session"), async (sessionID) => {
    await update(sessionID, (draft) => {
      draft.time.updated = Date.now()
    })
  })

  // Внутренняя функция для создания нового сеанса (используется create и fork)
  // Сохраняет информацию в хранилище и публикует события
  export async function createNext(input: { id?: string; title?: string; parentID?: string; directory: string }) {
    // Инициализация информации о новом сеансе
    const result: Info = {
      // Генерация уникального ID сеанса (нисходящий порядок для сортировки)
      id: Identifier.descending("session", input.id),
      // Версия формата данных
      version: "agent-cli-1.0.0",
      // ID текущего проекта
      projectID: Instance.project.id,
      // Директория проекта
      directory: input.directory,
      // ID родительского сеанса (если это дочерний сеанс)
      parentID: input.parentID,
      // Название сеанса или автоматически сгенерированное по умолчанию
      title: input.title ?? createDefaultTitle(!!input.parentID),
      // Временные метки создания и обновления
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    }
    log.info("created", result)
    // Сохранение информации о сеансе в хранилище
    await Storage.write(["session", Instance.project.id, result.id], result)
    // Публикация события создания сеанса
    Bus.publish(Event.Created, {
      info: result,
    })
    // Публикация события обновления сеанса
    Bus.publish(Event.Updated, {
      info: result,
    })
    return result
  }

  // Получает информацию о сеансе по ID
  export const get = fn(Identifier.schema("session"), async (id) => {
    const read = await Storage.read<Info>(["session", Instance.project.id, id])
    return read as Info
  })

  // Обновляет информацию о сеансе с помощью редактора (функции-преобразователя)
  // Автоматически обновляет время последнего изменения и публикует событие
  export async function update(id: string, editor: (session: Info) => void) {
    const project = Instance.project
    // Обновление сеанса в хранилище с использованием функции редактора
    const result = await Storage.update<Info>(["session", project.id, id], (draft) => {
      editor(draft)
      // Обновление временной метки "обновлено"
      draft.time.updated = Date.now()
    })
    // Публикация события об обновлении сеанса
    Bus.publish(Event.Updated, {
      info: result,
    })
    return result
  }

  // Получает различия между файлами в сеансе (снимок изменений)
  export const diff = fn(Identifier.schema("session"), async (sessionID) => {
    const diffs = await Storage.read<Snapshot.FileDiff[]>(["session_diff", sessionID])
    return diffs ?? []
  })

  // Получает все сообщения сеанса с опциональным ограничением по количеству
  // Возвращает сообщения в обратном хронологическом порядке (новые в начале)
  export const messages = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      limit: z.number().optional(),
    }),
    async (input) => {
      const result = [] as MessageV2.WithParts[]
      // Потоковая обработка сообщений для оптимизации памяти
      for await (const msg of MessageV2.stream(input.sessionID)) {
        if (input.limit && result.length >= input.limit) break
        result.push(msg)
      }
      // Разворот массива для получения обратного хронологического порядка
      result.reverse()
      return result
    },
  )

  // Асинхронный генератор для итерации по всем сеансам проекта
  // Позволяет обрабатывать большое количество сеансов без загрузки всех в память
  export async function* list() {
    const project = Instance.project
    // Получение всех элементов сеансов из хранилища и чтение их данных
    for (const item of await Storage.list(["session", project.id])) {
      yield Storage.read<Info>(item)
    }
  }

  // Получает все дочерние сеансы (созданные путем fork) для заданного родительского сеанса
  export const children = fn(Identifier.schema("session"), async (parentID) => {
    const project = Instance.project
    const result = [] as Session.Info[]
    // Поиск всех сеансов с совпадающим parentID
    for (const item of await Storage.list(["session", project.id])) {
      const session = await Storage.read<Info>(item)
      if (session.parentID !== parentID) continue
      result.push(session)
    }
    return result
  })

  // Удаляет сеанс и все его дочерние сеансы, сообщения и части
  // Рекурсивно удаляет иерархию сеансов
  export const remove = fn(Identifier.schema("session"), async (sessionID) => {
    const project = Instance.project
    try {
      const session = await get(sessionID)
      // Рекурсивное удаление всех дочерних сеансов
      for (const child of await children(sessionID)) {
        await remove(child.id)
      }
      // Удаление всех сообщений и их частей
      for (const msg of await Storage.list(["message", sessionID])) {
        // Удаление всех частей сообщения (текст, рассуждения и т.д.)
        for (const part of await Storage.list(["part", msg.at(-1)!])) {
          await Storage.remove(part)
        }
        // Удаление самого сообщения
        await Storage.remove(msg)
      }
      // Удаление информации о сеансе
      await Storage.remove(["session", project.id, sessionID])
      // Публикация события об удалении сеанса
      Bus.publish(Event.Deleted, {
        info: session,
      })
    } catch (e) {
      log.error(e)
    }
  })

  // Обновляет или создает сообщение в сеансе
  // Сохраняет в хранилище и публикует событие обновления
  export const updateMessage = fn(MessageV2.Info, async (msg) => {
    // Сохранение сообщения в хранилище
    await Storage.write(["message", msg.sessionID, msg.id], msg)
    // Публикация события об обновлении сообщения
    Bus.publish(MessageV2.Event.Updated, {
      info: msg,
    })
    return msg
  })

  // Удаляет сообщение из сеанса
  export const removeMessage = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      // Удаление сообщения из хранилища
      await Storage.remove(["message", input.sessionID, input.messageID])
      // Публикация события об удалении сообщения
      Bus.publish(MessageV2.Event.Removed, {
        sessionID: input.sessionID,
        messageID: input.messageID,
      })
      return input.messageID
    },
  )

  // Схема валидации для обновления части сообщения
  // Может быть либо полной частью, либо частью с дельта (инкрементальным обновлением)
  const UpdatePartInput = z.union([
    MessageV2.Part,
    z.object({
      part: MessageV2.TextPart,
      delta: z.string(),
    }),
    z.object({
      part: MessageV2.ReasoningPart,
      delta: z.string(),
    }),
  ])

  // Обновляет или создает часть сообщения (текст, рассуждение и т.д.)
  // Поддерживает инкрементальные обновления (дельта) для потоковых ответов
  export const updatePart = fn(UpdatePartInput, async (input) => {
    // Извлечение части и дельта из входных данных
    const part = "delta" in input ? input.part : input
    const delta = "delta" in input ? input.delta : undefined
    // Сохранение части в хранилище
    await Storage.write(["part", part.messageID, part.id], part)
    // Публикация события об обновлении части
    Bus.publish(MessageV2.Event.PartUpdated, {
      part,
      delta,
    })
    return part
  })

  // Рассчитывает стоимость использования модели на основе использованных токенов
  // Учитывает разные типы токенов (ввод, вывод, рассуждение, кеш)
  // Применяет разные тарифы для больших контекстов (>200K токенов)
  export const getUsage = fn(
    z.object({
      model: z.custom<ModelsDev.Model>(),
      usage: z.custom<LanguageModelUsage>(),
      metadata: z.custom<ProviderMetadata>().optional(),
    }),
    (input) => {
      // Получение количества закешированных входных токенов
      const cachedInputTokens = input.usage.cachedInputTokens ?? 0
      // Проверка, исключает ли провайдер закешированные токены из подсчета
      const excludesCachedTokens = !!(input.metadata?.["anthropic"] || input.metadata?.["bedrock"])
      // Вычисление скорректированного количества входных токенов
      // Если провайдер исключает кеш, не вычитаем кешированные токены
      const adjustedInputTokens = excludesCachedTokens
        ? (input.usage.inputTokens ?? 0)
        : (input.usage.inputTokens ?? 0) - cachedInputTokens

      // Составление объекта с разбивкой по типам токенов
      const tokens = {
        input: adjustedInputTokens,
        output: input.usage.outputTokens ?? 0,
        reasoning: input.usage?.reasoningTokens ?? 0,
        cache: {
          // Токены, записанные в кеш
          write: (input.metadata?.["anthropic"]?.["cacheCreationInputTokens"] ??
            input.metadata?.["bedrock"]?.["usage"]?.["cacheWriteInputTokens"] ??
            0) as number,
          // Токены, прочитанные из кеша
          read: cachedInputTokens,
        },
      }

      // Выбор тарифов: использование специальных тарифов для больших контекстов если контекст > 200K токенов
      const costInfo =
        input.model.cost?.context_over_200k && tokens.input + tokens.cache.read > 200_000
          ? input.model.cost.context_over_200k
          : input.model.cost

      // Расчет общей стоимости с использованием произвольной точности (Decimal)
      return {
        cost: new Decimal(0)
          .add(new Decimal(tokens.input).mul(costInfo?.input ?? 0).div(1_000_000))
          .add(new Decimal(tokens.output).mul(costInfo?.output ?? 0).div(1_000_000))
          .add(new Decimal(tokens.cache.read).mul(costInfo?.cache_read ?? 0).div(1_000_000))
          .add(new Decimal(tokens.cache.write).mul(costInfo?.cache_write ?? 0).div(1_000_000))
          // Токены рассуждения оцениваются как выходные токены
          .add(new Decimal(tokens.reasoning).mul(costInfo?.output ?? 0).div(1_000_000))
          .toNumber(),
        tokens,
      }
    },
  )

  // Ошибка, выбрасываемая когда сеанс занят (обрабатывает одно действие)
  export class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`)
    }
  }

  // Инициализирует сеанс с выбранной моделью ИИ
  // Создает начальное сообщение и устанавливает контекст
  export const initialize = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      modelID: z.string(),
      providerID: z.string(),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      // Выполнение команды инициализации через SessionPrompt
      // Формирует полный путь модели (провайдер/модель)
      await SessionPrompt.command({
        sessionID: input.sessionID,
        messageID: input.messageID,
        model: input.providerID + "/" + input.modelID,
        command: Command.Default.INIT,
        arguments: "",
      })
    },
  )
}
