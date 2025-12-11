import z from "zod"
import { NamedError } from "../util/error"

// Пространство имен для определения типов сообщений в системе
// Содержит Zod-схемы для валидации различных типов сообщений и их компонентов
export namespace Message {
  // Ошибка при превышении максимальной длины вывода сообщения
  export const OutputLengthError = NamedError.create("MessageOutputLengthError", z.object({}))
  // Ошибка аутентификации от провайдера API
  export const AuthError = NamedError.create(
    "ProviderAuthError",
    z.object({
      providerID: z.string(),
      message: z.string(),
    }),
  )

  // Схема для обычного вызова инструмента
  export const ToolCall = z
    .object({
      state: z.literal("call"),
      step: z.number().optional(),
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.custom<Required<unknown>>(),
    })
    .meta({
      ref: "ToolCall",
    })
  export type ToolCall = z.infer<typeof ToolCall>

  // Схема для частичного вызова инструмента (неполные аргументы)
  export const ToolPartialCall = z
    .object({
      state: z.literal("partial-call"),
      step: z.number().optional(),
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.custom<Required<unknown>>(),
    })
    .meta({
      ref: "ToolPartialCall",
    })
  export type ToolPartialCall = z.infer<typeof ToolPartialCall>

  // Схема для результата выполнения инструмента
  export const ToolResult = z
    .object({
      state: z.literal("result"),
      step: z.number().optional(),
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.custom<Required<unknown>>(),
      result: z.string(),
    })
    .meta({
      ref: "ToolResult",
    })
  export type ToolResult = z.infer<typeof ToolResult>

  // Объединение всех типов вызовов инструментов: обычный, частичный и результат
  export const ToolInvocation = z.discriminatedUnion("state", [ToolCall, ToolPartialCall, ToolResult]).meta({
    ref: "ToolInvocation",
  })
  export type ToolInvocation = z.infer<typeof ToolInvocation>

  // Компонент сообщения содержащий обычный текст
  export const TextPart = z
    .object({
      type: z.literal("text"),
      text: z.string(),
    })
    .meta({
      ref: "TextPart",
    })
  export type TextPart = z.infer<typeof TextPart>

  // Компонент сообщения содержащий процесс размышления модели (например, для o1 или гуглевых моделей с thinking)
  export const ReasoningPart = z
    .object({
      type: z.literal("reasoning"),
      text: z.string(),
      providerMetadata: z.record(z.string(), z.any()).optional(),
    })
    .meta({
      ref: "ReasoningPart",
    })
  export type ReasoningPart = z.infer<typeof ReasoningPart>

  // Компонент сообщения содержащий вызов инструмента (tool invocation)
  export const ToolInvocationPart = z
    .object({
      type: z.literal("tool-invocation"),
      toolInvocation: ToolInvocation,
    })
    .meta({
      ref: "ToolInvocationPart",
    })
  export type ToolInvocationPart = z.infer<typeof ToolInvocationPart>

  // Компонент сообщения содержащий ссылку на источник информации
  export const SourceUrlPart = z
    .object({
      type: z.literal("source-url"),
      sourceId: z.string(),
      url: z.string(),
      title: z.string().optional(),
      providerMetadata: z.record(z.string(), z.any()).optional(),
    })
    .meta({
      ref: "SourceUrlPart",
    })
  export type SourceUrlPart = z.infer<typeof SourceUrlPart>

  // Компонент сообщения содержащий файл или изображение
  export const FilePart = z
    .object({
      type: z.literal("file"),
      mediaType: z.string(),
      filename: z.string().optional(),
      url: z.string(),
    })
    .meta({
      ref: "FilePart",
    })
  export type FilePart = z.infer<typeof FilePart>

  // Компонент сообщения отмечающий начало шага выполнения (step-start)
  export const StepStartPart = z
    .object({
      type: z.literal("step-start"),
    })
    .meta({
      ref: "StepStartPart",
    })
  export type StepStartPart = z.infer<typeof StepStartPart>

  // Объединение всех возможных типов компонентов сообщения
  export const MessagePart = z
    .discriminatedUnion("type", [TextPart, ReasoningPart, ToolInvocationPart, SourceUrlPart, FilePart, StepStartPart])
    .meta({
      ref: "MessagePart",
    })
  export type MessagePart = z.infer<typeof MessagePart>

  // Основная схема сообщения содержащая всю информацию о сообщении в сессии
  // Включает метаданные об ошибках, использованных инструментах, информацию об ассистенте и затратах
  export const Info = z
    .object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      parts: z.array(MessagePart),
      metadata: z
        .object({
          time: z.object({
            created: z.number(),
            completed: z.number().optional(),
          }),
          error: z
            .discriminatedUnion("name", [AuthError.Schema, NamedError.Unknown.Schema, OutputLengthError.Schema])
            .optional(),
          sessionID: z.string(),
          // Информация об использованных инструментах и времени их выполнения
          tool: z.record(
            z.string(),
            z
              .object({
                title: z.string(),
                snapshot: z.string().optional(),
                time: z.object({
                  start: z.number(),
                  end: z.number(),
                }),
              })
              .catchall(z.any()),
          ),
          // Информация об ассистенте, модели, затратах на запрос и количестве токенов
          assistant: z
            .object({
              system: z.string().array(),
              modelID: z.string(),
              providerID: z.string(),
              path: z.object({
                cwd: z.string(),
                root: z.string(),
              }),
              cost: z.number(),
              summary: z.boolean().optional(),
              tokens: z.object({
                input: z.number(),
                output: z.number(),
                reasoning: z.number(),
                cache: z.object({
                  read: z.number(),
                  write: z.number(),
                }),
              }),
            })
            .optional(),
          snapshot: z.string().optional(),
        })
        .meta({ ref: "MessageMetadata" }),
    })
    .meta({
      ref: "Message",
    })
  export type Info = z.infer<typeof Info>
}
