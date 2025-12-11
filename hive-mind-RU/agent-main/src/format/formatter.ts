import { readableStreamToText } from "bun"
import { BunProc } from "../bun"
import { Instance } from "../project/instance"
import { Filesystem } from "../util/filesystem"

// Интерфейс Info определяет конфигурацию форматтера кода
// Содержит информацию о команде, поддерживаемых расширениях и проверке доступности
export interface Info {
  name: string                            // Имя форматтера
  command: string[]                       // Команда для запуска форматтера (может содержать $FILE плейсхолдер)
  environment?: Record<string, string>    // Переменные окружения для процесса форматтера
  extensions: string[]                    // Расширения файлов, которые поддерживает этот форматтер
  enabled(): Promise<boolean>             // Асинхронная функция проверки доступности форматтера
}

// Форматтер для Go кода (встроенный в Go)
// Проверяет наличие команды gofmt в PATH
export const gofmt: Info = {
  name: "gofmt",
  command: ["gofmt", "-w", "$FILE"],
  extensions: [".go"],
  async enabled() {
    return Bun.which("gofmt") !== null
  },
}

// Форматтер для Elixir кода (встроенный в Mix)
// Проверяет наличие команды mix в PATH
export const mix: Info = {
  name: "mix",
  command: ["mix", "format", "$FILE"],
  extensions: [".ex", ".exs", ".eex", ".heex", ".leex", ".neex", ".sface"],
  async enabled() {
    return Bun.which("mix") !== null
  },
}

// Форматтер Prettier для JavaScript/TypeScript и других языков
// Проверяет наличие prettier в зависимостях package.json
// BUN_BE_BUN=1 переменная окружения используется для оптимизации Bun
export const prettier: Info = {
  name: "prettier",
  command: [BunProc.which(), "x", "prettier", "--write", "$FILE"],
  environment: {
    BUN_BE_BUN: "1",
  },
  extensions: [
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".vue",
    ".svelte",
    ".json",
    ".jsonc",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".md",
    ".mdx",
    ".graphql",
    ".gql",
  ],
  async enabled() {
    // Ищет package.json в проекте и проверяет наличие prettier в зависимостях
    const items = await Filesystem.findUp("package.json", Instance.directory, Instance.worktree)
    for (const item of items) {
      const json = await Bun.file(item).json()
      if (json.dependencies?.prettier) return true
      if (json.devDependencies?.prettier) return true
    }
    return false
  },
}

// Форматтер Biome (современная альтернатива Prettier/ESLint)
// Проверяет наличие конфигурационных файлов biome.json или biome.jsonc
export const biome: Info = {
  name: "biome",
  command: [BunProc.which(), "x", "@biomejs/biome", "format", "--write", "$FILE"],
  environment: {
    BUN_BE_BUN: "1",
  },
  extensions: [
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".vue",
    ".svelte",
    ".json",
    ".jsonc",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".md",
    ".mdx",
    ".graphql",
    ".gql",
  ],
  async enabled() {
    // Ищет конфигурационные файлы Biome в проекте
    const configs = ["biome.json", "biome.jsonc"]
    for (const config of configs) {
      const found = await Filesystem.findUp(config, Instance.directory, Instance.worktree)
      if (found.length > 0) {
        return true
      }
    }
    return false
  },
}

// Форматтер для языка Zig (встроенный в Zig)
// Проверяет наличие команды zig в PATH
export const zig: Info = {
  name: "zig",
  command: ["zig", "fmt", "$FILE"],
  extensions: [".zig", ".zon"],
  async enabled() {
    return Bun.which("zig") !== null
  },
}

// Форматтер clang-format для C/C++ кода
// Проверяет наличие конфигурационного файла .clang-format в проекте
export const clang: Info = {
  name: "clang-format",
  command: ["clang-format", "-i", "$FILE"],
  extensions: [".c", ".cc", ".cpp", ".cxx", ".c++", ".h", ".hh", ".hpp", ".hxx", ".h++", ".ino", ".C", ".H"],
  async enabled() {
    // Ищет файл .clang-format для конфигурации форматера
    const items = await Filesystem.findUp(".clang-format", Instance.directory, Instance.worktree)
    return items.length > 0
  },
}

// Форматтер ktlint для языка Kotlin
// Проверяет наличие команды ktlint в PATH
export const ktlint: Info = {
  name: "ktlint",
  command: ["ktlint", "-F", "$FILE"],
  extensions: [".kt", ".kts"],
  async enabled() {
    return Bun.which("ktlint") !== null
  },
}

