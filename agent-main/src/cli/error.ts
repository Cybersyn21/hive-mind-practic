import { ConfigMarkdown } from "../config/markdown"
import { Config } from "../config/config"
import { MCP } from "../mcp"
import { UI } from "./ui"

// Форматирование известных типов ошибок в user-friendly сообщения
// Возвращает строку с описанием ошибки или undefined для неизвестных типов
export function FormatError(input: unknown) {
  // Ошибка подключения к MCP серверу
  if (MCP.Failed.isInstance(input))
    return `MCP server "${input.data.name}" failed. Note, opencode does not support MCP authentication yet.`

  // Ошибка парсинга JSON конфигурации
  if (Config.JsonError.isInstance(input)) {
    return (
      `Config file at ${input.data.path} is not valid JSON(C)` + (input.data.message ? `: ${input.data.message}` : "")
    )
  }

  // Ошибка опечатки в директории конфигурации
  if (Config.ConfigDirectoryTypoError.isInstance(input)) {
    return `Directory "${input.data.dir}" in ${input.data.path} is not valid. Use "${input.data.suggestion}" instead. This is a common typo.`
  }

  // Ошибка парсинга YAML frontmatter в markdown файлах
  if (ConfigMarkdown.FrontmatterError.isInstance(input)) {
    return `Failed to parse frontmatter in ${input.data.path}:\n${input.data.message}`
  }

  // Ошибка валидации конфигурации
  if (Config.InvalidError.isInstance(input))
    return [
      `Config file at ${input.data.path} is invalid` + (input.data.message ? `: ${input.data.message}` : ""),
      // Добавляем подробности о каждой проблеме валидации
      ...(input.data.issues?.map((issue) => "↳ " + issue.message + " " + issue.path.join(".")) ?? []),
    ].join("\n")

  // Операция отменена пользователем (не выводим ошибку)
  if (UI.CancelledError.isInstance(input)) return ""
}
