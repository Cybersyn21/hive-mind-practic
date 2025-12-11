import z from "zod"
import { Bus } from "../bus"
import { NamedError } from "../util/error"
import { Message } from "./message"
import { APICallError, convertToModelMessages, LoadAPIKeyError, type ModelMessage, type UIMessage } from "ai"
import { Identifier } from "../id/id"
import { Snapshot } from "../snapshot"
import { fn } from "../util/fn"
import { Storage } from "../storage/storage"

// Пространство имен для работы с сообщениями версии 2
// Содержит типы, схемы и функции для управления сообщениями и их частями
// Версия 2 представляет сообщения как информацию + массив частей (parts)
export namespace MessageV2 {
  // Ошибка превышения длины вывода
  export const OutputLengthError = NamedError.create("MessageOutputLengthError", z.object({}))
  // Ошибка прерывания операции
  export const AbortedError = NamedError.create("MessageAbortedError", z.object({ message: z.string() }))
  // Ошибка аутентификации провайдера
  export const AuthError = NamedError.create(
    "ProviderAuthError",
    z.object({
      providerID: z.string(),
      message: z.string(),
    }),
  )
  // Ошибка API вызова
  export const APIError = NamedError.create(
    "APIError",
    z.object({
      message: z.string(),
      statusCode: z.number().optional(),
      isRetryable: z.boolean(),
      responseHeaders: z.record(z.string(), z.string()).optional(),
      responseBody: z.string().optional(),
    }),
  )
  export type APIError = z.infer<typeof APIError.Schema>

  // Базовая схема для всех частей сообщения
  const PartBase = z.object({
    id: z.string(), // Уникальный ID части
    sessionID: z.string(), // ID сессии
    messageID: z.string(), // ID сообщения
  })

  // Часть со снимком состояния
  export const SnapshotPart = PartBase.extend({
    type: z.literal("snapshot"),
    snapshot: z.string(), // ID снимка
  }).meta({
    ref: "SnapshotPart",
  })
  export type SnapshotPart = z.infer<typeof SnapshotPart>

  // Часть с информацией о патче
  export const PatchPart = PartBase.extend({
    type: z.literal("patch"),
    hash: z.string(), // Хэш патча
    files: z.string().array(), // Список затронутых файлов
  }).meta({
    ref: "PatchPart",
  })
  export type PatchPart = z.infer<typeof PatchPart>

  // Текстовая часть сообщения
  export const TextPart = PartBase.extend({
    type: z.literal("text"),
    text: z.string(), // Текст сообщения
    synthetic: z.boolean().optional(), // Флаг синтетического сообщения (сгенерированного системой)
    time: z
      .object({
        start: z.number(), // Время начала
        end: z.number().optional(), // Время окончания
      })
      .optional(),
    metadata: z.record(z.string(), z.any()).optional(), // Метаданные
  }).meta({
    ref: "TextPart",
  })
  export type TextPart = z.infer<typeof TextPart>

  // Часть с рассуждениями модели (reasoning)
  export const ReasoningPart = PartBase.extend({
    type: z.literal("reasoning"),
    text: z.string(), // Текст рассуждений
    metadata: z.record(z.string(), z.any()).optional(), // Метаданные
    time: z.object({
      start: z.number(), // Время начала
      end: z.number().optional(), // Время окончания
    }),
  }).meta({
    ref: "ReasoningPart",
  })
  export type ReasoningPart = z.infer<typeof ReasoningPart>

  const FilePartSourceBase = z.object({
    text: z
      .object({
        value: z.string(),
        start: z.number().int(),
        end: z.number().int(),
      })
      .meta({
        ref: "FilePartSourceText",
      }),
  })

  export const FileSource = FilePartSourceBase.extend({
    type: z.literal("file"),
    path: z.string(),
  }).meta({
    ref: "FileSource",
  })

  export const SymbolSource = FilePartSourceBase.extend({
    type: z.literal("symbol"),
    path: z.string(),
    range: z.object({
      start: z.object({ line: z.number(), character: z.number() }),
      end: z.object({ line: z.number(), character: z.number() }),
    }),
    name: z.string(),
    kind: z.number().int(),
  }).meta({
    ref: "SymbolSource",
  })

  export const FilePartSource = z.discriminatedUnion("type", [FileSource, SymbolSource]).meta({
    ref: "FilePartSource",
  })

