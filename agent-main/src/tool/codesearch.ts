import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./codesearch.txt"

// Конфигурация API для поиска кода через MCP (Model Context Protocol)
const API_CONFIG = {
  BASE_URL: "https://mcp.exa.ai",
  ENDPOINTS: {
    CONTEXT: "/mcp",
  },
} as const

// Интерфейс запроса к API поиска кода через MCP
interface McpCodeRequest {
  jsonrpc: string
  id: number
  method: string
  params: {
    name: string
    arguments: {
      query: string
      tokensNum: number
    }
  }
}

// Интерфейс ответа от API поиска кода
interface McpCodeResponse {
  jsonrpc: string
  result: {
    content: Array<{
      type: string
      text: string
    }>
  }
}

// Инструмент поиска кода - позволяет агенту найти примеры кода, документацию и справочную информацию
// по различным API, библиотекам и фреймворкам используя MCP протокол
export const CodeSearchTool = Tool.define("codesearch", {
  description: DESCRIPTION,
  parameters: z.object({
    // Поисковый запрос для поиска примеров кода
    query: z
      .string()
      .describe(
        "Search query to find relevant context for APIs, Libraries, and SDKs. For example, 'React useState hook examples', 'Python pandas dataframe filtering', 'Express.js middleware', 'Next js partial prerendering configuration'",
      ),
    // Количество токенов для возврата в результате
    tokensNum: z
      .number()
      .min(1000)
      .max(50000)
      .default(5000)
      .describe(
        "Number of tokens to return (1000-50000). Default is 5000 tokens. Adjust this value based on how much context you need - use lower values for focused queries and higher values for comprehensive documentation.",
      ),
  }),
  async execute(params, ctx) {
    // Без ограничений - неограниченный поиск кода
    // Формируем запрос к MCP API в формате JSON-RPC 2.0
    const codeRequest: McpCodeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get_code_context_exa",
        arguments: {
          query: params.query,
          tokensNum: params.tokensNum || 5000,
        },
      },
    }

    // Создаём контроллер прерывания для установки таймаута
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      // Подготавливаем заголовки для запроса
      const headers: Record<string, string> = {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      }

      // Отправляем запрос к API поиска кода
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTEXT}`, {
        method: "POST",
        headers,
        body: JSON.stringify(codeRequest),
        signal: AbortSignal.any([controller.signal, ctx.abort]),
      })

      clearTimeout(timeoutId)

      // Проверяем статус ответа
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Code search error (${response.status}): ${errorText}`)
      }

      const responseText = await response.text()

      // Парсим ответ в формате Server-Sent Events (SSE)
      const lines = responseText.split("\n")
      for (const line of lines) {
        // Ищем строки данных в SSE потоке
        if (line.startsWith("data: ")) {
          const data: McpCodeResponse = JSON.parse(line.substring(6))
          // Если получили результат с контентом, возвращаем первый элемент
          if (data.result && data.result.content && data.result.content.length > 0) {
            return {
              output: data.result.content[0].text,
              title: `Code search: ${params.query}`,
              metadata: {},
            }
          }
        }
      }

      // Если ничего не найдено, возвращаем сообщение об отсутствии результатов
      return {
        output:
          "No code snippets or documentation found. Please try a different query, be more specific about the library or programming concept, or check the spelling of framework names.",
        title: `Code search: ${params.query}`,
        metadata: {},
      }
    } catch (error) {
      clearTimeout(timeoutId)

      // Обработка ошибки таймаута
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Code search request timed out")
      }

      throw error
    }
  },
})
