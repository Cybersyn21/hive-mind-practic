import { experimental_createMCPClient } from "@ai-sdk/mcp"
import { type Tool } from "ai"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { Config } from "../config/config"
import { Log } from "../util/log"
import { NamedError } from "../util/error"
import z from "zod/v4"
import { Instance } from "../project/instance"
import { withTimeout } from "../util/timeout"

export namespace MCP {
  const log = Log.create({ service: "mcp" })

  // Ошибка, выбрасываемая при неудаче подключения к MCP серверу
  export const Failed = NamedError.create(
    "MCPFailed",
    z.object({
      name: z.string(),
    }),
  )

  // Тип MCP клиента - представляет подключенный сервер Model Context Protocol
  type Client = Awaited<ReturnType<typeof experimental_createMCPClient>>

  // Схема для описания статуса подключения к MCP серверу
  // Может быть в одном из трех состояний: подключен, отключен или ошибка
  export const Status = z
    .discriminatedUnion("status", [
      // Успешное подключение к MCP серверу
      z
        .object({
          status: z.literal("connected"),
        })
        .meta({
          ref: "MCPStatusConnected",
        }),
      // MCP сервер отключен в конфигурации
      z
        .object({
          status: z.literal("disabled"),
        })
        .meta({
          ref: "MCPStatusDisabled",
        }),
      // Ошибка при подключении к MCP серверу с описанием проблемы
      z
        .object({
          status: z.literal("failed"),
          error: z.string(),
        })
        .meta({
          ref: "MCPStatusFailed",
        }),
    ])
    .meta({
      ref: "MCPStatus",
    })
  export type Status = z.infer<typeof Status>
  type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>

  // Состояние для управления всеми MCP клиентами в рамках текущей инстанции
  // Инициализирует все сконфигурированные MCP серверы при создании
  // Закрывает все подключения при утилизации инстанции
  const state = Instance.state(
    // Инициализация: создание всех MCP клиентов из конфигурации
    async () => {
      const cfg = await Config.get()
      const config = cfg.mcp ?? {}
      const clients: Record<string, Client> = {}
      const status: Record<string, Status> = {}

      // Параллельно создаем клиентов для каждого сконфигурированного MCP сервера
      await Promise.all(
        Object.entries(config).map(async ([key, mcp]) => {
          const result = await create(key, mcp).catch(() => undefined)
          if (!result) return

          status[key] = result.status

          // Сохраняем успешно созданного клиента
          if (result.mcpClient) {
            clients[key] = result.mcpClient
          }
        }),
      )
      return {
        status,
        clients,
      }
    },
    // Утилизация: закрытие всех подключений к MCP серверам
    async (state) => {
      await Promise.all(
        Object.values(state.clients).map((client) =>
          client.close().catch((error) => {
            log.error("Failed to close MCP client", {
              error,
            })
          }),
        ),
      )
    },
  )

  // Добавить новый MCP сервер в текущую инстанцию
  export async function add(name: string, mcp: Config.Mcp) {
    const s = await state()
    const result = await create(name, mcp)
    if (!result) {
      const status = {
        status: "failed" as const,
        error: "unknown error",
      }
      s.status[name] = status
      return {
        status,
      }
    }
    // Если сервер отключен, просто обновляем статус
    if (!result.mcpClient) {
      s.status[name] = result.status
      return {
        status: s.status,
      }
    }
    // Сохраняем успешно созданного клиента и его статус
    s.clients[name] = result.mcpClient
    s.status[name] = result.status

    return {
      status: s.status,
    }
  }