  export const FilePart = PartBase.extend({
    type: z.literal("file"),
    mime: z.string(),
    filename: z.string().optional(),
    url: z.string(),
    source: FilePartSource.optional(),
  }).meta({
    ref: "FilePart",
  })
  export type FilePart = z.infer<typeof FilePart>

  export const AgentPart = PartBase.extend({
    type: z.literal("agent"),
    name: z.string(),
    source: z
      .object({
        value: z.string(),
        start: z.number().int(),
        end: z.number().int(),
      })
      .optional(),
  }).meta({
    ref: "AgentPart",
  })
  export type AgentPart = z.infer<typeof AgentPart>

  export const CompactionPart = PartBase.extend({
    type: z.literal("compaction"),
  }).meta({
    ref: "CompactionPart",
  })
  export type CompactionPart = z.infer<typeof CompactionPart>

  export const SubtaskPart = PartBase.extend({
    type: z.literal("subtask"),
    prompt: z.string(),
    description: z.string(),
    agent: z.string(),
  })
  export type SubtaskPart = z.infer<typeof SubtaskPart>

  export const RetryPart = PartBase.extend({
    type: z.literal("retry"),
    attempt: z.number(),
    error: APIError.Schema,
    time: z.object({
      created: z.number(),
    }),
  }).meta({
    ref: "RetryPart",
  })
  export type RetryPart = z.infer<typeof RetryPart>

  export const StepStartPart = PartBase.extend({
    type: z.literal("step-start"),
    snapshot: z.string().optional(),
  }).meta({
    ref: "StepStartPart",
  })
  export type StepStartPart = z.infer<typeof StepStartPart>

