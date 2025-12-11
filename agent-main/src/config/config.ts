// Модуль конфигурации для управления глобальными и локальными параметрами приложения
// Загружает конфигурационные файлы (JSON, JSONC, markdown), объединяет их и предоставляет типизированный интерфейс
// Поддерживает конфигурацию агентов, команд, режимов, провайдеров моделей и другие настройки

import { Log } from "../util/log"
import path from "path"
import os from "os"
import z from "zod"
import { Filesystem } from "../util/filesystem"
import { ModelsDev } from "../provider/models"
import { mergeDeep, pipe } from "remeda"
import { Global } from "../global"
import fs from "fs/promises"
import { lazy } from "../util/lazy"
import { NamedError } from "../util/error"
import { Flag } from "../flag/flag"
import { Auth } from "../auth"
import { type ParseError as JsoncParseError, parse as parseJsonc, printParseErrorCode } from "jsonc-parser"
import { Instance } from "../project/instance"
import { ConfigMarkdown } from "./markdown"

export namespace Config {
  const log = Log.create({ service: "config" })

  // Главное состояние конфигурации - загружает и объединяет все источники конфигураций
  // Приоритет загрузки (от низкого к высокому): глобальная → проект → OPENCODE_CONFIG → well-known → переменные окружения
  export const state = Instance.state(async () => {
    const auth = await Auth.all()
    let result = await global()

    // Переопределение конфигурацией, передаваемой через флаг OPENCODE_CONFIG
    if (Flag.OPENCODE_CONFIG) {
      result = mergeDeep(result, await loadFile(Flag.OPENCODE_CONFIG))
      log.debug("loaded custom config", { path: Flag.OPENCODE_CONFIG })
    }

    // Поиск и загрузка конфигурационных файлов (opencode.jsonc, opencode.json) вверх по дереву директорий
    for (const file of ["opencode.jsonc", "opencode.json"]) {
      const found = await Filesystem.findUp(file, Instance.directory, Instance.worktree)
      for (const resolved of found.toReversed()) {
        result = mergeDeep(result, await loadFile(resolved))
      }
    }

    // Загрузка конфигурации из переменной окружения OPENCODE_CONFIG_CONTENT (содержит JSON)
    if (Flag.OPENCODE_CONFIG_CONTENT) {
      result = mergeDeep(result, JSON.parse(Flag.OPENCODE_CONFIG_CONTENT))
      log.debug("loaded custom config from OPENCODE_CONFIG_CONTENT")
    }

    // Загрузка конфигурации из well-known точек для аутентифицированных источников
    for (const [key, value] of Object.entries(auth)) {
      if (value.type === "wellknown") {
        process.env[value.key] = value.token
        const wellknown = (await fetch(`${key}/.well-known/opencode`).then((x) => x.json())) as any
        result = mergeDeep(result, await load(JSON.stringify(wellknown.config ?? {}), process.cwd()))
      }
    }

    // Инициализация объектов по умолчанию
    result.agent = result.agent || {}
    result.mode = result.mode || {}

    // Сбор всех директорий конфигурации: глобальная, локальные .opencode папки, и явно указанные
    const directories = [
      Global.Path.config,
      ...(await Array.fromAsync(
        Filesystem.up({
          targets: [".opencode"],
          start: Instance.directory,
          stop: Instance.worktree,
        }),
      )),
    ]

    // Добавление директории конфигурации из переменной окружения OPENCODE_CONFIG_DIR
    if (Flag.OPENCODE_CONFIG_DIR) {
      directories.push(Flag.OPENCODE_CONFIG_DIR)
      log.debug("loading config from OPENCODE_CONFIG_DIR", { path: Flag.OPENCODE_CONFIG_DIR })
    }

    // Загрузка конфигурации из всех собранных директорий
    const promises: Promise<void>[] = []
    for (const dir of directories) {
      await assertValid(dir)

      // Загрузка JSON/JSONC конфигурационных файлов из специальных директорий конфигурации
      if (dir.endsWith(".opencode") || dir === Flag.OPENCODE_CONFIG_DIR) {
        for (const file of ["opencode.jsonc", "opencode.json"]) {
          log.debug(`loading config from ${path.join(dir, file)}`)
          result = mergeDeep(result, await loadFile(path.join(dir, file)))
          // Инициализация по умолчанию для удовлетворения проверки типов
          result.agent ??= {}
          result.mode ??= {}
        }
      }

      // Параллельная загрузка зависимостей, команд, агентов и режимов из каждой директории
      promises.push(installDependencies(dir))
      result.command = mergeDeep(result.command ?? {}, await loadCommand(dir))
      result.agent = mergeDeep(result.agent, await loadAgent(dir))
      result.agent = mergeDeep(result.agent, await loadMode(dir))
    }
    // Ожидание завершения всех асинхронных операций (ошибки не приводят к отказу)
    await Promise.allSettled(promises)

    // Миграция устаревшего поля "mode" в поле "agent" для обратной совместимости
    for (const [name, mode] of Object.entries(result.mode)) {
      result.agent = mergeDeep(result.agent ?? {}, {
        [name]: {
          ...mode,
          mode: "primary" as const,
        },
      })
    }

    // Система разрешений удалена (раньше контролировала доступ к операциям)
    // Функция совместного доступа удалена - нет поддержки обмена конфигурациями

    // Инициализация имени пользователя по умолчанию из системной информации, если не указано
    if (!result.username) result.username = os.userInfo().username

    // Инициализация комбинаций клавиш по умолчанию, если не указаны в конфигурации
    if (!result.keybinds) result.keybinds = Info.shape.keybinds.parse({})

    return {
      config: result,
      directories,
    }
  })

