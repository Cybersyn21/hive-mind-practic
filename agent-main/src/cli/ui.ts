import { NamedError } from "../util/error"
import z from "zod"

// UI модуль для управления терминальным выводом с форматированием и цветами
export namespace UI {
  // Коды ANSI для цветов и стилей текста в терминале
  // ANSI color codes for terminal output
  export const Style = {
    TEXT_NORMAL: "\x1b[0m",           // Обычный текст без форматирования
    TEXT_BOLD: "\x1b[1m",             // Жирный текст
    TEXT_DIM: "\x1b[2m",              // Приглушённый текст
    TEXT_DANGER_BOLD: "\x1b[1;31m",   // Жирный красный текст (ошибки)
    TEXT_SUCCESS_BOLD: "\x1b[1;32m",  // Жирный зелёный текст (успех)
    TEXT_WARNING_BOLD: "\x1b[1;33m",  // Жирный жёлтый текст (предупреждения)
    TEXT_INFO_BOLD: "\x1b[1;34m",     // Жирный синий текст (информация)
    TEXT_HIGHLIGHT_BOLD: "\x1b[1;35m",// Жирный пурпурный текст (выделение)
    TEXT_DIM_BOLD: "\x1b[1;90m",      // Жирный серый текст (слабое выделение)
  } as const

  // Ошибка для отменённых операций (например, Ctrl+C при вводе)
  // Error for cancelled operations (e.g., Ctrl+C in prompts)
  export const CancelledError = NamedError.create(
    "CancelledError",
    z.object({})
  )

  // Выводит пустую строку на стандартный поток ошибок
  // Print an empty line
  export function empty() {
    process.stderr.write("\n")
  }

  // Выводит строку с применённым форматированием и добавляет символ новой строки
  // Аргументы объединяются в одну строку перед выводом
  // Print a line with optional formatting
  export function println(...args: string[]) {
    process.stderr.write(args.join("") + Style.TEXT_NORMAL + "\n")
  }

  // Выводит сообщение об ошибке красным жирным цветом с префиксом "Error: "
  // Print an error message
  export function error(message: string) {
    process.stderr.write(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message + "\n")
  }

  // Выводит сообщение об успехе зелёным жирным цветом с префиксом "Success: "
  // Print a success message
  export function success(message: string) {
    process.stderr.write(Style.TEXT_SUCCESS_BOLD + "Success: " + Style.TEXT_NORMAL + message + "\n")
  }

  // Выводит информационное сообщение синим жирным цветом с префиксом "Info: "
  // Print an info message
  export function info(message: string) {
    process.stderr.write(Style.TEXT_INFO_BOLD + "Info: " + Style.TEXT_NORMAL + message + "\n")
  }

  // Преобразует базовый markdown-синтаксис в ANSI-коды для форматирования в терминале
  // Поддерживает: **текст** для жирного, `код` для приглушённого текста
  // Basic markdown rendering for terminal
  export function markdown(text: string): string {
    // Простое преобразование markdown в ANSI-коды
    // Simple markdown to ANSI conversion
    let result = text

    // Жирный текст: **текст** или __текст__
    // Bold text: **text** or __text__
    result = result.replace(/\*\*(.+?)\*\*/g, Style.TEXT_BOLD + "$1" + Style.TEXT_NORMAL)
    result = result.replace(/__(.+?)__/g, Style.TEXT_BOLD + "$1" + Style.TEXT_NORMAL)

    // Блоки кода: `код`
    // Code blocks: `code`
    result = result.replace(/`([^`]+)`/g, Style.TEXT_DIM + "$1" + Style.TEXT_NORMAL)

    return result
  }
}
