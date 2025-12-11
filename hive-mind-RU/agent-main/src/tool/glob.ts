import z from "zod"
import path from "path"
import { Tool } from "./tool"
import DESCRIPTION from "./glob.txt"
import { Ripgrep } from "../file/ripgrep"
import { Instance } from "../project/instance"

// Инструмент Glob для поиска файлов по шаблону глоба (glob pattern)
// Использует ripgrep для быстрого поиска файлов, возвращает результаты отсортированные по времени изменения
// Результаты ограничены 100 файлами для оптимизации производительности

export const GlobTool = Tool.define("glob", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The glob pattern to match files against"),
    path: z
      .string()
      .optional()
      .describe(
        `The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.`,
      ),
  }),
  async execute(params) {
    // Определяем директорию для поиска - используем указанную или текущую рабочую директорию
    let search = params.path ?? Instance.directory
    // Преобразуем относительный путь в абсолютный
    search = path.isAbsolute(search) ? search : path.resolve(Instance.directory, search)

    // Ограничение результатов для оптимизации производительности
    const limit = 100
    const files = []
    let truncated = false

    // Используем ripgrep для эффективного поиска файлов по шаблону
    for await (const file of Ripgrep.files({
      cwd: search,
      glob: [params.pattern],
    })) {
      // Прерываем поиск при достижении лимита
      if (files.length >= limit) {
        truncated = true
        break
      }

      // Получаем полный путь и время последнего изменения файла
      const full = path.resolve(search, file)
      const stats = await Bun.file(full)
        .stat()
        .then((x) => x.mtime.getTime())
        .catch(() => 0) // Обрабатываем ошибку при недоступности файла
      files.push({
        path: full,
        mtime: stats,
      })
    }

    // Сортируем файлы по времени изменения (новые сверху)
    files.sort((a, b) => b.mtime - a.mtime)

    // Формируем вывод результатов
    const output = []
    if (files.length === 0) output.push("No files found")
    if (files.length > 0) {
      // Добавляем пути всех найденных файлов
      output.push(...files.map((f) => f.path))
      // Информируем пользователя если результаты усечены
      if (truncated) {
        output.push("")
        output.push("(Results are truncated. Consider using a more specific path or pattern.)")
      }
    }

    return {
      title: path.relative(Instance.worktree, search),
      metadata: {
        count: files.length,
        truncated,
      },
      output: output.join("\n"),
    }
  },
})
