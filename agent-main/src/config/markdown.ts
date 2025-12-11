import { NamedError } from "../util/error"
import matter from "gray-matter"
import { z } from "zod"

// Модуль для работы с markdown конфигурациями и шаблонами
// Обрабатывает специальные синтаксисы для ссылок на файлы и shell команды
export namespace ConfigMarkdown {
  // Regex для поиска файловых ссылок в формате @path/to/file
  // Используется в шаблонах команд для автоматического включения файлов
  export const FILE_REGEX = /(?<![\w`])@(\.?[^\s`,.]*(?:\.[^\s`,.]+)*)/g

  // Regex для поиска shell команд в формате !`command`
  // Используется для выполнения команд и включения их вывода в промпт
  export const SHELL_REGEX = /!`([^`]+)`/g

  // Извлечь все файловые ссылки из шаблона
  // Возвращает массив совпадений regex
  export function files(template: string) {
    return Array.from(template.matchAll(FILE_REGEX))
  }

  // Извлечь все shell команды из шаблона
  // Возвращает массив совпадений regex
  export function shell(template: string) {
    return Array.from(template.matchAll(SHELL_REGEX))
  }

  // Парсить markdown файл с YAML frontmatter
  // Frontmatter используется для метаданных команды (agent, model, и т.д.)
  export async function parse(filePath: string) {
    const template = await Bun.file(filePath).text()

    try {
      const md = matter(template)
      return md
    } catch (err) {
      throw new FrontmatterError(
        {
          path: filePath,
          message: `Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`,
        },
        { cause: err },
      )
    }
  }

  // Ошибка парсинга frontmatter
  export const FrontmatterError = NamedError.create(
    "ConfigFrontmatterError",
    z.object({
      path: z.string(), // Путь к файлу
      message: z.string(), // Сообщение об ошибке
    }),
  )
}