  export const StepFinishPart = PartBase.extend({
    type: z.literal("step-finish"),
    reason: z.string(),
    snapshot: z.string().optional(),
    cost: z.number(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
      cache: z.object({
        read: z.number(),
        write: z.number(),
      }),
    }),
  }).meta({
    ref: "StepFinishPart",
  })
  export type StepFinishPart = z.infer<typeof StepFinishPart>

  // Состояние инструмента: ожидание выполнения
  export const ToolStatePending = z
    .object({
      status: z.literal("pending"),
      input: z.record(z.string(), z.any()), // Входные параметры
      raw: z.string(), // Сырой JSON инструмента
    })
    .meta({
      ref: "ToolStatePending",
    })

  export type ToolStatePending = z.infer<typeof ToolStatePending>

  // Состояние инструмента: выполняется
  export const ToolStateRunning = z
    .object({
      status: z.literal("running"),
      input: z.record(z.string(), z.any()), // Входные параметры
      title: z.string().optional(), // Название операции
      metadata: z.record(z.string(), z.any()).optional(), // Метаданные
      time: z.object({
        start: z.number(), // Время начала
      }),
    })
    .meta({
      ref: "ToolStateRunning",
    })
  export type ToolStateRunning = z.infer<typeof ToolStateRunning>

  // Состояние инструмента: выполнено успешно
  export const ToolStateCompleted = z
    .object({
      status: z.literal("completed"),
      input: z.record(z.string(), z.any()), // Входные параметры
      output: z.string(), // Результат выполнения
      title: z.string(), // Название операции
      metadata: z.record(z.string(), z.any()), // Метаданные
      time: z.object({
        start: z.number(), // Время начала
        end: z.number(), // Время окончания
        compacted: z.number().optional(), // Время компактификации (если результат был сжат)
      }),
      attachments: FilePart.array().optional(), // Вложения (файлы)
    })
    .meta({
      ref: "ToolStateCompleted",
    })
  export type ToolStateCompleted = z.infer<typeof ToolStateCompleted>

  // Состояние инструмента: ошибка выполнения
  export const ToolStateError = z
    .object({
      status: z.literal("error"),
      input: z.record(z.string(), z.any()), // Входные параметры
      error: z.string(), // Сообщение об ошибке
      metadata: z.record(z.string(), z.any()).optional(), // Метаданные
      time: z.object({
        start: z.number(), // Время начала
        end: z.number(), // Время окончания
      }),
    })
    .meta({
      ref: "ToolStateError",
    })
  export type ToolStateError = z.infer<typeof ToolStateError>

  // Дискриминированное объединение всех состояний инструмента
  export const ToolState = z
    .discriminatedUnion("status", [ToolStatePending, ToolStateRunning, ToolStateCompleted, ToolStateError])
    .meta({
      ref: "ToolState",
    })

  // Часть сообщения с вызовом инструмента
  export const ToolPart = PartBase.extend({
    type: z.literal("tool"),
    callID: z.string(), // Уникальный ID вызова
    tool: z.string(), // Название инструмента
    state: ToolState, // Текущее состояние выполнения
    metadata: z.record(z.string(), z.any()).optional(), // Метаданные
  }).meta({
    ref: "ToolPart",
  })
  export type ToolPart = z.infer<typeof ToolPart>

  // Базовые поля для всех типов сообщений
  const Base = z.object({
    id: z.string(), // Уникальный ID сообщения
    sessionID: z.string(), // ID сессии
  })

  // Сообщение от пользователя
  export const User = Base.extend({
    role: z.literal("user"),
    time: z.object({
      created: z.number(), // Время создания
    }),
    summary: z
      .object({
        title: z.string().optional(), // Заголовок резюме
        body: z.string().optional(), // Тело резюме
        diffs: Snapshot.FileDiff.array(), // Различия в файлах
      })
      .optional(),
    agent: z.string(), // Используемый агент
    model: z.object({
      providerID: z.string(), // ID провайдера модели
      modelID: z.string(), // ID модели
    }),
    system: z.string().optional(), // Системный промпт
    appendSystem: z.string().optional(), // Дополнительный системный промпт
    tools: z.record(z.string(), z.boolean()).optional(), // Доступные инструменты
  }).meta({
    ref: "UserMessage",
  })
  export type User = z.infer<typeof User>

  // Дискриминированное объединение всех типов частей сообщения
  export const Part = z
    .discriminatedUnion("type", [
      TextPart,
      SubtaskPart,
      ReasoningPart,
      FilePart,
      ToolPart,
      StepStartPart,
      StepFinishPart,
      SnapshotPart,
      PatchPart,
      AgentPart,
      RetryPart,
      CompactionPart,
    ])
    .meta({
      ref: "Part",
    })
  export type Part = z.infer<typeof Part>

  // Сообщение от ассистента
  export const Assistant = Base.extend({
    role: z.literal("assistant"),
    time: z.object({
      created: z.number(), // Время создания
      completed: z.number().optional(), // Время завершения
    }),
    error: z
      .discriminatedUnion("name", [
        AuthError.Schema,
        NamedError.Unknown.Schema,
        OutputLengthError.Schema,
        AbortedError.Schema,
        APIError.Schema,
      ])
      .optional(), // Ошибка при выполнении
    parentID: z.string(), // ID родительского сообщения
    modelID: z.string(), // ID модели
    providerID: z.string(), // ID провайдера
    mode: z.string(), // Режим работы
    path: z.object({
      cwd: z.string(), // Текущая рабочая директория
      root: z.string(), // Корневая директория проекта
    }),
    summary: z.boolean().optional(), // Флаг сообщения-резюме
    cost: z.number(), // Стоимость запроса
    tokens: z.object({
      input: z.number(), // Входные токены
      output: z.number(), // Выходные токены
      reasoning: z.number(), // Токены рассуждений
      cache: z.object({
        read: z.number(), // Прочитано из кэша
        write: z.number(), // Записано в кэш
      }),
    }),
    finish: z.string().optional(), // Причина завершения
  }).meta({
    ref: "AssistantMessage",
  })
  export type Assistant = z.infer<typeof Assistant>

  // Информация о сообщении (пользователь или ассистент)
  export const Info = z.discriminatedUnion("role", [User, Assistant]).meta({
    ref: "Message",
  })
  export type Info = z.infer<typeof Info>

  // События для сообщений и их частей
  export const Event = {
    // Событие обновления сообщения
    Updated: Bus.event(
      "message.updated",
      z.object({
        info: Info,
      }),
    ),
    // Событие удаления сообщения
    Removed: Bus.event(
      "message.removed",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
      }),
    ),
    // Событие обновления части сообщения
    PartUpdated: Bus.event(
      "message.part.updated",
      z.object({
        part: Part,
        delta: z.string().optional(), // Инкрементальное изменение (для стриминга)
      }),
    ),
    // Событие удаления части сообщения
    PartRemoved: Bus.event(
      "message.part.removed",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
        partID: z.string(),
      }),
    ),
  }

  // Сообщение с его частями
  export const WithParts = z.object({
    info: Info, // Информация о сообщении
    parts: z.array(Part), // Массив частей
  })
  export type WithParts = z.infer<typeof WithParts>

  // Конвертирует сообщение из формата V1 в формат V2
  // Используется для миграции старых данных
  export function fromV1(v1: Message.Info) {
    if (v1.role === "assistant") {
      const info: Assistant = {
        id: v1.id,
        parentID: "",
        sessionID: v1.metadata.sessionID,
        role: "assistant",
        time: {
          created: v1.metadata.time.created,
          completed: v1.metadata.time.completed,
        },
        cost: v1.metadata.assistant!.cost,
        path: v1.metadata.assistant!.path,
        summary: v1.metadata.assistant!.summary,
        tokens: v1.metadata.assistant!.tokens,
        modelID: v1.metadata.assistant!.modelID,
        providerID: v1.metadata.assistant!.providerID,
        mode: "build",
        error: v1.metadata.error,
      }
      const parts = v1.parts.flatMap((part): Part[] => {
        const base = {
          id: Identifier.ascending("part"),
          messageID: v1.id,
          sessionID: v1.metadata.sessionID,
        }
        if (part.type === "text") {
          return [
            {
              ...base,
              type: "text",
              text: part.text,
            },
          ]
        }
        if (part.type === "step-start") {
          return [
            {
              ...base,
              type: "step-start",
            },
          ]
        }
        if (part.type === "tool-invocation") {
          return [
            {
              ...base,
              type: "tool",
              callID: part.toolInvocation.toolCallId,
              tool: part.toolInvocation.toolName,
              state: (() => {
                if (part.toolInvocation.state === "partial-call") {
                  return {
                    status: "pending",
                    input: {},
                    raw: "",
                  }
                }

                const { title, time, ...metadata } = v1.metadata.tool[part.toolInvocation.toolCallId] ?? {}
                if (part.toolInvocation.state === "call") {
                  return {
                    status: "running",
                    input: part.toolInvocation.args,
                    time: {
                      start: time?.start,
                    },
                  }
                }

                if (part.toolInvocation.state === "result") {
                  return {
                    status: "completed",
                    input: part.toolInvocation.args,
                    output: part.toolInvocation.result,
                    title,
                    time,
                    metadata,
                  }
                }
                throw new Error("unknown tool invocation state")
              })(),
            },
          ]
        }
        return []
      })
      return {
        info,
        parts,
      }
    }

    if (v1.role === "user") {
      const info: User = {
        id: v1.id,
        sessionID: v1.metadata.sessionID,
        role: "user",
        time: {
          created: v1.metadata.time.created,
        },
        agent: "build",
        model: {
          providerID: "opencode",
          modelID: "opencode",
        },
      }
      const parts = v1.parts.flatMap((part): Part[] => {
        const base = {
          id: Identifier.ascending("part"),
          messageID: v1.id,
          sessionID: v1.metadata.sessionID,
        }
        if (part.type === "text") {
          return [
            {
              ...base,
              type: "text",
              text: part.text,
            },
          ]
        }
        if (part.type === "file") {
          return [
            {
              ...base,
              type: "file",
              mime: part.mediaType,
              filename: part.filename,
              url: part.url,
            },
          ]
        }
        return []
      })
      return { info, parts }
    }

    throw new Error("unknown message type")
  }

  // Конвертирует сообщения V2 в формат ModelMessage для AI SDK
  // Преобразует структуру сообщений в формат, понятный языковым моделям
  export function toModelMessage(
    input: {
      info: Info
      parts: Part[]
    }[],
  ): ModelMessage[] {
    const result: UIMessage[] = []

    for (const msg of input) {
      if (msg.parts.length === 0) continue

      if (msg.info.role === "user") {
        const userMessage: UIMessage = {
          id: msg.info.id,
          role: "user",
          parts: [],
        }
        result.push(userMessage)
        for (const part of msg.parts) {
          if (part.type === "text")
            userMessage.parts.push({
              type: "text",
              text: part.text,
            })
          // text/plain and directory files are converted into text parts, ignore them
          if (part.type === "file" && part.mime !== "text/plain" && part.mime !== "application/x-directory")
            userMessage.parts.push({
              type: "file",
              url: part.url,
              mediaType: part.mime,
              filename: part.filename,
            })

          if (part.type === "compaction") {
            userMessage.parts.push({
              type: "text",
              text: "What did we do so far?",
            })
          }
          if (part.type === "subtask") {
            userMessage.parts.push({
              type: "text",
              text: "The following tool was executed by the user",
            })
          }
        }
      }

      if (msg.info.role === "assistant") {
        const assistantMessage: UIMessage = {
          id: msg.info.id,
          role: "assistant",
          parts: [],
        }
        result.push(assistantMessage)
        for (const part of msg.parts) {
          if (part.type === "text")
            assistantMessage.parts.push({
              type: "text",
              text: part.text,
              providerMetadata: part.metadata,
            })
          if (part.type === "step-start")
            assistantMessage.parts.push({
              type: "step-start",
            })
          if (part.type === "tool") {
            if (part.state.status === "completed") {
              if (part.state.attachments?.length) {
                result.push({
                  id: Identifier.ascending("message"),
                  role: "user",
                  parts: [
                    {
                      type: "text",
                      text: `Tool ${part.tool} returned an attachment:`,
                    },
                    ...part.state.attachments.map((attachment) => ({
                      type: "file" as const,
                      url: attachment.url,
                      mediaType: attachment.mime,
                      filename: attachment.filename,
                    })),
                  ],
                })
              }
              assistantMessage.parts.push({
                type: ("tool-" + part.tool) as `tool-${string}`,
                state: "output-available",
                toolCallId: part.callID,
                input: part.state.input,
                output: part.state.time.compacted ? "[Old tool result content cleared]" : part.state.output,
                callProviderMetadata: part.metadata,
              })
            }
            if (part.state.status === "error")
              assistantMessage.parts.push({
                type: ("tool-" + part.tool) as `tool-${string}`,
                state: "output-error",
                toolCallId: part.callID,
                input: part.state.input,
                errorText: part.state.error,
                callProviderMetadata: part.metadata,
              })
          }
          if (part.type === "reasoning") {
            assistantMessage.parts.push({
              type: "reasoning",
              text: part.text,
              providerMetadata: part.metadata,
            })
          }
        }
      }
    }

    return convertToModelMessages(result)
  }

  export const stream = fn(Identifier.schema("session"), async function* (sessionID) {
    const list = await Array.fromAsync(await Storage.list(["message", sessionID]))
    for (let i = list.length - 1; i >= 0; i--) {
      yield await get({
        sessionID,
        messageID: list[i][2],
      })
    }
  })

  export const parts = fn(Identifier.schema("message"), async (messageID) => {
    const result = [] as MessageV2.Part[]
    for (const item of await Storage.list(["part", messageID])) {
      const read = await Storage.read<MessageV2.Part>(item)
      result.push(read)
    }
    result.sort((a, b) => (a.id > b.id ? 1 : -1))
    return result
  })

  export const get = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      return {
        info: await Storage.read<MessageV2.Info>(["message", input.sessionID, input.messageID]),
        parts: await parts(input.messageID),
      }
    },
  )

  // Фильтрует сообщения, останавливаясь на первой компактификации
  // Используется для получения релевантной части истории после сжатия
  export async function filterCompacted(stream: AsyncIterable<MessageV2.WithParts>) {
    const result = [] as MessageV2.WithParts[]
    const completed = new Set<string>()
    for await (const msg of stream) {
      result.push(msg)
      if (
        msg.info.role === "user" &&
        completed.has(msg.info.id) &&
        msg.parts.some((part) => part.type === "compaction")
      )
        break
      if (msg.info.role === "assistant" && msg.info.summary && msg.info.finish) completed.add(msg.info.parentID)
    }
    result.reverse()
    return result
  }

  // Конвертирует различные типы ошибок в структурированный формат MessageV2
  // Обрабатывает ошибки прерывания, API, аутентификации и общие ошибки
  export function fromError(e: unknown, ctx: { providerID: string }) {
    switch (true) {
      case e instanceof DOMException && e.name === "AbortError":
        return new MessageV2.AbortedError(
          { message: e.message },
          {
            cause: e,
          },
        ).toObject()
      case MessageV2.OutputLengthError.isInstance(e):
        return e
      case LoadAPIKeyError.isInstance(e):
        return new MessageV2.AuthError(
          {
            providerID: ctx.providerID,
            message: e.message,
          },
          { cause: e },
        ).toObject()
      case APICallError.isInstance(e):
        return new MessageV2.APIError(
          {
            message: e.message,
            statusCode: e.statusCode,
            isRetryable: e.isRetryable,
            responseHeaders: e.responseHeaders,
            responseBody: e.responseBody,
          },
          { cause: e },
        ).toObject()
      case e instanceof Error:
        return new NamedError.Unknown({ message: e.toString() }, { cause: e }).toObject()
      default:
        return new NamedError.Unknown({ message: JSON.stringify(e) }, { cause: e })
    }
  }
}
