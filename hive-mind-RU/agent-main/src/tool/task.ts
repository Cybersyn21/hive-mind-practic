// Инструмент для делегирования задач специализированным подагентам
// Позволяет запустить отдельный агент для выполнения определенной задачи в новой сессии
import { Tool } from "./tool"
import DESCRIPTION from "./task.txt"
import z from "zod"
import { Session } from "../session"
import { Bus } from "../bus"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Agent } from "../agent/agent"
import { SessionPrompt } from "../session/prompt"
import { iife } from "../util/iife"
import { defer } from "../util/defer"

// Определение инструмента для создания и управления задачами подагентов
export const TaskTool = Tool.define("task", async () => {
  // Получение списка всех доступных подагентов (исключая основной агент)
  const agents = await Agent.list().then((x) => x.filter((a) => a.mode !== "primary"))
  // Динамическое формирование описания с актуальным списком доступных подагентов
  const description = DESCRIPTION.replace(
    "{agents}",
    agents
      .map((a) => `- ${a.name}: ${a.description ?? "This subagent should only be called manually by the user."}`)
      .join("\n"),
  )
  return {
    description,
    // Определение параметров инструмента с использованием Zod для валидации
    parameters: z.object({
      description: z.string().describe("A short (3-5 words) description of the task"),
      prompt: z.string().describe("The task for the agent to perform"),
      subagent_type: z.string().describe("The type of specialized agent to use for this task"),
      session_id: z.string().describe("Existing Task session to continue").optional(),
    }),
    // Основная функция выполнения задачи подагентом
    async execute(params, ctx) {
      // Получение экземпляра подагента по типу
      const agent = await Agent.get(params.subagent_type)
      if (!agent) throw new Error(`Unknown agent type: ${params.subagent_type} is not a valid agent type`)

      // Создание или получение существующей сессии для задачи
      // Использует IIFE (Immediately Invoked Function Expression) для логики выбора сессии
      const session = await iife(async () => {
        if (params.session_id) {
          // Попытка найти существующую сессию по ID
          const found = await Session.get(params.session_id).catch(() => {})
          if (found) return found
        }

        // Создание новой сессии для задачи с ссылкой на родительскую сессию
        return await Session.create({
          parentID: ctx.sessionID, // Сохранение связи с родительской сессией
          title: params.description + ` (@${agent.name} subagent)`, // Название сессии с информацией о подагенте
        })
      })

      // Попытка получить информацию о модели из родительского сообщения
      // Это позволяет использовать ту же модель, что и родительский агент
      let parentModel: { modelID: string; providerID: string } | undefined
      try {
        const msg = await MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
        if (msg.info.role === "assistant") {
          // Сохранение информации о модели родителя для наследования
          parentModel = {
            modelID: msg.info.modelID,
            providerID: msg.info.providerID,
          }
        }
      } catch (e) {
        // Если родительское сообщение не найдено, будет использована модель агента или по умолчанию
      }

      // Установка метаданных для отслеживания текущего состояния задачи
      ctx.metadata({
        title: params.description,
        metadata: {
          sessionId: session.id, // Связь с сессией подагента
        },
      })

      // Генерирование уникального ID для сообщения подагента
      const messageID = Identifier.ascending("message")
      // Словарь для накопления информации о выполненных инструментах подагентом
      const parts: Record<string, MessageV2.ToolPart> = {}

      // Подписка на события обновления частей сообщений в сессии подагента
      const unsub = Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
        // Фильтрация: только события из сессии подагента
        if (evt.properties.part.sessionID !== session.id) return
        // Фильтрация: исключение самого сообщения подагента
        if (evt.properties.part.messageID === messageID) return
        // Фильтрация: только части, которые являются инструментами
        if (evt.properties.part.type !== "tool") return

        // Добавление инструмента в накопитель
        parts[evt.properties.part.id] = evt.properties.part

        // Обновление метаданных в реальном времени с информацией о выполненных инструментах
        ctx.metadata({
          title: params.description,
          metadata: {
            summary: Object.values(parts).sort((a, b) => a.id?.localeCompare(b.id)), // Сортировка по ID
            sessionId: session.id,
          },
        })
      })

      // Выбор модели: приоритет - модель агента, затем модель родителя, затем по умолчанию
      const model = agent.model ?? parentModel ?? {
        modelID: "grok-code",
        providerID: "opencode",
      }

      // Функция для отмены выполнения задачи при получении сигнала отмены
      function cancel() {
        SessionPrompt.cancel(session.id)
      }

      // Регистрация обработчика для отмены при получении сигнала из контекста
      ctx.abort.addEventListener("abort", cancel)
      // Гарантированное удаление обработчика после завершения
      using _ = defer(() => ctx.abort.removeEventListener("abort", cancel))

      // Разрешение частей prompt (например, переменные, скрытые инструкции)
      const promptParts = await SessionPrompt.resolvePromptParts(params.prompt)

      // Запуск выполнения задачи подагентом
      const result = await SessionPrompt.prompt({
        messageID, // ID сообщения подагента
        sessionID: session.id, // ID сессии подагента
        model: {
          modelID: model.modelID,
          providerID: model.providerID,
        },
        agent: agent.name, // Название подагента
        tools: {
          // Отключение определенных инструментов для подагентов
          todowrite: false, // Подагенты не могут создавать задачи
          todoread: false,
          task: false, // Запрещение вложенных вызовов task инструмента
          ...agent.tools, // Использование инструментов, разрешенных для этого агента
        },
        parts: promptParts, // Части prompt для выполнения
      })

      // Отписка от событий обновления
      unsub()

      // Сбор всех выполненных инструментов из сессии подагента
      let all
      // Получение всех сообщений из сессии подагента
      all = await Session.messages({ sessionID: session.id })
      // Фильтрация только сообщений от агента
      all = all.filter((x) => x.info.role === "assistant")
      // Извлечение только частей с инструментами из всех сообщений
      all = all.flatMap((msg) => msg.parts.filter((x: any) => x.type === "tool") as MessageV2.ToolPart[])

      // Получение последнего текстового ответа подагента
      const text = result.parts.findLast((x) => x.type === "text")?.text ?? ""

      // Формирование вывода с метаданными сессии для связи с подзадачей
      const output = text + "\n\n" + ["<task_metadata>", `session_id: ${session.id}`, "</task_metadata>"].join("\n")

      // Возврат результата выполнения задачи с метаданными
      return {
        title: params.description,
        metadata: {
          summary: all, // Список выполненных инструментов
          sessionId: session.id, // ID сессии подагента для отслеживания
        },
        output, // Текстовый результат с метаданными
      }
    },
  }
})
