import path from "path"
import os from "os"
import fs from "fs/promises"
import z from "zod"
import { Identifier } from "../id/id"
import { MessageV2 } from "./message-v2"
import { Log } from "../util/log"
import { SessionRevert } from "./revert"
import { Session } from "."
import { Agent } from "../agent/agent"
import { Provider } from "../provider/provider"
import {
  generateText,
  streamText,
  type ModelMessage,
  type Tool as AITool,
  tool,
  wrapLanguageModel,
  stepCountIs,
  jsonSchema,
} from "ai"
import { SessionCompaction } from "./compaction"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { ProviderTransform } from "../provider/transform"
import { SystemPrompt } from "./system"

import PROMPT_PLAN from "../session/prompt/plan.txt"
import BUILD_SWITCH from "../session/prompt/build-switch.txt"
import { defer } from "../util/defer"
import { mergeDeep, pipe } from "remeda"
import { ToolRegistry } from "../tool/registry"
import { Wildcard } from "../util/wildcard"
import { MCP } from "../mcp"
import { ReadTool } from "../tool/read"
import { ListTool } from "../tool/ls"
import { FileTime } from "../file/time"
import { ulid } from "ulid"
import { spawn } from "child_process"
import { Command } from "../command"
import { $, fileURLToPath } from "bun"
import { ConfigMarkdown } from "../config/markdown"
import { SessionSummary } from "./summary"
import { NamedError } from "../util/error"
import { fn } from "../util/fn"
import { SessionProcessor } from "./processor"
import { TaskTool } from "../tool/task"
import { SessionStatus } from "./status"

// Пространство имен для управления промптами и основным циклом обработки сессии
// Отвечает за создание пользовательских сообщений, обработку команд и управление инструментами
export namespace SessionPrompt {
  const log = Log.create({ service: "session.prompt" })
  // Максимальное количество выходных токенов для одного ответа модели
  export const OUTPUT_TOKEN_MAX = 32_000

  // Управляет состоянием активных сессий: abort контроллер и очередь callback-ов для ожидающих запросов
  const state = Instance.state(
    () => {
      const data: Record<
        string,
        {
          abort: AbortController
          callbacks: {
            resolve(input: MessageV2.WithParts): void
            reject(): void
          }[]
        }
      > = {}
      return data
    },
    async (current) => {
      // При очистке state абортируем все активные сессии
      for (const item of Object.values(current)) {
        item.abort.abort()
      }
    },
  )

  // Проверяет, что сессия не находится в процессе обработки, бросает ошибку если занята
  export function assertNotBusy(sessionID: string) {
    const match = state()[sessionID]
    if (match) throw new Session.BusyError(sessionID)
  }

