import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./batch.txt"

// Набор инструментов, которые не разрешены в пакетном режиме
// Batch не может вызывать сам себя, edit и todoread чтобы избежать вложенных вызовов
const DISALLOWED = new Set(["batch", "edit", "todoread"])
// Инструменты, которые скрыты из предложений доступных инструментов
const FILTERED_FROM_SUGGESTIONS = new Set(["invalid", "patch", ...DISALLOWED])

// Инструмент для параллельного выполнения нескольких инструментов в одном вызове
// Максимум 10 инструментов за раз для оптимальной производительности
export const BatchTool = Tool.define("batch", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      // Массив вызовов инструментов, которые нужно выполнить параллельно
      tool_calls: z
        .array(
          z.object({
            tool: z.string().describe("The name of the tool to execute"),
            parameters: z.object({}).loose().describe("Parameters for the tool"),
          }),
        )
        .min(1, "Provide at least one tool call")
        .describe("Array of tool calls to execute in parallel"),
    }),
    // Форматирование ошибок валидации для удобного вывода
    formatValidationError(error) {
      const formattedErrors = error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join(".") : "root"
          return `  - ${path}: ${issue.message}`
        })
        .join("\n")

      return `Invalid parameters for tool 'batch':\n${formattedErrors}\n\nExpected payload format:\n  [{"tool": "tool_name", "parameters": {...}}, {...}]`
    },
    // Основная функция выполнения пакета инструментов
    async execute(params, ctx) {
      const { Session } = await import("../session")
      const { Identifier } = await import("../id/id")

      // Ограничиваем максимум 10 инструментов, остальные отклоняем
      const toolCalls = params.tool_calls.slice(0, 10)
      const discardedCalls = params.tool_calls.slice(10)

      const { ToolRegistry } = await import("./registry")
      const availableTools = await ToolRegistry.tools("", "")
      const toolMap = new Map(availableTools.map((t) => [t.id, t]))

      // Функция для выполнения одного вызова инструмента с отслеживанием состояния
      const executeCall = async (call: (typeof toolCalls)[0]) => {
        const callStartTime = Date.now()
        const partID = Identifier.ascending("part")

        try {
          // Проверяем, разрешён ли инструмент в режиме batch
          if (DISALLOWED.has(call.tool)) {
            throw new Error(
              `Tool '${call.tool}' is not allowed in batch. Disallowed tools: ${Array.from(DISALLOWED).join(", ")}`,
            )
          }

          // Получаем инструмент из реестра
          const tool = toolMap.get(call.tool)
          if (!tool) {
            const availableToolsList = Array.from(toolMap.keys()).filter((name) => !FILTERED_FROM_SUGGESTIONS.has(name))
            throw new Error(`Tool '${call.tool}' not found. Available tools: ${availableToolsList.join(", ")}`)
          }
          // Валидируем параметры перед выполнением
          const validatedParams = tool.parameters.parse(call.parameters)

          // Обновляем статус инструмента на "выполняется"
          await Session.updatePart({
            id: partID,
            messageID: ctx.messageID,
            sessionID: ctx.sessionID,
            type: "tool",
            tool: call.tool,
            callID: partID,
            state: {
              status: "running",
              input: call.parameters,
              time: {
                start: callStartTime,
              },
            },
          })

          // Выполняем инструмент
          const result = await tool.execute(validatedParams, { ...ctx, callID: partID })

          // Обновляем статус на "завершено" с результатом
          await Session.updatePart({
            id: partID,
            messageID: ctx.messageID,
            sessionID: ctx.sessionID,
            type: "tool",
            tool: call.tool,
            callID: partID,
            state: {
              status: "completed",
              input: call.parameters,
              output: result.output,
              title: result.title,
              metadata: result.metadata,
              attachments: result.attachments,
              time: {
                start: callStartTime,
                end: Date.now(),
              },
            },
          })

          return { success: true as const, tool: call.tool, result }
        } catch (error) {
          // Обновляем статус на "ошибка" с описанием
          await Session.updatePart({
            id: partID,
            messageID: ctx.messageID,
            sessionID: ctx.sessionID,
            type: "tool",
            tool: call.tool,
            callID: partID,
            state: {
              status: "error",
              input: call.parameters,
              error: error instanceof Error ? error.message : String(error),
              time: {
                start: callStartTime,
                end: Date.now(),
              },
            },
          })

          return { success: false as const, tool: call.tool, error }
        }
      }

      // Выполняем все инструменты параллельно
      const results = await Promise.all(toolCalls.map((call) => executeCall(call)))

      // Добавляем отклонённые вызовы (более 10) как ошибки
      const now = Date.now()
      for (const call of discardedCalls) {
        const partID = Identifier.ascending("part")
        await Session.updatePart({
          id: partID,
          messageID: ctx.messageID,
          sessionID: ctx.sessionID,
          type: "tool",
          tool: call.tool,
          callID: partID,
          state: {
            status: "error",
            input: call.parameters,
            error: "Maximum of 10 tools allowed in batch",
            time: { start: now, end: now },
          },
        })
        results.push({
          success: false as const,
          tool: call.tool,
          error: new Error("Maximum of 10 tools allowed in batch"),
        })
      }

      // Подсчитываем успешные и неудачные вызовы
      const successfulCalls = results.filter((r) => r.success).length
      const failedCalls = results.length - successfulCalls

      // Формируем сообщение результата
      const outputMessage =
        failedCalls > 0
          ? `Executed ${successfulCalls}/${results.length} tools successfully. ${failedCalls} failed.`
          : `All ${successfulCalls} tools executed successfully.\n\nKeep using the batch tool for optimal performance in your next response!`

      return {
        title: `Batch execution (${successfulCalls}/${results.length} successful)`,
        output: outputMessage,
        attachments: results.filter((result) => result.success).flatMap((r) => r.result.attachments ?? []),
        metadata: {
          totalCalls: results.length,
          successful: successfulCalls,
          failed: failedCalls,
          tools: params.tool_calls.map((c) => c.tool),
          details: results.map((r) => ({ tool: r.tool, success: r.success })),
        },
      }
    },
  }
})
