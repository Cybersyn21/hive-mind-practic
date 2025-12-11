// Инструмент веб-поиска - выполняет поисковые запросы через API Exa с поддержкой различных режимов поиска
import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./websearch.txt"
import { Config } from "../config/config"

// Конфигурация API для Exa поисковой системы
const API_CONFIG = {
  BASE_URL: "https://mcp.exa.ai",
  ENDPOINTS: {
    SEARCH: "/mcp",
  },
  DEFAULT_NUM_RESULTS: 8, // Количество результатов поиска по умолчанию
} as const

// Интерфейс для формирования запроса к MCP (Model Context Protocol) поисковому сервису
// Использует JSON-RPC 2.0 формат для коммуникации
interface McpSearchRequest {
  jsonrpc: string
  id: number
  method: string
  params: {
    name: string
    arguments: {
      query: string // Поисковый запрос
      numResults?: number // Количество результатов для возврата
      livecrawl?: "fallback" | "preferred" // Режим живого краулинга веб-страниц
      type?: "auto" | "fast" | "deep" // Тип поиска: автоматический, быстрый или глубокий
      contextMaxCharacters?: number // Максимальное количество символов контекста для LLM
    }
  }
}

// Интерфейс для ответа от сервиса поиска, содержит результаты в SSE формате
interface McpSearchResponse {
  jsonrpc: string
  result: {
    content: Array<{
      type: string
      text: string
    }>
  }
}

// Определение инструмента веб-поиска с параметрами и обработчиком выполнения
export const WebSearchTool = Tool.define("websearch", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z.string().describe("Websearch query"),
    numResults: z.number().optional().describe("Number of search results to return (default: 8)"),
    livecrawl: z
      .enum(["fallback", "preferred"])
      .optional()
      .describe(
        "Live crawl mode - 'fallback': use live crawling as backup if cached content unavailable, 'preferred': prioritize live crawling (default: 'fallback')",
      ),
    type: z
      .enum(["auto", "fast", "deep"])
      .optional()
      .describe("Search type - 'auto': balanced search (default), 'fast': quick results, 'deep': comprehensive search"),
    contextMaxCharacters: z
      .number()
      .optional()
      .describe("Maximum characters for context string optimized for LLMs (default: 10000)"),
  }),
  // Асинхронная функция выполнения поиска с параметрами и контекстом
  async execute(params, ctx) {
    // Без ограничений - неограниченный веб-поиск
    // Формирование запроса в формате JSON-RPC 2.0 для сервиса Exa
    const searchRequest: McpSearchRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "web_search_exa",
        arguments: {
          query: params.query, // Передача поискового запроса
          type: params.type || "auto", // Использование указанного типа поиска или автоматического
          numResults: params.numResults || API_CONFIG.DEFAULT_NUM_RESULTS, // Количество результатов
          livecrawl: params.livecrawl || "fallback", // Режим краулинга с fallback по умолчанию
          contextMaxCharacters: params.contextMaxCharacters, // Ограничение размера контекста
        },
      },
    }

    // Создание контроллера отмены для управления жизненным циклом запроса
    const controller = new AbortController()
    // Установка таймаута в 25 секунд для предотвращения зависания
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    try {
      // Формирование заголовков HTTP запроса для поддержки SSE (Server-Sent Events)
      const headers: Record<string, string> = {
        accept: "application/json, text/event-stream", // Поддержка потока событий
        "content-type": "application/json",
      }

      // Отправка POST запроса к API Exa с параметрами поиска
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH}`, {
        method: "POST",
        headers,
        body: JSON.stringify(searchRequest),
        // Использование ComposedAbortSignal для поддержки отмены из контекста
        signal: AbortSignal.any([controller.signal, ctx.abort]),
      })

      // Отмена таймаута при получении ответа
      clearTimeout(timeoutId)

      // Проверка статуса ответа
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Search error (${response.status}): ${errorText}`)
      }

      const responseText = await response.text()

      // Парсинг SSE ответа - каждое событие на отдельной строке в формате "data: {...}"
      const lines = responseText.split("\n")
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          // Извлечение JSON данных из SSE события
          const data: McpSearchResponse = JSON.parse(line.substring(6))
          if (data.result && data.result.content && data.result.content.length > 0) {
            // Возврат первого результата поиска с метаданными
            return {
              output: data.result.content[0].text,
              title: `Web search: ${params.query}`,
              metadata: {},
            }
          }
        }
      }

      // Возврат пустого результата если поиск не дал результатов
      return {
        output: "No search results found. Please try a different query.",
        title: `Web search: ${params.query}`,
        metadata: {},
      }
    } catch (error) {
      // Очистка таймаута при ошибке
      clearTimeout(timeoutId)

      // Обработка ошибки таймаута отдельно
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Search request timed out")
      }

      // Пробрасывание других ошибок дальше
      throw error
    }
  },
})