  // Входная схема для функции prompt
  // Содержит информацию о сессии, модели, агенте и содержимое сообщения
  export const PromptInput = z.object({
    sessionID: Identifier.schema("session"),
    messageID: Identifier.schema("message").optional(),
    model: z
      .object({
        providerID: z.string(),
        modelID: z.string(),
      })
      .optional(),
    agent: z.string().optional(),
    noReply: z.boolean().optional(),
    system: z.string().optional(),
    appendSystem: z.string().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
    parts: z.array(
      z.discriminatedUnion("type", [
        MessageV2.TextPart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "TextPartInput",
          }),
        MessageV2.FilePart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "FilePartInput",
          }),
        MessageV2.AgentPart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "AgentPartInput",
          }),
        MessageV2.SubtaskPart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "SubtaskPartInput",
          }),
      ]),
    ),
  })
  export type PromptInput = z.infer<typeof PromptInput>

  // Преобразует шаблон промпта в массив компонентов сообщения
  // Разрешает файловые ссылки, агентов и обрабатывает разметку
  export async function resolvePromptParts(template: string): Promise<PromptInput["parts"]> {
    const parts: PromptInput["parts"] = [
      {
        type: "text",
        text: template,
      },
    ]
    // Ищет ссылки на файлы в шаблоне (например [./path/to/file])
    const files = ConfigMarkdown.files(template)
    await Promise.all(
      files.map(async (match) => {
        const name = match[1]
        const filepath = name.startsWith("~/")
          ? path.join(os.homedir(), name.slice(2))
          : path.resolve(Instance.worktree, name)

        const stats = await fs.stat(filepath).catch(() => undefined)
        if (!stats) {
          // Пытаемся получить агента с этим именем
          const agent = await Agent.get(name)
          if (agent) {
            parts.push({
              type: "agent",
              name: agent.name,
            })
          }
          return
        }

        // Обрабатываем директории
        if (stats.isDirectory()) {
          parts.push({
            type: "file",
            url: `file://${filepath}`,
            filename: name,
            mime: "application/x-directory",
          })
          return
        }

        // Обрабатываем текстовые файлы
        parts.push({
          type: "file",
          url: `file://${filepath}`,
          filename: name,
          mime: "text/plain",
        })
      }),
    )
    return parts
  }

  // Основная функция для отправки промпта в сессию и получения ответа
  // Создает пользовательское сообщение и запускает основной цикл обработки
  export const prompt = fn(PromptInput, async (input) => {
    const session = await Session.get(input.sessionID)
    await SessionRevert.cleanup(session)

    // Создаем пользовательское сообщение с частями (текст, файлы, агенты)
    const message = await createUserMessage(input)
    await Session.touch(input.sessionID)

    // Если noReply=true, просто возвращаем сообщение без запуска ответа
    if (input.noReply) {
      return message
    }

    // Иначе запускаем основной цикл обработки для получения ответа
    return loop(input.sessionID)
  })

  // Инициализирует новую сессию с abort контроллером
  function start(sessionID: string) {
    const s = state()
    if (s[sessionID]) return
    const controller = new AbortController()
    s[sessionID] = {
      abort: controller,
      callbacks: [],
    }
    return controller.signal
  }

  // Отменяет обработку сессии и отклоняет все ожидающие callback-и
  export function cancel(sessionID: string) {
    log.info("cancel", { sessionID })
    const s = state()
    const match = s[sessionID]
    if (!match) return
    match.abort.abort()
    for (const item of match.callbacks) {
      item.reject()
    }
    delete s[sessionID]
    SessionStatus.set(sessionID, { type: "idle" })
    return
  }

  // Основной цикл обработки: читает сообщения, генерирует ответы, обрабатывает инструменты
  // Продолжает работать пока не получит финальный ответ от модели
  export const loop = fn(Identifier.schema("session"), async (sessionID) => {
    const abort = start(sessionID)
    if (!abort) {
      // Если сессия уже в процессе, ждем результата через callback
      return new Promise<MessageV2.WithParts>((resolve, reject) => {
        const callbacks = state()[sessionID].callbacks
        callbacks.push({ resolve, reject })
      })
    }

    // Гарантируем отмену сессии при выходе из функции
    using _ = defer(() => cancel(sessionID))

    let step = 0
    while (true) {
      log.info("loop", { step, sessionID })
      if (abort.aborted) break
      // Получаем все сообщения сессии с фильтрацией сжатых сообщений
      let msgs = await MessageV2.filterCompacted(MessageV2.stream(sessionID))

      // Ищем последние пользовательское и ассистентское сообщения
      let lastUser: MessageV2.User | undefined
      let lastAssistant: MessageV2.Assistant | undefined
      let lastFinished: MessageV2.Assistant | undefined
      let tasks: (MessageV2.CompactionPart | MessageV2.SubtaskPart)[] = []
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i]
        if (!lastUser && msg.info.role === "user") lastUser = msg.info as MessageV2.User
        if (!lastAssistant && msg.info.role === "assistant") lastAssistant = msg.info as MessageV2.Assistant
        // Ищем последний завершенный ответ ассистента (есть finish reason)
        if (!lastFinished && msg.info.role === "assistant" && msg.info.finish)
          lastFinished = msg.info as MessageV2.Assistant
        if (lastUser && lastFinished) break
        // Собираем задачи для компактирования или подзадач
        const task = msg.parts.filter((part) => part.type === "compaction" || part.type === "subtask")
        if (task && !lastFinished) {
          tasks.push(...task)
        }
      }

      if (!lastUser) throw new Error("No user message found in stream. This should never happen.")
      // Выходим из цикла если уже есть финальный ответ и нет инструментов к вызову
      if (lastAssistant?.finish && lastAssistant.finish !== "tool-calls" && lastUser.id < lastAssistant.id) {
        log.info("exiting loop", { sessionID })
        break
      }

      step++
      // При первом шаге генерируем заголовок сессии
      if (step === 1)
        ensureTitle({
          session: await Session.get(sessionID),
          modelID: lastUser.model.modelID,
          providerID: lastUser.model.providerID,
          message: msgs.find((m) => m.info.role === "user")!,
          history: msgs,
        })

      const model = await Provider.getModel(lastUser.model.providerID, lastUser.model.modelID)
      const task = tasks.pop()

      // Обработка подзадачи (subtask) - запуск вложенного агента
      if (task?.type === "subtask") {
        const taskTool = await TaskTool.init()
        // Создаем сообщение ассистента для подзадачи
        const assistantMessage = (await Session.updateMessage({
          id: Identifier.ascending("message"),
          role: "assistant",
          parentID: lastUser.id,
          sessionID,
          mode: task.agent,
          path: {
            cwd: Instance.directory,
            root: Instance.worktree,
          },
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          modelID: model.modelID,
          providerID: model.providerID,
          time: {
            created: Date.now(),
          },
        })) as MessageV2.Assistant
        // Создаем часть для отслеживания выполнения инструмента
        let part = (await Session.updatePart({
          id: Identifier.ascending("part"),
          messageID: assistantMessage.id,
          sessionID: assistantMessage.sessionID,
          type: "tool",
          callID: ulid(),
          tool: TaskTool.id,
          state: {
            status: "running",
            input: {
              prompt: task.prompt,
              description: task.description,
              subagent_type: task.agent,
            },
            time: {
              start: Date.now(),
            },
          },
        })) as MessageV2.ToolPart
        // Выполняем подзадачу
        const result = await taskTool
          .execute(
            {
              prompt: task.prompt,
              description: task.description,
              subagent_type: task.agent,
            },
            {
              agent: task.agent,
              messageID: assistantMessage.id,
              sessionID: sessionID,
              abort,
              async metadata(input) {
                await Session.updatePart({
                  ...part,
                  type: "tool",
                  state: {
                    ...part.state,
                    ...input,
                  },
                } satisfies MessageV2.ToolPart)
              },
            },
          )
          .catch(() => {})
        assistantMessage.finish = "tool-calls"
        assistantMessage.time.completed = Date.now()
        await Session.updateMessage(assistantMessage)
        // Обновляем результат подзадачи
        if (result && part.state.status === "running") {
          await Session.updatePart({
            ...part,
            state: {
              status: "completed",
              input: part.state.input,
              title: result.title,
              metadata: result.metadata,
              output: result.output,
              attachments: result.attachments,
              time: {
                ...part.state.time,
                end: Date.now(),
              },
            },
          } satisfies MessageV2.ToolPart)
        }
        // Обработка ошибки подзадачи
        if (!result) {
          await Session.updatePart({
            ...part,
            state: {
              status: "error",
              error: "Tool execution failed",
              time: {
                start: part.state.status === "running" ? part.state.time.start : Date.now(),
                end: Date.now(),
              },
              metadata: part.metadata,
              input: part.state.input,
            },
          } satisfies MessageV2.ToolPart)
        }
        continue
      }

      // Обработка запроса на компактирование (сжатие истории сообщений)
      if (task?.type === "compaction") {
        const result = await SessionCompaction.process({
          messages: msgs,
          parentID: lastUser.id,
          abort,
          model: {
            providerID: model.providerID,
            modelID: model.modelID,
          },
          sessionID,
        })
        if (result === "stop") break
        continue
      }

      // Проверка переполнения контекста - нужно ли сжимать историю
      if (
        lastFinished &&
        lastFinished.summary !== true &&
        SessionCompaction.isOverflow({ tokens: lastFinished.tokens, model: model.info })
      ) {
        await SessionCompaction.create({
          sessionID,
          model: lastUser.model,
        })
        continue
      }

      // Обычная обработка - генерирование ответа от ассистента
      const agent = await Agent.get(lastUser.agent)
      // Добавляем напоминания для модели в зависимости от типа агента
      msgs = insertReminders({
        messages: msgs,
        agent,
      })
      // Создаем процессор для обработки потока событий от модели
      const processor = SessionProcessor.create({
        assistantMessage: (await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: lastUser.id,
          role: "assistant",
          mode: agent.name,
          path: {
            cwd: Instance.directory,
            root: Instance.worktree,
          },
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          modelID: model.modelID,
          providerID: model.providerID,
          time: {
            created: Date.now(),
          },
          sessionID,
        })) as MessageV2.Assistant,
        sessionID: sessionID,
        model: model.info,
        providerID: model.providerID,
        abort,
      })
      // Собираем системный промпт из разных источников
      const system = await resolveSystemPrompt({
        providerID: model.providerID,
        modelID: model.info.id,
        agent,
        system: lastUser.system,
        appendSystem: lastUser.appendSystem,
      })
      // Подготавливаем доступные инструменты для модели
      const tools = await resolveTools({
        agent,
        sessionID,
        model: lastUser.model,
        tools: lastUser.tools,
        processor,
      })
      // Параметры генерирования: температура, topP, дополнительные опции
      const params = {
        temperature: model.info.temperature
          ? (agent.temperature ?? ProviderTransform.temperature(model.providerID, model.modelID))
          : undefined,
        topP: agent.topP ?? ProviderTransform.topP(model.providerID, model.modelID),
        options: {
          ...ProviderTransform.options(model.providerID, model.modelID, model.npm ?? "", sessionID),
          ...model.info.options,
          ...agent.options,
        },
      }

      // Запускаем суммаризацию предыдущего сообщения при первом шаге
      if (step === 1) {
        SessionSummary.summarize({
          sessionID: sessionID,
          messageID: lastUser.id,
        })
      }

      // Запускаем генерирование ответа модели
      const result = await processor.process(() =>
        streamText({
          onError(error) {
            log.error("stream error", {
              error,
            })
          },
          // Исправляем ошибочные вызовы инструментов (неправильный регистр имени)
          async experimental_repairToolCall(input) {
            const lower = input.toolCall.toolName.toLowerCase()
            if (lower !== input.toolCall.toolName && tools[lower]) {
              log.info("repairing tool call", {
                tool: input.toolCall.toolName,
                repaired: lower,
              })
              return {
                ...input.toolCall,
                toolName: lower,
              }
            }
            // Если инструмент не существует, создаем фиктивный вызов с сообщением об ошибке
            return {
              ...input.toolCall,
              input: JSON.stringify({
                tool: input.toolCall.toolName,
                error: input.error.message,
              }),
              toolName: "invalid",
            }
          },
          // Заголовки для специальных провайдеров (например opencode)
          headers: {
            ...(model.providerID === "opencode"
              ? {
                  "x-opencode-session": sessionID,
                  "x-opencode-request": lastUser.id,
                }
              : undefined),
            ...model.info.headers,
          },
          // Максимум попыток переподключения - мы сами управляем повторами
          maxRetries: 0,
          activeTools: Object.keys(tools).filter((x) => x !== "invalid"),
          maxOutputTokens: ProviderTransform.maxOutputTokens(
            model.providerID,
            params.options,
            model.info.limit.output,
            OUTPUT_TOKEN_MAX,
          ),
          abortSignal: abort,
          providerOptions: ProviderTransform.providerOptions(model.npm, model.providerID, params.options),
          // Останавливаем после одного шага (одного вызова инструмента или финального ответа)
          stopWhen: stepCountIs(1),
          temperature: params.temperature,
          topP: params.topP,
          // Сообщения: система, история, пользовательский запрос
          messages: [
            ...system.map(
              (x): ModelMessage => ({
                role: "system",
                content: x,
              }),
            ),
            ...MessageV2.toModelMessage(
              msgs.filter((m) => {
                if (m.info.role !== "assistant" || m.info.error === undefined) {
                  return true
                }
                // Включаем абортированные сообщения если они содержат данные кроме шагов и размышлений
                if (
                  MessageV2.AbortedError.isInstance(m.info.error) &&
                  m.parts.some((part) => part.type !== "step-start" && part.type !== "reasoning")
                ) {
                  return true
                }

                return false
              }),
            ),
          ],
          // Инструменты (если модель их поддерживает)
          tools: model.info.tool_call === false ? undefined : tools,
          // Обертка для трансформации запроса для специфичных провайдеров
          model: wrapLanguageModel({
            model: model.language,
            middleware: [
              {
                async transformParams(args) {
                  if (args.type === "stream") {
                    // @ts-expect-error
                    args.params.prompt = ProviderTransform.message(args.params.prompt, model.providerID, model.modelID)
                  }
                  return args.params
                },
              },
            ],
          }),
        }),
      )
      // Если процессор вернул "stop", выходим из цикла
      if (result === "stop") break
      continue
    }
    // Очищаем сжатые записи при завершении
    SessionCompaction.prune({ sessionID })
    // Возвращаем последнее сообщение ассистента (может быть использовано клиентом)
    for await (const item of MessageV2.stream(sessionID)) {
      if (item.info.role === "user") continue
      // Уведомляем все ожидающие callback-и о результате
      const queued = state()[sessionID]?.callbacks ?? []
      for (const q of queued) {
        q.resolve(item)
      }
      return item
    }
    throw new Error("Impossible")
  })

  // Выбирает модель для использования: явная, из агента или по умолчанию
  async function resolveModel(input: { model: PromptInput["model"]; agent: Agent.Info }) {
    if (input.model) {
      return input.model
    }
    if (input.agent.model) {
      return input.agent.model
    }
    return Provider.defaultModel()
  }

  // Собирает системный промпт из разных источников с правильным порядком приоритета
  async function resolveSystemPrompt(input: {
    system?: string
    appendSystem?: string
    agent: Agent.Info
    providerID: string
    modelID: string
  }) {
    let system = SystemPrompt.header(input.providerID)
    // Добавляем основной промпт (пользовательский > промпт агента > промпт модели)
    system.push(
      ...(() => {
        if (input.system) return [input.system]
        const base = input.agent.prompt ? [input.agent.prompt] : SystemPrompt.provider(input.modelID)
        if (input.appendSystem) {
          return [base[0] + "\n" + input.appendSystem]
        }
        return base
      })(),
    )
    // Добавляем информацию об окружении и пользовательские инструкции (если нет явного системного промпта)
    if (!input.system) {
      system.push(...(await SystemPrompt.environment()))
      system.push(...(await SystemPrompt.custom()))
    }
    // Сжимаем до 2 системных промптов для кэширования
    const [first, ...rest] = system
    system = [first, rest.join("\n")]
    return system
  }

  // Подготавливает доступные инструменты для модели на основе конфигурации
  async function resolveTools(input: {
    agent: Agent.Info
    model: {
      providerID: string
      modelID: string
    }
    sessionID: string
    tools?: Record<string, boolean>
    processor: SessionProcessor.Info
  }) {
    const tools: Record<string, AITool> = {}
    // Объединяем включенные инструменты из агента, модели и явного запроса пользователя
    const enabledTools = pipe(
      input.agent.tools,
      mergeDeep(await ToolRegistry.enabled(input.model.providerID, input.model.modelID, input.agent)),
      mergeDeep(input.tools ?? {}),
    )
    // Регистрируем инструменты из реестра
    for (const item of await ToolRegistry.tools(input.model.providerID, input.model.modelID)) {
      if (Wildcard.all(item.id, enabledTools) === false) continue
      // Преобразуем схему параметров для совместимости с провайдером
      const schema = ProviderTransform.schema(
        input.model.providerID,
        input.model.modelID,
        z.toJSONSchema(item.parameters),
      )
      tools[item.id] = tool({
        id: item.id as any,
        description: item.description,
        inputSchema: jsonSchema(schema as any),
        async execute(args, options) {
          const result = await item.execute(args, {
            sessionID: input.sessionID,
            abort: options.abortSignal!,
            messageID: input.processor.message.id,
            callID: options.toolCallId,
            extra: input.model,
            agent: input.agent.name,
            // Callback для обновления метаданных во время выполнения инструмента
            metadata: async (val) => {
              const match = input.processor.partFromToolCall(options.toolCallId)
              if (match && match.state.status === "running") {
                await Session.updatePart({
                  ...match,
                  state: {
                    title: val.title,
                    metadata: val.metadata,
                    status: "running",
                    input: args,
                    time: {
                      start: Date.now(),
                    },
                  },
                })
              }
            },
          })
          return result
        },
        toModelOutput(result) {
          return {
            type: "text",
            value: result.output,
          }
        },
      })
    }

    // Регистрируем инструменты из MCP (Model Context Protocol)
    for (const [key, item] of Object.entries(await MCP.tools())) {
      if (Wildcard.all(key, enabledTools) === false) continue
      const execute = item.execute
      if (!execute) continue
      // Оборачиваем выполнение для обработки различных типов контента (текст, изображения)
      item.execute = async (args, opts) => {
        const result = await execute(args, opts)

        const textParts: string[] = []
        const attachments: MessageV2.FilePart[] = []

        // Обрабатываем результаты инструмента (текст и изображения)
        for (const item of result.content) {
          if (item.type === "text") {
            textParts.push(item.text)
          } else if (item.type === "image") {
            attachments.push({
              id: Identifier.ascending("part"),
              sessionID: input.sessionID,
              messageID: input.processor.message.id,
              type: "file",
              mime: item.mimeType,
              url: `data:${item.mimeType};base64,${item.data}`,
            })
          }
          // Add support for other types if needed
        }

        return {
          title: "",
          metadata: result.metadata ?? {},
          output: textParts.join("\n\n"),
          attachments,
          content: result.content, // directly return content to preserve ordering when outputting to model
        }
      }
      item.toModelOutput = (result) => {
        return {
          type: "text",
          value: result.output,
        }
      }
      tools[key] = item
    }
    return tools
  }

  async function createUserMessage(input: PromptInput) {
    const agent = await Agent.get(input.agent ?? "build")
    const info: MessageV2.Info = {
      id: input.messageID ?? Identifier.ascending("message"),
      role: "user",
      sessionID: input.sessionID,
      time: {
        created: Date.now(),
      },
      tools: input.tools,
      system: input.system,
      appendSystem: input.appendSystem,
      agent: agent.name,
      model: await resolveModel({
        model: input.model,
        agent,
      }),
    }

    const parts = await Promise.all(
      input.parts.map(async (part): Promise<MessageV2.Part[]> => {
        if (part.type === "file") {
          const url = new URL(part.url)
          switch (url.protocol) {
            case "data:":
              if (part.mime === "text/plain") {
                return [
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `Called the Read tool with the following input: ${JSON.stringify({ filePath: part.filename })}`,
                  },
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: Buffer.from(part.url, "base64url").toString(),
                  },
                  {
                    ...part,
                    id: part.id ?? Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                  },
                ]
              }
              break
            case "file:":
              log.info("file", { mime: part.mime })
              // have to normalize, symbol search returns absolute paths
              // Decode the pathname since URL constructor doesn't automatically decode it
              const filepath = fileURLToPath(part.url)
              const stat = await Bun.file(filepath).stat()

              if (stat.isDirectory()) {
                part.mime = "application/x-directory"
              }

              if (part.mime === "text/plain") {
                let offset: number | undefined = undefined
                let limit: number | undefined = undefined
                const range = {
                  start: url.searchParams.get("start"),
                  end: url.searchParams.get("end"),
                }
                if (range.start != null) {
                  const filePathURI = part.url.split("?")[0]
                  let start = parseInt(range.start)
                  let end = range.end ? parseInt(range.end) : undefined
                  offset = Math.max(start - 1, 0)
                  if (end) {
                    limit = end - offset
                  }
                }
                const args = { filePath: filepath, offset, limit }

                const pieces: MessageV2.Part[] = [
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `Called the Read tool with the following input: ${JSON.stringify(args)}`,
                  },
                ]

                await ReadTool.init()
                  .then(async (t) => {
                    const result = await t.execute(args, {
                      sessionID: input.sessionID,
                      abort: new AbortController().signal,
                      agent: input.agent!,
                      messageID: info.id,
                      extra: { bypassCwdCheck: true, ...info.model },
                      metadata: async () => {},
                    })
                    pieces.push(
                      {
                        id: Identifier.ascending("part"),
                        messageID: info.id,
                        sessionID: input.sessionID,
                        type: "text",
                        synthetic: true,
                        text: result.output,
                      },
                      {
                        ...part,
                        id: part.id ?? Identifier.ascending("part"),
                        messageID: info.id,
                        sessionID: input.sessionID,
                      },
                    )
                  })
                  .catch((error) => {
                    log.error("failed to read file", { error })
                    const message = error instanceof Error ? error.message : error.toString()
                    Bus.publish(Session.Event.Error, {
                      sessionID: input.sessionID,
                      error: new NamedError.Unknown({
                        message,
                      }).toObject(),
                    })
                    pieces.push({
                      id: Identifier.ascending("part"),
                      messageID: info.id,
                      sessionID: input.sessionID,
                      type: "text",
                      synthetic: true,
                      text: `Read tool failed to read ${filepath} with the following error: ${message}`,
                    })
                  })

                return pieces
              }

              if (part.mime === "application/x-directory") {
                const args = { path: filepath }
                const result = await ListTool.init().then((t) =>
                  t.execute(args, {
                    sessionID: input.sessionID,
                    abort: new AbortController().signal,
                    agent: input.agent!,
                    messageID: info.id,
                    extra: { bypassCwdCheck: true },
                    metadata: async () => {},
                  }),
                )
                return [
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `Called the list tool with the following input: ${JSON.stringify(args)}`,
                  },
                  {
                    id: Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: result.output,
                  },
                  {
                    ...part,
                    id: part.id ?? Identifier.ascending("part"),
                    messageID: info.id,
                    sessionID: input.sessionID,
                  },
                ]
              }

              const file = Bun.file(filepath)
              FileTime.read(input.sessionID, filepath)
              return [
                {
                  id: Identifier.ascending("part"),
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "text",
                  text: `Called the Read tool with the following input: {\"filePath\":\"${filepath}\"}`,
                  synthetic: true,
                },
                {
                  id: part.id ?? Identifier.ascending("part"),
                  messageID: info.id,
                  sessionID: input.sessionID,
                  type: "file",
                  url: `data:${part.mime};base64,` + Buffer.from(await file.bytes()).toString("base64"),
                  mime: part.mime,
                  filename: part.filename!,
                  source: part.source,
                },
              ]
          }
        }

        if (part.type === "agent") {
          return [
            {
              id: Identifier.ascending("part"),
              ...part,
              messageID: info.id,
              sessionID: input.sessionID,
            },
            {
              id: Identifier.ascending("part"),
              messageID: info.id,
              sessionID: input.sessionID,
              type: "text",
              synthetic: true,
              text:
                "Use the above message and context to generate a prompt and call the task tool with subagent: " +
                part.name,
            },
          ]
        }

        return [
          {
            id: Identifier.ascending("part"),
            ...part,
            messageID: info.id,
            sessionID: input.sessionID,
          },
        ]
      }),
    ).then((x) => x.flat())

    await Session.updateMessage(info)
    for (const part of parts) {
      await Session.updatePart(part)
    }

    return {
      info,
      parts,
    }
  }

  function insertReminders(input: { messages: MessageV2.WithParts[]; agent: Agent.Info }) {
    const userMessage = input.messages.findLast((msg) => msg.info.role === "user")
    if (!userMessage) return input.messages
    if (input.agent.name === "plan") {
      userMessage.parts.push({
        id: Identifier.ascending("part"),
        messageID: userMessage.info.id,
        sessionID: userMessage.info.sessionID,
        type: "text",
        text: PROMPT_PLAN,
        synthetic: true,
      })
    }
    const wasPlan = input.messages.some((msg) => msg.info.role === "assistant" && msg.info.mode === "plan")
    if (wasPlan && input.agent.name === "build") {
      userMessage.parts.push({
        id: Identifier.ascending("part"),
        messageID: userMessage.info.id,
        sessionID: userMessage.info.sessionID,
        type: "text",
        text: BUILD_SWITCH,
        synthetic: true,
      })
    }
    return input.messages
  }

  export const ShellInput = z.object({
    sessionID: Identifier.schema("session"),
    agent: z.string(),
    command: z.string(),
  })
  export type ShellInput = z.infer<typeof ShellInput>
  export async function shell(input: ShellInput) {
    const session = await Session.get(input.sessionID)
    if (session.revert) {
      SessionRevert.cleanup(session)
    }
    const agent = await Agent.get(input.agent)
    const model = await resolveModel({ agent, model: undefined })
    const userMsg: MessageV2.User = {
      id: Identifier.ascending("message"),
      sessionID: input.sessionID,
      time: {
        created: Date.now(),
      },
      role: "user",
      agent: input.agent,
      model: {
        providerID: model.providerID,
        modelID: model.modelID,
      },
    }
    await Session.updateMessage(userMsg)
    const userPart: MessageV2.Part = {
      type: "text",
      id: Identifier.ascending("part"),
      messageID: userMsg.id,
      sessionID: input.sessionID,
      text: "The following tool was executed by the user",
      synthetic: true,
    }
    await Session.updatePart(userPart)

    const msg: MessageV2.Assistant = {
      id: Identifier.ascending("message"),
      sessionID: input.sessionID,
      parentID: userMsg.id,
      mode: input.agent,
      cost: 0,
      path: {
        cwd: Instance.directory,
        root: Instance.worktree,
      },
      time: {
        created: Date.now(),
      },
      role: "assistant",
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      modelID: model.modelID,
      providerID: model.providerID,
    }
    await Session.updateMessage(msg)
    const part: MessageV2.Part = {
      type: "tool",
      id: Identifier.ascending("part"),
      messageID: msg.id,
      sessionID: input.sessionID,
      tool: "bash",
      callID: ulid(),
      state: {
        status: "running",
        time: {
          start: Date.now(),
        },
        input: {
          command: input.command,
        },
      },
    }
    await Session.updatePart(part)
    const shell = process.env["SHELL"] ?? "bash"
    const shellName = path.basename(shell)

    const invocations: Record<string, { args: string[] }> = {
      nu: {
        args: ["-c", input.command],
      },
      fish: {
        args: ["-c", input.command],
      },
      zsh: {
        args: [
          "-c",
          "-l",
          `
            [[ -f ~/.zshenv ]] && source ~/.zshenv >/dev/null 2>&1 || true
            [[ -f "\${ZDOTDIR:-$HOME}/.zshrc" ]] && source "\${ZDOTDIR:-$HOME}/.zshrc" >/dev/null 2>&1 || true
            ${input.command}
          `,
        ],
      },
      bash: {
        args: [
          "-c",
          "-l",
          `
            [[ -f ~/.bashrc ]] && source ~/.bashrc >/dev/null 2>&1 || true
            ${input.command}
          `,
        ],
      },
      // Fallback: any shell that doesn't match those above
      "": {
        args: ["-c", "-l", `${input.command}`],
      },
    }

    const matchingInvocation = invocations[shellName] ?? invocations[""]
    const args = matchingInvocation?.args

    const proc = spawn(shell, args, {
      cwd: Instance.directory,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        TERM: "dumb",
      },
    })

    let output = ""

    proc.stdout?.on("data", (chunk) => {
      output += chunk.toString()
      if (part.state.status === "running") {
        part.state.metadata = {
          output: output,
          description: "",
        }
        Session.updatePart(part)
      }
    })

    proc.stderr?.on("data", (chunk) => {
      output += chunk.toString()
      if (part.state.status === "running") {
        part.state.metadata = {
          output: output,
          description: "",
        }
        Session.updatePart(part)
      }
    })

    await new Promise<void>((resolve) => {
      proc.on("close", () => {
        resolve()
      })
    })
    msg.time.completed = Date.now()
    await Session.updateMessage(msg)
    if (part.state.status === "running") {
      part.state = {
        status: "completed",
        time: {
          ...part.state.time,
          end: Date.now(),
        },
        input: part.state.input,
        title: "",
        metadata: {
          output,
          description: "",
        },
        output,
      }
      await Session.updatePart(part)
    }
    return { info: msg, parts: [part] }
  }

  export const CommandInput = z.object({
    messageID: Identifier.schema("message").optional(),
    sessionID: Identifier.schema("session"),
    agent: z.string().optional(),
    model: z.string().optional(),
    arguments: z.string(),
    command: z.string(),
  })
  export type CommandInput = z.infer<typeof CommandInput>
  const bashRegex = /!`([^`]+)`/g
  const argsRegex = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g
  const placeholderRegex = /\$(\d+)/g
  const quoteTrimRegex = /^["']|["']$/g
  /**
   * Regular expression to match @ file references in text
   * Matches @ followed by file paths, excluding commas, periods at end of sentences, and backticks
   * Does not match when preceded by word characters or backticks (to avoid email addresses and quoted references)
   */

  export async function command(input: CommandInput) {
    log.info("command", input)
    const command = await Command.get(input.command)
    const agentName = command.agent ?? input.agent ?? "build"

    const raw = input.arguments.match(argsRegex) ?? []
    const args = raw.map((arg) => arg.replace(quoteTrimRegex, ""))

    const placeholders = command.template.match(placeholderRegex) ?? []
    let last = 0
    for (const item of placeholders) {
      const value = Number(item.slice(1))
      if (value > last) last = value
    }

    // Let the final placeholder swallow any extra arguments so prompts read naturally
    const withArgs = command.template.replaceAll(placeholderRegex, (_, index) => {
      const position = Number(index)
      const argIndex = position - 1
      if (argIndex >= args.length) return ""
      if (position === last) return args.slice(argIndex).join(" ")
      return args[argIndex]
    })
    let template = withArgs.replaceAll("$ARGUMENTS", input.arguments)

    const shell = ConfigMarkdown.shell(template)
    if (shell.length > 0) {
      const results = await Promise.all(
        shell.map(async ([, cmd]) => {
          try {
            return await $`${{ raw: cmd }}`.nothrow().text()
          } catch (error) {
            return `Error executing command: ${error instanceof Error ? error.message : String(error)}`
          }
        }),
      )
      let index = 0
      template = template.replace(bashRegex, () => results[index++])
    }
    template = template.trim()

    const model = await (async () => {
      if (command.model) {
        return Provider.parseModel(command.model)
      }
      if (command.agent) {
        const cmdAgent = await Agent.get(command.agent)
        if (cmdAgent.model) {
          return cmdAgent.model
        }
      }
      if (input.model) {
        return Provider.parseModel(input.model)
      }
      return await Provider.defaultModel()
    })()
    const agent = await Agent.get(agentName)

    const parts =
      (agent.mode === "subagent" && command.subtask !== false) || command.subtask === true
        ? [
            {
              type: "subtask" as const,
              agent: agent.name,
              description: command.description ?? "",
              // TODO: how can we make task tool accept a more complex input?
              prompt: await resolvePromptParts(template).then((x) => x.find((y) => y.type === "text")?.text ?? ""),
            },
          ]
        : await resolvePromptParts(template)

    const result = (await prompt({
      sessionID: input.sessionID,
      messageID: input.messageID,
      model,
      agent: agentName,
      parts,
    })) as MessageV2.WithParts

    Bus.publish(Command.Event.Executed, {
      name: input.command,
      sessionID: input.sessionID,
      arguments: input.arguments,
      messageID: result.info.id,
    })

    return result
  }

  // TODO: wire this back up
  async function ensureTitle(input: {
    session: Session.Info
    message: MessageV2.WithParts
    history: MessageV2.WithParts[]
    providerID: string
    modelID: string
  }) {
    if (input.session.parentID) return
    if (!Session.isDefaultTitle(input.session.title)) return
    const isFirst =
      input.history.filter((m) => m.info.role === "user" && !m.parts.every((p) => "synthetic" in p && p.synthetic))
        .length === 1
    if (!isFirst) return
    const small =
      (await Provider.getSmallModel(input.providerID)) ?? (await Provider.getModel(input.providerID, input.modelID))
    const options = {
      ...ProviderTransform.options(small.providerID, small.modelID, small.npm ?? "", input.session.id),
      ...small.info.options,
    }
    if (small.providerID === "openai" || small.modelID.includes("gpt-5")) {
      if (small.modelID.includes("5.1")) {
        options["reasoningEffort"] = "low"
      } else {
        options["reasoningEffort"] = "minimal"
      }
    }
    if (small.providerID === "google") {
      options["thinkingConfig"] = {
        thinkingBudget: 0,
      }
    }
    await generateText({
      maxOutputTokens: small.info.reasoning ? 1500 : 20,
      providerOptions: ProviderTransform.providerOptions(small.npm, small.providerID, options),
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
            `,
        },
        ...MessageV2.toModelMessage([
          {
            info: {
              id: Identifier.ascending("message"),
              role: "user",
              sessionID: input.session.id,
              time: {
                created: Date.now(),
              },
              agent: input.message.info.role === "user" ? input.message.info.agent : "build",
              model: {
                providerID: input.providerID,
                modelID: input.modelID,
              },
            },
            parts: input.message.parts,
          },
        ]),
      ],
      headers: small.info.headers,
      model: small.language,
    })
      .then((result) => {
        if (result.text)
          return Session.update(input.session.id, (draft) => {
            const cleaned = result.text
              .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
              .split("\n")
              .map((line) => line.trim())
              .find((line) => line.length > 0)
            if (!cleaned) return

            const title = cleaned.length > 100 ? cleaned.substring(0, 97) + "..." : cleaned
            draft.title = title
          })
      })
      .catch((error) => {
        log.error("failed to generate title", { error, model: small.info.id })
      })
  }
}
