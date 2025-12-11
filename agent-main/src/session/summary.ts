import { Provider } from "../provider/provider"
import { fn } from "../util/fn"
import z from "zod"
import { Session } from "."
import { generateText, type ModelMessage } from "ai"
import { MessageV2 } from "./message-v2"
import { Identifier } from "../id/id"
import { Snapshot } from "../snapshot"
import { ProviderTransform } from "../provider/transform"
import { SystemPrompt } from "./system"
import { Log } from "../util/log"
import path from "path"
import { Instance } from "../project/instance"
import { Storage } from "../storage/storage"
import { Bus } from "../bus"

// Пространство имен для создания сводок и суммаризации сессий и сообщений
// Генерирует краткие описания, подсчитывает изменения в файлах, создает заголовки
export namespace SessionSummary {
  const log = Log.create({ service: "session.summary" })

  // Основная функция для генерации сводки сессии и сообщения
  // Параллельно суммаризирует всю сессию и конкретное сообщение
  export const summarize = fn(
    z.object({
      sessionID: z.string(),
      messageID: z.string(),
    }),
    async (input) => {
      const all = await Session.messages({ sessionID: input.sessionID })
      // Выполняем суммаризацию сессии и сообщения параллельно
      await Promise.all([
        summarizeSession({ sessionID: input.sessionID, messages: all }),
        summarizeMessage({ messageID: input.messageID, messages: all }),
      ])
    },
  )

  // Суммаризирует всю сессию: подсчитывает статистику изменений в файлах
  // Сохраняет количество добавленных/удаленных строк и измененных файлов
  async function summarizeSession(input: { sessionID: string; messages: MessageV2.WithParts[] }) {
    // Собираем уникальный набор файлов которые были изменены через патчи
    const files = new Set(
      input.messages
        .flatMap((x) => x.parts)
        .filter((x) => x.type === "patch")
        .flatMap((x) => x.files)
        .map((x) => path.relative(Instance.worktree, x)),
    )
    // Вычисляем различия для каждого файла
    const diffs = await computeDiff({ messages: input.messages }).then((x) =>
      x.filter((x) => {
        return files.has(x.file)
      }),
    )
    // Обновляем сводку сессии со статистикой изменений
    await Session.update(input.sessionID, (draft) => {
      draft.summary = {
        additions: diffs.reduce((sum, x) => sum + x.additions, 0), // Всего добавлено строк
        deletions: diffs.reduce((sum, x) => sum + x.deletions, 0), // Всего удалено строк
        files: diffs.length, // Количество измененных файлов
      }
    })
    // Сохраняем детальные различия в хранилище
    await Storage.write(["session_diff", input.sessionID], diffs)
    // Публикуем событие с информацией о различиях
    Bus.publish(Session.Event.Diff, {
      sessionID: input.sessionID,
      diff: diffs,
    })
  }

  // Суммаризирует конкретное сообщение: создает заголовок и краткое описание
  // Использует малую языковую модель для генерации краткого содержания
  async function summarizeMessage(input: { messageID: string; messages: MessageV2.WithParts[] }) {
    // Отбираем сообщения пользователя и соответствующие ответы ассистента
    const messages = input.messages.filter(
      (m) => m.info.id === input.messageID || (m.info.role === "assistant" && m.info.parentID === input.messageID),
    )
    const msgWithParts = messages.find((m) => m.info.id === input.messageID)!
    const userMsg = msgWithParts.info as MessageV2.User
    // Вычисляем различия для этого сообщения
    const diffs = await computeDiff({ messages })
    userMsg.summary = {
      ...userMsg.summary,
      diffs,
    }
    await Session.updateMessage(userMsg)

    const assistantMsg = messages.find((m) => m.info.role === "assistant")!.info as MessageV2.Assistant
    // Получаем малую модель для генерации сводки
    const small = await Provider.getSmallModel(assistantMsg.providerID)
    if (!small) return

    // Генерируем заголовок из текстовой части сообщения если его еще нет
    const textPart = msgWithParts.parts.find((p) => p.type === "text" && !p.synthetic) as MessageV2.TextPart
    if (textPart && !userMsg.summary?.title) {
      const result = await generateText({
        maxOutputTokens: small.info.reasoning ? 1500 : 20,
        providerOptions: ProviderTransform.providerOptions(small.npm, small.providerID, {}),
        messages: [
          ...SystemPrompt.title(small.providerID).map(
            (x): ModelMessage => ({
              role: "system",
              content: x,
            }),
          ),
          {
            role: "user" as const,
            content: `
              The following is the text to summarize:
              <text>
              ${textPart?.text ?? ""}
              </text>
            `,
          },
        ],
        headers: small.info.headers,
        model: small.language,
      })
      log.info("title", { title: result.text })
      userMsg.summary.title = result.text
      await Session.updateMessage(userMsg)
    }

    // Генерируем краткое описание диалога если ассистент завершил работу
    if (
      messages.some(
        (m) =>
          m.info.role === "assistant" && m.parts.some((p) => p.type === "step-finish" && p.reason !== "tool-calls"),
      )
    ) {
      // Извлекаем последний текстовый ответ ассистента
      let summary = messages
        .findLast((m) => m.info.role === "assistant")
        ?.parts.findLast((p) => p.type === "text")?.text
      // Если ответа нет или есть изменения файлов, генерируем сводку через модель
      if (!summary || diffs.length > 0) {
        const result = await generateText({
          model: small.language,
          maxOutputTokens: 100,
          messages: [
            {
              role: "user",
              content: `
            Summarize the following conversation into 2 sentences MAX explaining what the assistant did and why. Do not explain the user's input. Do not speak in the third person about the assistant.
            <conversation>
            ${JSON.stringify(MessageV2.toModelMessage(messages))}
            </conversation>
            `,
            },
          ],
          headers: small.info.headers,
        }).catch(() => {})
        if (result) summary = result.text
      }
      userMsg.summary.body = summary
      log.info("body", { body: summary })
      await Session.updateMessage(userMsg)
    }
  }

  // Получает сохраненные различия для сессии из хранилища
  export const diff = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
    }),
    async (input) => {
      return Storage.read<Snapshot.FileDiff[]>(["session_diff", input.sessionID]).catch(() => [])
    },
  )

  // Вычисляет полные различия между начальным и конечным снимками
  // Находит самый ранний step-start и самый поздний step-finish среди сообщений
  async function computeDiff(input: { messages: MessageV2.WithParts[] }) {
    let from: string | undefined
    let to: string | undefined

    // Сканируем сообщения ассистента для поиска начального и конечного снимков
    // scan assistant messages to find earliest from and latest to
    // snapshot
    for (const item of input.messages) {
      // Находим самый ранний начальный снимок
      if (!from) {
        for (const part of item.parts) {
          if (part.type === "step-start" && part.snapshot) {
            from = part.snapshot
            break
          }
        }
      }

      // Обновляем конечный снимок на самый поздний
      for (const part of item.parts) {
        if (part.type === "step-finish" && part.snapshot) {
          to = part.snapshot
          break
        }
      }
    }

    // Если есть оба снимка, вычисляем полное различие между ними
    if (from && to) return Snapshot.diffFull(from, to)
    return []
  }
}