  // Проверка на неправильные имена директорий конфигурации (например, "agents" вместо "agent")
  const INVALID_DIRS = new Bun.Glob(`{${["agents", "commands", "tools"].join(",")}}/`)
  // Функция валидации директории конфигурации - проверяет на распространённые опечатки в названиях папок
  async function assertValid(dir: string) {
    const invalid = await Array.fromAsync(
      INVALID_DIRS.scan({
        onlyFiles: false,
        cwd: dir,
      }),
    )
    // Выброс ошибки, если найдены неправильные имена директорий
    for (const item of invalid) {
      throw new ConfigDirectoryTypoError({
        path: dir,
        dir: item,
        suggestion: item.substring(0, item.length - 1),
      })
    }
  }

  // Заглушка для установки зависимостей (функция удалена - система плагинов не поддерживается)
  async function installDependencies(dir: string) {
    // Установка зависимостей удалена - нет поддержки плагинов
  }

  // Загрузка конфигурации команд из markdown файлов (command/**/*.md)
  const COMMAND_GLOB = new Bun.Glob("command/**/*.md")
  // Функция для чтения и парсинга всех команд из директории конфигурации
  async function loadCommand(dir: string) {
    const result: Record<string, Command> = {}
    for await (const item of COMMAND_GLOB.scan({
      absolute: true,
      followSymlinks: true,
      dot: true,
      cwd: dir,
    })) {
      // Парсинг markdown файла с YAML фронт-материей
      const md = await ConfigMarkdown.parse(item)
      if (!md.data) continue

      // Извлечение имени команды из пути файла (удаляет префикс директории и расширение .md)
      const name = (() => {
        const patterns = ["/.opencode/command/", "/command/"]
        const pattern = patterns.find((p) => item.includes(p))

        if (pattern) {
          const index = item.indexOf(pattern)
          return item.slice(index + pattern.length, -3)
        }
        return path.basename(item, ".md")
      })()

      // Формирование объекта конфигурации команды с содержимым markdown как шаблон
      const config = {
        name,
        ...md.data,
        template: md.content.trim(),
      }
      // Валидация конфигурации командт с использованием Zod схемы
      const parsed = Command.safeParse(config)
      if (parsed.success) {
        result[config.name] = parsed.data
        continue
      }
      throw new InvalidError({ path: item }, { cause: parsed.error })
    }
    return result
  }

