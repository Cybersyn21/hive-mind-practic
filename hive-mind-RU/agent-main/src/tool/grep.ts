import z from "zod"
import { Tool } from "./tool"
import { Ripgrep } from "../file/ripgrep"

import DESCRIPTION from "./grep.txt"
import { Instance } from "../project/instance"

// Инструмент Grep для поиска текста в файлах по регулярному выражению (regex)
// Использует ripgrep (rg) для высокоскоростного поиска с поддержкой фильтрации по расширениям файлов
// Возвращает совпадения отсортированные по времени изменения файла, ограничены 100 результатами

export const GrepTool = Tool.define("grep", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The regex pattern to search for in file contents"),
    path: z.string().optional().describe("The directory to search in. Defaults to the current working directory."),
    include: z.string().optional().describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
  }),
  async execute(params) {
    // Проверяем обязательный параметр - регулярное выражение для поиска
    if (!params.pattern) {
      throw new Error("pattern is required")
    }

    // Определяем директорию для поиска - используем указанную или текущую рабочую директорию
    const searchPath = params.path || Instance.directory

    // Получаем путь к исполняемому файлу ripgrep
    const rgPath = await Ripgrep.filepath()

    // Готовим аргументы для ripgrep:
    // -nH: показывать номера строк и имена файлов
    // --field-match-separator=|: использовать | в качестве разделителя полей для парсинга
    // --regexp: указывает что далее идет регулярное выражение
    const args = ["-nH", "--field-match-separator=|", "--regexp", params.pattern]

    // Добавляем фильтр по расширению файлов если указан
    if (params.include) {
      args.push("--glob", params.include)
    }

    // Добавляем путь поиска
    args.push(searchPath)

    // Запускаем ripgrep процесс с перенаправлением вывода
    const proc = Bun.spawn([rgPath, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })

    // Читаем стандартный вывод и ошибки из процесса
    const output = await new Response(proc.stdout).text()
    const errorOutput = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    // Exit code 1 означает что не было найдено совпадений
    if (exitCode === 1) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: "No files found",
      }
    }

    // Проверяем на другие ошибки
    if (exitCode !== 0) {
      throw new Error(`ripgrep failed: ${errorOutput}`)
    }

    // Парсим вывод ripgrep разделенный по строкам
    const lines = output.trim().split("\n")
    const matches = []

    // Обрабатываем каждую строку результата
    for (const line of lines) {
      if (!line) continue

      // Парсим формат: filePath|lineNum|lineText
      const [filePath, lineNumStr, ...lineTextParts] = line.split("|")
      if (!filePath || !lineNumStr || lineTextParts.length === 0) continue

      const lineNum = parseInt(lineNumStr, 10)
      // Восстанавливаем текст строки (может содержать | внутри)
      const lineText = lineTextParts.join("|")

      // Получаем информацию о файле (время изменения)
      const file = Bun.file(filePath)
      const stats = await file.stat().catch(() => null)
      if (!stats) continue

      matches.push({
        path: filePath,
        modTime: stats.mtime.getTime(),
        lineNum,
        lineText,
      })
    }

    // Сортируем совпадения по времени изменения файла (новые сверху)
    matches.sort((a, b) => b.modTime - a.modTime)

    // Применяем лимит результатов для оптимизации производительности
    const limit = 100
    const truncated = matches.length > limit
    const finalMatches = truncated ? matches.slice(0, limit) : matches

    // Обработка отсутствия результатов после лимитирования
    if (finalMatches.length === 0) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: "No files found",
      }
    }

    // Формируем вывод результатов, группируя по файлам
    const outputLines = [`Found ${finalMatches.length} matches`]

    let currentFile = ""
    for (const match of finalMatches) {
      // Добавляем новый заголовок файла при переходе на другой файл
      if (currentFile !== match.path) {
        if (currentFile !== "") {
          outputLines.push("") // Пустая строка для разделения файлов
        }
        currentFile = match.path
        outputLines.push(`${match.path}:`)
      }
      // Добавляем информацию о совпадении с номером строки
      outputLines.push(`  Line ${match.lineNum}: ${match.lineText}`)
    }

    // Информируем пользователя если результаты усечены
    if (truncated) {
      outputLines.push("")
      outputLines.push("(Results are truncated. Consider using a more specific path or pattern.)")
    }

    return {
      title: params.pattern,
      metadata: {
        matches: finalMatches.length,
        truncated,
      },
      output: outputLines.join("\n"),
    }
  },
})
