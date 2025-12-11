import type { ModelsDev } from "../provider/models"
import { MessageV2 } from "./message-v2"
import { type StreamTextResult, type Tool as AITool, APICallError } from "ai"
import { Log } from "../util/log"
import { Identifier } from "../id/id"
import { Session } from "."
import { Agent } from "../agent/agent"
// Permission system removed - no restrictions
import { Snapshot } from "../snapshot"
import { SessionSummary } from "./summary"
import { Bus } from "../bus"
import { SessionRetry } from "./retry"
import { SessionStatus } from "./status"

// Пространство имен для обработки потока сообщений от AI модели
// Отвечает за обработку различных типов событий: текст, вызовы инструментов, ошибки
export namespace SessionProcessor {
  // Пороговое значение для обнаружения зацикливания (одна и та же ошибка инструмента 3 раза подряд)
  const DOOM_LOOP_THRESHOLD = 3
  const log = Log.create({ service: "session.processor" })

  export type Info = Awaited<ReturnType<typeof create>>
  export type Result = Awaited<ReturnType<Info["process"]>>

  // Создает обработчик потока сообщений от AI модели
  // Отслеживает вызовы инструментов, управляет состоянием процесса выполнения
  export function create(input: {
    assistantMessage: MessageV2.Assistant
    sessionID: string
    providerID: string
    model: ModelsDev.Model
    abort: AbortSignal
  }) {
    // Кэш для хранения информации о вызовах инструментов по ID
    const toolcalls: Record<string, MessageV2.ToolPart> = {}
    let snapshot: string | undefined
    let blocked = false
    let attempt = 0

    const result = {
      get message() {
        return input.assistantMessage
      },
      partFromToolCall(toolCallID: string) {
        return toolcalls[toolCallID]
      },
      // Основной метод обработки потока событий от модели
      // Обрабатывает текст, размышления, вызовы инструментов и результаты
      async process(fn: () => StreamTextResult<Record<string, AITool>, never>) {
        log.info("process")
        while (true) {
          try {
            let currentText: MessageV2.TextPart | undefined
            // Отслеживает текущий процесс размышления по его ID
            let reasoningMap: Record<string, MessageV2.ReasoningPart> = {}
            const stream = fn()

            // Основной цикл обработки событий потока
            for await (const value of stream.fullStream) {
              input.abort.throwIfAborted()
              switch (value.type) {
                // Начало генерации ответа
                case "start":
                  SessionStatus.set(input.sessionID, { type: "busy" })
                  break

                // Начало процесса размышления (thinking)
                case "reasoning-start":
                  if (value.id in reasoningMap) {
                    continue
                  }
                  reasoningMap[value.id] = {
                    id: Identifier.ascending("part"),
                    messageID: input.assistantMessage.id,
                    sessionID: input.assistantMessage.sessionID,
                    type: "reasoning",
                    text: "",
                    time: {
                      start: Date.now(),
                    },
                    metadata: value.providerMetadata,
                  }
                  break

                // Поток текста процесса размышления
                case "reasoning-delta":
                  if (value.id in reasoningMap) {
                    const part = reasoningMap[value.id]
                    part.text += value.text
                    if (value.providerMetadata) part.metadata = value.providerMetadata
                    if (part.text) await Session.updatePart({ part, delta: value.text })
                  }
                  break

                // Завершение процесса размышления
                case "reasoning-end":
                  if (value.id in reasoningMap) {
                    const part = reasoningMap[value.id]
                    part.text = part.text.trimEnd()

                    part.time = {
                      ...part.time,
                      end: Date.now(),
                    }
                    if (value.providerMetadata) part.metadata = value.providerMetadata
                    await Session.updatePart(part)
                    delete reasoningMap[value.id]
                  }
                  break

                // Начало ввода аргументов для инструмента
                case "tool-input-start":
                  const part = await Session.updatePart({
                    id: toolcalls[value.id]?.id ?? Identifier.ascending("part"),
                    messageID: input.assistantMessage.id,
                    sessionID: input.assistantMessage.sessionID,
                    type: "tool",
                    tool: value.toolName,
                    callID: value.id,
                    state: {
                      status: "pending",
                      input: {},
                      raw: "",
                    },
                  })
                  toolcalls[value.id] = part as MessageV2.ToolPart
                  break

                // Обновление аргументов инструмента во время их генерации
                case "tool-input-delta":
                  break

                // Завершение ввода аргументов инструмента
                case "tool-input-end":
                  break

                // Вызов инструмента с полными аргументами
                case "tool-call": {
                  const match = toolcalls[value.toolCallId]
                  if (match) {
                    const part = await Session.updatePart({
                      ...match,
                      tool: value.toolName,
                      state: {
                        status: "running",
                        input: value.input,
                        time: {
                          start: Date.now(),
                        },
                      },
                      metadata: value.providerMetadata,
                    })
                    toolcalls[value.toolCallId] = part as MessageV2.ToolPart

                    // Обнаружение зацикливания - если модель повторяет один и тот же вызов инструмента
                    const parts = await MessageV2.parts(input.assistantMessage.id)
                    const lastThree = parts.slice(-DOOM_LOOP_THRESHOLD)

                    if (
                      lastThree.length === DOOM_LOOP_THRESHOLD &&
                      lastThree.every(
                        (p) =>
                          p.type === "tool" &&
                          p.tool === value.toolName &&
                          p.state.status !== "pending" &&
                          JSON.stringify(p.state.input) === JSON.stringify(value.input),
                      )
                    ) {
                      // Permission system removed - doom loop detection disabled
                    }
                  }
                  break
                }
                // Успешный результат выполнения инструмента
                case "tool-result": {
                  const match = toolcalls[value.toolCallId]
                  if (match && match.state.status === "running") {
                    await Session.updatePart({
                      ...match,
                      state: {
                        status: "completed",
                        input: value.input,
                        output: value.output.output,
                        metadata: value.output.metadata,
                        title: value.output.title,
                        time: {
                          start: match.state.time.start,
                          end: Date.now(),
                        },
                        attachments: value.output.attachments,
                      },
                    })

                    delete toolcalls[value.toolCallId]
                  }
                  break
                }

                // Ошибка при выполнении инструмента
                case "tool-error": {
                  const match = toolcalls[value.toolCallId]
                  if (match && match.state.status === "running") {
                    await Session.updatePart({
                      ...match,
                      state: {
                        status: "error",
                        input: value.input,
                        error: (value.error as any).toString(),
                        metadata: undefined,
                        time: {
                          start: match.state.time.start,
                          end: Date.now(),
                        },
                      },
                    })

                    // Permission system removed
                    delete toolcalls[value.toolCallId]
                  }
                  break
                }
                // Критическая ошибка при обработке потока
                case "error":
                  throw value.error

                // Начало нового шага выполнения (для отслеживания изменений в файловой системе)
                case "start-step":
                  snapshot = await Snapshot.track()
                  await Session.updatePart({
                    id: Identifier.ascending("part"),
                    messageID: input.assistantMessage.id,
                    sessionID: input.sessionID,
                    snapshot,
                    type: "step-start",
                  })
                  break

                // Завершение шага выполнения с информацией об использованных токенах
                case "finish-step":
                  // Вычисляем стоимость и количество использованных токенов
                  const usage = Session.getUsage({
                    model: input.model,
                    usage: value.usage,
                    metadata: value.providerMetadata,
                  })
                  input.assistantMessage.finish = value.finishReason
                  input.assistantMessage.cost += usage.cost
                  input.assistantMessage.tokens = usage.tokens
                  await Session.updatePart({
                    id: Identifier.ascending("part"),
                    reason: value.finishReason,
                    snapshot: await Snapshot.track(),
                    messageID: input.assistantMessage.id,
                    sessionID: input.assistantMessage.sessionID,
                    type: "step-finish",
                    tokens: usage.tokens,
                    cost: usage.cost,
                  })
                  await Session.updateMessage(input.assistantMessage)
                  // Сравниваем снимки до и после шага для обнаружения изменений в файловой системе
                  if (snapshot) {
                    const patch = await Snapshot.patch(snapshot)
                    if (patch.files.length) {
                      await Session.updatePart({
                        id: Identifier.ascending("part"),
                        messageID: input.assistantMessage.id,
                        sessionID: input.sessionID,
                        type: "patch",
                        hash: patch.hash,
                        files: patch.files,
                      })
                    }
                    snapshot = undefined
                  }
                  // Запускаем суммаризацию предыдущего сообщения в фоне
                  SessionSummary.summarize({
                    sessionID: input.sessionID,
                    messageID: input.assistantMessage.parentID,
                  })
                  break

                // Начало текстового ответа
                case "text-start":
                  currentText = {
                    id: Identifier.ascending("part"),
                    messageID: input.assistantMessage.id,
                    sessionID: input.assistantMessage.sessionID,
                    type: "text",
                    text: "",
                    time: {
                      start: Date.now(),
                    },
                    metadata: value.providerMetadata,
                  }
                  break

                // Поток текста ответа
                case "text-delta":
                  if (currentText) {
                    currentText.text += value.text
                    if (value.providerMetadata) currentText.metadata = value.providerMetadata
                    if (currentText.text)
                      await Session.updatePart({
                        part: currentText,
                        delta: value.text,
                      })
                  }
                  break

                // Завершение текстового ответа
                case "text-end":
                  if (currentText) {
                    currentText.text = currentText.text.trimEnd()
                    currentText.time = {
                      start: Date.now(),
                      end: Date.now(),
                    }
                    if (value.providerMetadata) currentText.metadata = value.providerMetadata
                    await Session.updatePart(currentText)
                  }
                  currentText = undefined
                  break

                // Полное завершение генерации ответа
                case "finish":
                  input.assistantMessage.time.completed = Date.now()
                  await Session.updateMessage(input.assistantMessage)
                  break

                // Обработка неожиданных типов событий
                default:
                  log.info("unhandled", {
                    ...value,
                  })
                  continue
              }
            }
          } catch (e) {
            // Обработка ошибок при обработке потока
            log.error("process", {
              error: e,
            })
            const error = MessageV2.fromError(e, { providerID: input.providerID })
            // Если это переходящая ошибка API, пытаемся повторить с экспоненциальной задержкой
            if (error?.name === "APIError" && error.data.isRetryable) {
              attempt++
              const delay = SessionRetry.delay(error, attempt)
              SessionStatus.set(input.sessionID, {
                type: "retry",
                attempt,
                message: error.data.message,
                next: Date.now() + delay,
              })
              await SessionRetry.sleep(delay, input.abort).catch(() => {})
              continue
            }
            // Для невозможных ошибок сохраняем ошибку в сообщение и останавливаемся
            input.assistantMessage.error = error
            Bus.publish(Session.Event.Error, {
              sessionID: input.assistantMessage.sessionID,
              error: input.assistantMessage.error,
            })
          }
          // Отмечаем все незавершенные вызовы инструментов как абортированные
          const p = await MessageV2.parts(input.assistantMessage.id)
          for (const part of p) {
            if (part.type === "tool" && part.state.status !== "completed" && part.state.status !== "error") {
              await Session.updatePart({
                ...part,
                state: {
                  ...part.state,
                  status: "error",
                  error: "Tool execution aborted",
                  time: {
                    start: Date.now(),
                    end: Date.now(),
                  },
                },
              })
            }
          }
          input.assistantMessage.time.completed = Date.now()
          await Session.updateMessage(input.assistantMessage)
          // Возвращаем результат: "stop" если есть ошибка, "continue" если нужно продолжить цикл
          if (blocked) return "stop"
          if (input.assistantMessage.error) return "stop"
          return "continue"
        }
      },
    }
    return result
  }
}