  // Загрузка конфигурации агентов из markdown файлов (agent/**/*.md)
  const AGENT_GLOB = new Bun.Glob("agent/**/*.md")
  // Функция для чтения и парсинга всех агентов из директории конфигурации
  // Поддерживает вложенные агенты в подпапках (например, agent/category/agent-name.md)
  async function loadAgent(dir: string) {
    const result: Record<string, Agent> = {}

    for await (const item of AGENT_GLOB.scan({
      absolute: true,
      followSymlinks: true,
      dot: true,
      cwd: dir,
    })) {
      // Парсинг markdown файла с YAML фронт-материей содержащей конфигурацию агента
      const md = await ConfigMarkdown.parse(item)
      if (!md.data) continue

      // Извлечение относительного пути из папки agent для поддержки вложенных агентов
      let agentName = path.basename(item, ".md")
      const agentFolderPath = item.includes("/.opencode/agent/")
        ? item.split("/.opencode/agent/")[1]
        : item.includes("/agent/")
          ? item.split("/agent/")[1]
          : agentName + ".md"

      // Если агент находится в подпапке, включить путь папки в имя (например, category/agent-name)
      if (agentFolderPath.includes("/")) {
        const relativePath = agentFolderPath.replace(".md", "")
        const pathParts = relativePath.split("/")
        agentName = pathParts.slice(0, -1).join("/") + "/" + pathParts[pathParts.length - 1]
      }

      // Формирование объекта конфигурации агента с содержимым markdown как системный промпт
      const config = {
        name: agentName,
        ...md.data,
        prompt: md.content.trim(),
      }
      // Валидация конфигурации агента с использованием Zod схемы
      const parsed = Agent.safeParse(config)
      if (parsed.success) {
        result[config.name] = parsed.data
        continue
      }
      throw new InvalidError({ path: item }, { cause: parsed.error })
    }
    return result
  }

  // Загрузка конфигурации режимов из markdown файлов (mode/*.md) - используется для обратной совместимости
  const MODE_GLOB = new Bun.Glob("mode/*.md")
  // Функция для чтения и парсинга режимов (deprecated, преобразуются в агентов с режимом "primary")
  async function loadMode(dir: string) {
    const result: Record<string, Agent> = {}
    for await (const item of MODE_GLOB.scan({
      absolute: true,
      followSymlinks: true,
      dot: true,
      cwd: dir,
    })) {
      // Парсинг markdown файла с конфигурацией режима
      const md = await ConfigMarkdown.parse(item)
      if (!md.data) continue

      // Формирование объекта конфигурации режима
      const config = {
        name: path.basename(item, ".md"),
        ...md.data,
        prompt: md.content.trim(),
      }
      // Валидация конфигурации режима (расширяет схему агента) и преобразование в агента
      const parsed = Agent.safeParse(config)
      if (parsed.success) {
        result[config.name] = {
          ...parsed.data,
          mode: "primary" as const,
        }
        continue
      }
    }
    return result
  }