// Форматтер Ruff для Python кода (современная альтернатива Black)
// Проверяет наличие ruff команды и конфигурационных файлов или зависимостей
export const ruff: Info = {
  name: "ruff",
  command: ["ruff", "format", "$FILE"],
  extensions: [".py", ".pyi"],
  async enabled() {
    // Проверяет наличие команды ruff
    if (!Bun.which("ruff")) return false
    // Ищет конфигурационные файлы Ruff
    const configs = ["pyproject.toml", "ruff.toml", ".ruff.toml"]
    for (const config of configs) {
      const found = await Filesystem.findUp(config, Instance.directory, Instance.worktree)
      if (found.length > 0) {
        if (config === "pyproject.toml") {
          // Проверяет наличие секции [tool.ruff] в pyproject.toml
          const content = await Bun.file(found[0]).text()
          if (content.includes("[tool.ruff]")) return true
        } else {
          return true
        }
      }
    }
    // Проверяет зависимости проекта на наличие ruff
    const deps = ["requirements.txt", "pyproject.toml", "Pipfile"]
    for (const dep of deps) {
      const found = await Filesystem.findUp(dep, Instance.directory, Instance.worktree)
      if (found.length > 0) {
        const content = await Bun.file(found[0]).text()
        if (content.includes("ruff")) return true
      }
    }
    return false
  },
}

// Форматтер Air для языка R (R language server и форматер)
// Выполняет проверку команды и верификацию через вывод --help
export const rlang: Info = {
  name: "air",
  command: ["air", "format", "$FILE"],
  extensions: [".R"],
  async enabled() {
    // Проверяет наличие команды air в PATH
    const airPath = Bun.which("air")
    if (airPath == null) return false

    try {
      // Запускает air --help для проверки, что это R language formatter
      const proc = Bun.spawn(["air", "--help"], {
        stdout: "pipe",
        stderr: "pipe",
      })
      await proc.exited
      const output = await readableStreamToText(proc.stdout)

      // Проверяет строку "Air: An R language server and formatter" в выводе
      // Check for "Air: An R language server and formatter"
      const firstLine = output.split("\n")[0]
      const hasR = firstLine.includes("R language")
      const hasFormatter = firstLine.includes("formatter")
      return hasR && hasFormatter
    } catch (error) {
      return false
    }
  },
}

// Форматтер uv format для Python кода (встроенный в uv package manager)
// Используется только если Ruff недоступен (предпочтение к Ruff)
export const uvformat: Info = {
  name: "uv format",
  command: ["uv", "format", "--", "$FILE"],
  extensions: [".py", ".pyi"],
  async enabled() {
    // Если доступен Ruff, то uv format не используется (Ruff имеет приоритет)
    if (await ruff.enabled()) return false
    // Проверяет наличие команды uv и поддержку format подкоманды
    if (Bun.which("uv") !== null) {
      const proc = Bun.spawn(["uv", "format", "--help"], { stderr: "pipe", stdout: "pipe" })
      const code = await proc.exited
      return code === 0
    }
    return false
  },
}

// Форматтер rubocop для языка Ruby (linter + formatter)
// Проверяет наличие команды rubocop в PATH
export const rubocop: Info = {
  name: "rubocop",
  command: ["rubocop", "--autocorrect", "$FILE"],
  extensions: [".rb", ".rake", ".gemspec", ".ru"],
  async enabled() {
    return Bun.which("rubocop") !== null
  },
}

// Форматтер standardrb для языка Ruby (альтернатива rubocop, более строгий стандарт)
// Проверяет наличие команды standardrb в PATH
export const standardrb: Info = {
  name: "standardrb",
  command: ["standardrb", "--fix", "$FILE"],
  extensions: [".rb", ".rake", ".gemspec", ".ru"],
  async enabled() {
    return Bun.which("standardrb") !== null
  },
}

// Форматтер htmlbeautifier для ERB (Embedded Ruby) шаблонов
// Проверяет наличие команды htmlbeautifier в PATH
export const htmlbeautifier: Info = {
  name: "htmlbeautifier",
  command: ["htmlbeautifier", "$FILE"],
  extensions: [".erb", ".html.erb"],
  async enabled() {
    return Bun.which("htmlbeautifier") !== null
  },
}