  // Создать и инициализировать MCP клиент на основе конфигурации
  // Поддерживает как локальные (stdio), так и удаленные (HTTP/SSE) серверы
  async function create(key: string, mcp: Config.Mcp) {
    // Если сервер явно отключен в конфигурации, пропускаем его
    if (mcp.enabled === false) {
      log.info("mcp server disabled", { key })
      return
    }
    log.info("found", { key, type: mcp.type })
    let mcpClient: MCPClient | undefined
    let status: Status | undefined = undefined

    // Обработка удаленных MCP серверов (HTTP/SSE)
    if (mcp.type === "remote") {
      // Пробуем несколько транспортов в порядке приоритета
      const transports = [
        {
          name: "StreamableHTTP",
          transport: new StreamableHTTPClientTransport(new URL(mcp.url), {
            requestInit: {
              headers: mcp.headers,
            },
          }),
        },
        {
          name: "SSE",
          transport: new SSEClientTransport(new URL(mcp.url), {
            requestInit: {
              headers: mcp.headers,
            },
          }),
        },
      ]
      let lastError: Error | undefined
      // Пробуем подключиться с помощью каждого транспорта до первого успеха
      for (const { name, transport } of transports) {
        const result = await experimental_createMCPClient({
          name: "opencode",
          transport,
        })
          .then((client) => {
            log.info("connected", { key, transport: name })
            mcpClient = client
            status = { status: "connected" }
            return true
          })
          .catch((error) => {
            lastError = error instanceof Error ? error : new Error(String(error))
            log.debug("transport connection failed", {
              key,
              transport: name,
              url: mcp.url,
              error: lastError.message,
            })
            status = {
              status: "failed" as const,
              error: lastError.message,
            }
            return false
          })
        // Если подключение успешно, выходим из цикла
        if (result) break
      }
    }

    // Обработка локальных MCP серверов (запуск команды)
    if (mcp.type === "local") {
      const [cmd, ...args] = mcp.command
      await experimental_createMCPClient({
        name: "opencode",
        transport: new StdioClientTransport({
          stderr: "ignore",
          command: cmd,
          args,
          env: {
            ...process.env,
            // Специальная переменная окружения для Bun
            ...(cmd === "opencode" ? { BUN_BE_BUN: "1" } : {}),
            ...mcp.environment,
          },
        }),
      })
        .then((client) => {
          mcpClient = client
          status = {
            status: "connected",
          }
        })
        .catch((error) => {
          log.error("local mcp startup failed", {
            key,
            command: mcp.command,
            error: error instanceof Error ? error.message : String(error),
          })
          status = {
            status: "failed" as const,
            error: error instanceof Error ? error.message : String(error),
          }
        })
    }

    // Если статус не установлен - обозначаем неизвестную ошибку
    if (!status) {
      status = {
        status: "failed" as const,
        error: "Unknown error",
      }
    }

    // Если клиент не создан, возвращаем статус ошибки
    if (!mcpClient) {
      return {
        mcpClient: undefined,
        status,
      }
    }

    // Проверяем, что сервер может предоставить инструменты (tools)
    // с учетом таймаута для предотвращения зависания
    const result = await withTimeout(mcpClient.tools(), mcp.timeout ?? 5000).catch((err) => {
      log.error("failed to get tools from client", { key, error: err })
      return undefined
    })
    if (!result) {
      // Если не удалось получить инструменты, закрываем клиента и возвращаем ошибку
      await mcpClient.close().catch((error) => {
        log.error("Failed to close MCP client", {
          error,
        })
      })
      status = {
        status: "failed",
        error: "Failed to get tools",
      }
      return {
        mcpClient: undefined,
        status: {
          status: "failed" as const,
          error: "Failed to get tools",
        },
      }
    }

    log.info("create() successfully created client", { key, toolCount: Object.keys(result).length })
    return {
      mcpClient,
      status,
    }
  }

  // Получить статус всех MCP клиентов
  export async function status() {
    return state().then((state) => state.status)
  }

  // Получить все активные MCP клиентов
  export async function clients() {
    return state().then((state) => state.clients)
  }

  // Получить все доступные инструменты (tools) от всех MCP серверов
  // Инструменты объединяются в один объект с уникальными именами
  export async function tools() {
    const result: Record<string, Tool> = {}
    const s = await state()
    const clientsSnapshot = await clients()

    // Проходим по каждому MCP клиенту и получаем его инструменты
    for (const [clientName, client] of Object.entries(clientsSnapshot)) {
      const tools = await client.tools().catch((e) => {
        log.error("failed to get tools", { clientName, error: e.message })
        // При ошибке обновляем статус и удаляем неработающего клиента
        const failedStatus = {
          status: "failed" as const,
          error: e instanceof Error ? e.message : String(e),
        }
        s.status[clientName] = failedStatus
        delete s.clients[clientName]
      })
      if (!tools) {
        continue
      }

      // Добавляем инструменты с префиксом имени клиента для уникальности
      for (const [toolName, tool] of Object.entries(tools)) {
        // Очищаем имена от недопустимых символов для использования в качестве ключей
        const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, "_")
        const sanitizedToolName = toolName.replace(/[^a-zA-Z0-9_-]/g, "_")
        result[sanitizedClientName + "_" + sanitizedToolName] = tool
      }
    }
    return result
  }
}