  export const McpLocal = z
    .object({
      type: z.literal("local").describe("Type of MCP server connection"),
      command: z.string().array().describe("Command and arguments to run the MCP server"),
      environment: z
        .record(z.string(), z.string())
        .optional()
        .describe("Environment variables to set when running the MCP server"),
      enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
      timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Timeout in ms for fetching tools from the MCP server. Defaults to 5000 (5 seconds) if not specified.",
        ),
    })
    .strict()
    .meta({
      ref: "McpLocalConfig",
    })

  export const McpRemote = z
    .object({
      type: z.literal("remote").describe("Type of MCP server connection"),
      url: z.string().describe("URL of the remote MCP server"),
      enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
      headers: z.record(z.string(), z.string()).optional().describe("Headers to send with the request"),
      timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Timeout in ms for fetching tools from the MCP server. Defaults to 5000 (5 seconds) if not specified.",
        ),
    })
    .strict()
    .meta({
      ref: "McpRemoteConfig",
    })

  export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote])
  export type Mcp = z.infer<typeof Mcp>

  export const Permission = z.enum(["ask", "allow", "deny"])
  export type Permission = z.infer<typeof Permission>

  export const Command = z.object({
    template: z.string(),
    description: z.string().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
    subtask: z.boolean().optional(),
  })
  export type Command = z.infer<typeof Command>

  export const Agent = z
    .object({
      model: z.string().optional(),
      temperature: z.number().optional(),
      top_p: z.number().optional(),
      prompt: z.string().optional(),
      tools: z.record(z.string(), z.boolean()).optional(),
      disable: z.boolean().optional(),
      description: z.string().optional().describe("Description of when to use the agent"),
      mode: z.enum(["subagent", "primary", "all"]).optional(),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
        .optional()
        .describe("Hex color code for the agent (e.g., #FF5733)"),
      permission: z
        .object({
          edit: Permission.optional(),
          bash: z.union([Permission, z.record(z.string(), Permission)]).optional(),
          webfetch: Permission.optional(),
          doom_loop: Permission.optional(),
          external_directory: Permission.optional(),
        })
        .optional(),
    })
    .catchall(z.any())
    .meta({
      ref: "AgentConfig",
    })
  export type Agent = z.infer<typeof Agent>

  export const Keybinds = z
    .object({
      leader: z.string().optional().default("ctrl+x").describe("Leader key for keybind combinations"),
      app_exit: z.string().optional().default("ctrl+c,ctrl+d,<leader>q").describe("Exit the application"),
      editor_open: z.string().optional().default("<leader>e").describe("Open external editor"),
      theme_list: z.string().optional().default("<leader>t").describe("List available themes"),
      sidebar_toggle: z.string().optional().default("<leader>b").describe("Toggle sidebar"),
      status_view: z.string().optional().default("<leader>s").describe("View status"),
      session_export: z.string().optional().default("<leader>x").describe("Export session to editor"),
      session_new: z.string().optional().default("<leader>n").describe("Create a new session"),
      session_list: z.string().optional().default("<leader>l").describe("List all sessions"),
      session_timeline: z.string().optional().default("<leader>g").describe("Show session timeline"),
      session_interrupt: z.string().optional().default("escape").describe("Interrupt current session"),
      session_compact: z.string().optional().default("<leader>c").describe("Compact the session"),
      messages_page_up: z.string().optional().default("pageup").describe("Scroll messages up by one page"),
      messages_page_down: z.string().optional().default("pagedown").describe("Scroll messages down by one page"),
      messages_half_page_up: z.string().optional().default("ctrl+alt+u").describe("Scroll messages up by half page"),
      messages_half_page_down: z
        .string()
        .optional()
        .default("ctrl+alt+d")
        .describe("Scroll messages down by half page"),
      messages_first: z.string().optional().default("ctrl+g,home").describe("Navigate to first message"),
      messages_last: z.string().optional().default("ctrl+alt+g,end").describe("Navigate to last message"),
      messages_copy: z.string().optional().default("<leader>y").describe("Copy message"),
      messages_undo: z.string().optional().default("<leader>u").describe("Undo message"),
      messages_redo: z.string().optional().default("<leader>r").describe("Redo message"),
      messages_toggle_conceal: z
        .string()
        .optional()
        .default("<leader>h")
        .describe("Toggle code block concealment in messages"),
      model_list: z.string().optional().default("<leader>m").describe("List available models"),
      model_cycle_recent: z.string().optional().default("f2").describe("Next recently used model"),
      model_cycle_recent_reverse: z.string().optional().default("shift+f2").describe("Previous recently used model"),
      command_list: z.string().optional().default("ctrl+p").describe("List available commands"),
      agent_list: z.string().optional().default("<leader>a").describe("List agents"),
      agent_cycle: z.string().optional().default("tab").describe("Next agent"),
      agent_cycle_reverse: z.string().optional().default("shift+tab").describe("Previous agent"),
      input_clear: z.string().optional().default("ctrl+c").describe("Clear input field"),
      input_forward_delete: z.string().optional().default("ctrl+d").describe("Forward delete"),
      input_paste: z.string().optional().default("ctrl+v").describe("Paste from clipboard"),
      input_submit: z.string().optional().default("return").describe("Submit input"),
      input_newline: z.string().optional().default("shift+return,ctrl+j").describe("Insert newline in input"),
      history_previous: z.string().optional().default("up").describe("Previous history item"),
      history_next: z.string().optional().default("down").describe("Next history item"),
      session_child_cycle: z.string().optional().default("ctrl+right").describe("Next child session"),
      session_child_cycle_reverse: z.string().optional().default("ctrl+left").describe("Previous child session"),
    })
    .strict()
    .meta({
      ref: "KeybindsConfig",
    })

  export const TUI = z.object({
    scroll_speed: z.number().min(0.001).optional().default(1).describe("TUI scroll speed"),
    scroll_acceleration: z
      .object({
        enabled: z.boolean().describe("Enable scroll acceleration"),
      })
      .optional()
      .describe("Scroll acceleration settings"),
  })

  export const Layout = z.enum(["auto", "stretch"]).meta({
    ref: "LayoutConfig",
  })
  export type Layout = z.infer<typeof Layout>

  export const Info = z
    .object({
      $schema: z.string().optional().describe("JSON schema reference for configuration validation"),
      theme: z.string().optional().describe("Theme name to use for the interface"),
      keybinds: Keybinds.optional().describe("Custom keybind configurations"),
      tui: TUI.optional().describe("TUI specific settings"),
      command: z
        .record(z.string(), Command)
        .optional()
        .describe("Command configuration, see https://opencode.ai/docs/commands"),
      watcher: z
        .object({
          ignore: z.array(z.string()).optional(),
        })
        .optional(),
      snapshot: z.boolean().optional(),
      // share and autoshare fields removed - no sharing support
      autoupdate: z.boolean().optional().describe("Automatically update to the latest version"),
      disabled_providers: z.array(z.string()).optional().describe("Disable providers that are loaded automatically"),
      model: z.string().describe("Model to use in the format of provider/model, eg anthropic/claude-2").optional(),
      small_model: z
        .string()
        .describe("Small model to use for tasks like title generation in the format of provider/model")
        .optional(),
      username: z
        .string()
        .optional()
        .describe("Custom username to display in conversations instead of system username"),
      mode: z
        .object({
          build: Agent.optional(),
          plan: Agent.optional(),
        })
        .catchall(Agent)
        .optional()
        .describe("@deprecated Use `agent` field instead."),
      agent: z
        .object({
          plan: Agent.optional(),
          build: Agent.optional(),
          general: Agent.optional(),
        })
        .catchall(Agent)
        .optional()
        .describe("Agent configuration, see https://opencode.ai/docs/agent"),
      provider: z
        .record(
          z.string(),
          ModelsDev.Provider.partial()
            .extend({
              models: z.record(z.string(), ModelsDev.Model.partial()).optional(),
              options: z
                .object({
                  apiKey: z.string().optional(),
                  baseURL: z.string().optional(),
                  enterpriseUrl: z.string().optional().describe("GitHub Enterprise URL for copilot authentication"),
                  timeout: z
                    .union([
                      z
                        .number()
                        .int()
                        .positive()
                        .describe(
                          "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
                        ),
                      z.literal(false).describe("Disable timeout for this provider entirely."),
                    ])
                    .optional()
                    .describe(
                      "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
                    ),
                })
                .catchall(z.any())
                .optional(),
            })
            .strict(),
        )
        .optional()
        .describe("Custom provider configurations and model overrides"),
      mcp: z.record(z.string(), Mcp).optional().describe("MCP (Model Context Protocol) server configurations"),
      formatter: z
        .union([
          z.literal(false),
          z.record(
            z.string(),
            z.object({
              disabled: z.boolean().optional(),
              command: z.array(z.string()).optional(),
              environment: z.record(z.string(), z.string()).optional(),
              extensions: z.array(z.string()).optional(),
            }),
          ),
        ])
        .optional(),
      instructions: z.array(z.string()).optional().describe("Additional instruction files or patterns to include"),
      layout: Layout.optional().describe("@deprecated Always uses stretch layout."),
      permission: z
        .object({
          edit: Permission.optional(),
          bash: z.union([Permission, z.record(z.string(), Permission)]).optional(),
          webfetch: Permission.optional(),
          doom_loop: Permission.optional(),
          external_directory: Permission.optional(),
        })
        .optional(),
      tools: z.record(z.string(), z.boolean()).optional(),
      experimental: z
        .object({
          hook: z
            .object({
              file_edited: z
                .record(
                  z.string(),
                  z
                    .object({
                      command: z.string().array(),
                      environment: z.record(z.string(), z.string()).optional(),
                    })
                    .array(),
                )
                .optional(),
              session_completed: z
                .object({
                  command: z.string().array(),
                  environment: z.record(z.string(), z.string()).optional(),
                })
                .array()
                .optional(),
            })
            .optional(),
          chatMaxRetries: z.number().optional().describe("Number of retries for chat completions on failure"),
          disable_paste_summary: z.boolean().optional(),
          batch_tool: z.boolean().optional().describe("Enable the batch tool"),
        })
        .optional(),
    })
    .strict()
    .meta({
      ref: "Config",
    })

  export type Info = z.output<typeof Info>

  export const global = lazy(async () => {
    let result: Info = pipe(
      {},
      mergeDeep(await loadFile(path.join(Global.Path.config, "config.json"))),
      mergeDeep(await loadFile(path.join(Global.Path.config, "opencode.json"))),
      mergeDeep(await loadFile(path.join(Global.Path.config, "opencode.jsonc"))),
    )

    await import(path.join(Global.Path.config, "config"), {
      with: {
        type: "toml",
      },
    })
      .then(async (mod) => {
        const { provider, model, ...rest } = mod.default
        if (provider && model) result.model = `${provider}/${model}`
        result["$schema"] = "https://opencode.ai/config.json"
        result = mergeDeep(result, rest)
        await Bun.write(path.join(Global.Path.config, "config.json"), JSON.stringify(result, null, 2))
        await fs.unlink(path.join(Global.Path.config, "config"))
      })
      .catch(() => {})

    return result
  })

  // Загрузка конфигурационного файла по пути с обработкой ошибок ENOENT (файл не существует)
  async function loadFile(filepath: string): Promise<Info> {
    log.info("loading", { path: filepath })
    let text = await Bun.file(filepath)
      .text()
      .catch((err) => {
        // Игнорирование ошибки если файл не существует, выброс других ошибок
        if (err.code === "ENOENT") return
        throw new JsonError({ path: filepath }, { cause: err })
      })
    // Возврат пустой конфигурации если файл не найден
    if (!text) return {}
    return load(text, filepath)
  }

  // Парсинг содержимого конфигурационного файла с поддержкой подстановок переменных и файлов
  async function load(text: string, configFilepath: string) {
    // Подстановка переменных окружения в формате {env:VARIABLE_NAME}
    text = text.replace(/\{env:([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || ""
    })

    // Обработка включений файлов в формате {file:/path/to/file}
    const fileMatches = text.match(/\{file:[^}]+\}/g)
    if (fileMatches) {
      const configDir = path.dirname(configFilepath)
      const lines = text.split("\n")

      for (const match of fileMatches) {
        const lineIndex = lines.findIndex((line) => line.includes(match))
        // Пропуск обработки если строка закомментирована
        if (lineIndex !== -1 && lines[lineIndex].trim().startsWith("//")) {
          continue
        }
        // Извлечение пути из синтаксиса {file:...}
        let filePath = match.replace(/^\{file:/, "").replace(/\}$/, "")
        // Поддержка домашней директории (~/)
        if (filePath.startsWith("~/")) {
          filePath = path.join(os.homedir(), filePath.slice(2))
        }
        // Разрешение относительных путей относительно директории конфигурации
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(configDir, filePath)
        const fileContent = (
          await Bun.file(resolvedPath)
            .text()
            .catch((error) => {
              const errMsg = `bad file reference: "${match}"`
              if (error.code === "ENOENT") {
                throw new InvalidError(
                  {
                    path: configFilepath,
                    message: errMsg + ` ${resolvedPath} does not exist`,
                  },
                  { cause: error },
                )
              }
              throw new InvalidError({ path: configFilepath, message: errMsg }, { cause: error })
            })
        ).trim()
        // Экранирование переводов строк и кавычек в JSON строке
        text = text.replace(match, JSON.stringify(fileContent).slice(1, -1))
      }
    }

    // Парсинг JSONC (JSON with Comments) с поддержкой комментариев и запятых в конце
    const errors: JsoncParseError[] = []
    const data = parseJsonc(text, errors, { allowTrailingComma: true })
    // Обработка ошибок парсинга с отображением номеров строк и колонок
    if (errors.length) {
      const lines = text.split("\n")
      const errorDetails = errors
        .map((e) => {
          const beforeOffset = text.substring(0, e.offset).split("\n")
          const line = beforeOffset.length
          const column = beforeOffset[beforeOffset.length - 1].length + 1
          const problemLine = lines[line - 1]

          const error = `${printParseErrorCode(e.error)} at line ${line}, column ${column}`
          if (!problemLine) return error

          return `${error}\n   Line ${line}: ${problemLine}\n${"".padStart(column + 9)}^`
        })
        .join("\n")

      throw new JsonError({
        path: configFilepath,
        message: `\n--- JSONC Input ---\n${text}\n--- Errors ---\n${errorDetails}\n--- End ---`,
      })
    }

    // Валидация распарсенных данных с использованием Zod схемы Info
    const parsed = Info.safeParse(data)
    if (parsed.success) {
      // Добавление ссылки на JSON schema если её нет, и сохранение в файл
      if (!parsed.data.$schema) {
        parsed.data.$schema = "https://opencode.ai/config.json"
        await Bun.write(configFilepath, JSON.stringify(parsed.data, null, 2))
      }
      const data = parsed.data
      return data
    }

    // Выброс ошибки валидации с детальной информацией о проблемах
    throw new InvalidError({
      path: configFilepath,
      issues: parsed.error.issues,
    })
  }
  // Ошибка парсинга JSON/JSONC конфигурационного файла
  export const JsonError = NamedError.create(
    "ConfigJsonError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
    }),
  )

  // Ошибка валидации структуры директории конфигурации (обнаружены опечатки в названиях папок)
  export const ConfigDirectoryTypoError = NamedError.create(
    "ConfigDirectoryTypoError",
    z.object({
      path: z.string(),
      dir: z.string(),
      suggestion: z.string(),
    }),
  )

  // Ошибка валидации схемы конфигурации (не соответствует Zod схеме)
  export const InvalidError = NamedError.create(
    "ConfigInvalidError",
    z.object({
      path: z.string(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
      message: z.string().optional(),
    }),
  )

  // Получение текущей активной конфигурации
  export async function get() {
    return state().then((x) => x.config)
  }

  // Обновление конфигурации путём глубокого объединения с существующей и сохранением в файл
  export async function update(config: Info) {
    const filepath = path.join(Instance.directory, "config.json")
    const existing = await loadFile(filepath)
    await Bun.write(filepath, JSON.stringify(mergeDeep(existing, config), null, 2))
    await Instance.dispose()
  }

  // Получение списка всех активных директорий конфигурации
  export async function directories() {
    return state().then((x) => x.directories)
  }
}
