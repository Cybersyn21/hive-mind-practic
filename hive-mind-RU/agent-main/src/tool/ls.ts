import z from "zod"
import { Tool } from "./tool"
import * as path from "path"
import DESCRIPTION from "./ls.txt"
import { Instance } from "../project/instance"
import { Ripgrep } from "../file/ripgrep"

// Паттерны директорий которые по умолчанию игнорируются при листинге
// Исключает служебные директории, кеши, зависимости и build артефакты
export const IGNORE_PATTERNS = [
  "node_modules/", // Зависимости Node.js
  "__pycache__/", // Кеш Python
  ".git/", // Git репозиторий
  "dist/", // Директория сборки
  "build/", // Директория сборки
  "target/", // Директория сборки Rust/Java
  "vendor/", // Зависимости (Go, PHP)
  "bin/", // Бинарные файлы
  "obj/", // Объектные файлы
  ".idea/", // Настройки IntelliJ IDEA
  ".vscode/", // Настройки VS Code
  ".zig-cache/", // Кеш Zig
  "zig-out", // Выходная директория Zig
  ".coverage", // Отчеты покрытия тестами
  "coverage/", // Отчеты покрытия тестами
  "vendor/", // Дублирование для разных языков
  "tmp/", // Временные файлы
  "temp/", // Временные файлы
  ".cache/", // Кеш
  "cache/", // Кеш
  "logs/", // Логи
  ".venv/", // Виртуальное окружение Python
  "venv/", // Виртуальное окружение Python
  "env/", // Переменные окружения
]

// Максимальное количество файлов для отображения
const LIMIT = 100

// Инструмент для отображения структуры директорий в древовидном формате
// Игнорирует служебные директории и ограничивает количество файлов для производительности
export const ListTool = Tool.define("list", {
  description: DESCRIPTION,
  parameters: z.object({
    path: z.string().describe("The absolute path to the directory to list (must be absolute, not relative)").optional(),
    ignore: z.array(z.string()).describe("List of glob patterns to ignore").optional(),
  }),
  async execute(params) {
    // Разрешаем путь относительно рабочей директории
    const searchPath = path.resolve(Instance.directory, params.path || ".")

    // Комбинируем стандартные и пользовательские паттерны игнорирования
    const ignoreGlobs = IGNORE_PATTERNS.map((p) => `!${p}*`).concat(params.ignore?.map((p) => `!${p}`) || [])
    const files = []
    // Используем ripgrep для эффективного поиска файлов
    for await (const file of Ripgrep.files({ cwd: searchPath, glob: ignoreGlobs })) {
      files.push(file)
      if (files.length >= LIMIT) break
    }

    // Строим структуру директорий
    // Build directory structure
    const dirs = new Set<string>()
    const filesByDir = new Map<string, string[]>()

    for (const file of files) {
      const dir = path.dirname(file)
      const parts = dir === "." ? [] : dir.split("/")

      // Добавляем все родительские директории
      // Add all parent directories
      for (let i = 0; i <= parts.length; i++) {
        const dirPath = i === 0 ? "." : parts.slice(0, i).join("/")
        dirs.add(dirPath)
      }

      // Добавляем файл в его директорию
      // Add file to its directory
      if (!filesByDir.has(dir)) filesByDir.set(dir, [])
      filesByDir.get(dir)!.push(path.basename(file))
    }

    // Рекурсивно отрисовывает директорию и её содержимое
    function renderDir(dirPath: string, depth: number): string {
      const indent = "  ".repeat(depth)
      let output = ""

      if (depth > 0) {
        output += `${indent}${path.basename(dirPath)}/\n`
      }

      const childIndent = "  ".repeat(depth + 1)
      const children = Array.from(dirs)
        .filter((d) => path.dirname(d) === dirPath && d !== dirPath)
        .sort()

      // Сначала отрисовываем поддиректории
      // Render subdirectories first
      for (const child of children) {
        output += renderDir(child, depth + 1)
      }

      // Затем отрисовываем файлы
      // Render files
      const files = filesByDir.get(dirPath) || []
      for (const file of files.sort()) {
        output += `${childIndent}${file}\n`
      }

      return output
    }

    const output = `${searchPath}/\n` + renderDir(".", 0)

    return {
      title: path.relative(Instance.worktree, searchPath),
      metadata: {
        count: files.length,
        truncated: files.length >= LIMIT, // Указывает что список был обрезан
      },
      output,
    }
  },
})
