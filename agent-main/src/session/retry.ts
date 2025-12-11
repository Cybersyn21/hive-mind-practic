import { iife } from "../util/iife"
import { MessageV2 } from "./message-v2"

// Пространство имен для управления повторными попытками выполнения запросов к API
export namespace SessionRetry {
  // Начальная задержка перед первой повторной попыткой (2 секунды)
  export const RETRY_INITIAL_DELAY = 2000
  // Коэффициент экспоненциального увеличения задержки между попытками
  export const RETRY_BACKOFF_FACTOR = 2
  // Максимальная задержка когда заголовки retry-after отсутствуют (30 секунд)
  export const RETRY_MAX_DELAY_NO_HEADERS = 30_000 // 30 seconds

  // Асинхронная функция ожидания с поддержкой прерывания через AbortSignal
  // ms - количество миллисекунд для ожидания
  // signal - сигнал для прерывания ожидания
  export async function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms)
      // Добавляем обработчик прерывания
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout)
          reject(new DOMException("Aborted", "AbortError"))
        },
        { once: true },
      )
    })
  }

  // Вычисляет задержку перед следующей попыткой на основе ошибки API и номера попытки
  // error - объект ошибки API с заголовками ответа
  // attempt - номер текущей попытки (начиная с 1)
  // Возвращает количество миллисекунд для ожидания
  export function delay(error: MessageV2.APIError, attempt: number) {
    const headers = error.data.responseHeaders
    if (headers) {
      // Проверяем наличие заголовка retry-after-ms (задержка в миллисекундах)
      const retryAfterMs = headers["retry-after-ms"]
      if (retryAfterMs) {
        const parsedMs = Number.parseFloat(retryAfterMs)
        if (!Number.isNaN(parsedMs)) {
          return parsedMs
        }
      }

      // Проверяем наличие стандартного заголовка retry-after (в секундах или HTTP-дате)
      const retryAfter = headers["retry-after"]
      if (retryAfter) {
        // Пытаемся разобрать как число секунд
        const parsedSeconds = Number.parseFloat(retryAfter)
        if (!Number.isNaN(parsedSeconds)) {
          // convert seconds to milliseconds
          return Math.ceil(parsedSeconds * 1000)
        }
        // Пытаемся разобрать как HTTP-дату и вычисляем разницу с текущим временем
        // Try parsing as HTTP date format
        const parsed = Date.parse(retryAfter) - Date.now()
        if (!Number.isNaN(parsed) && parsed > 0) {
          return Math.ceil(parsed)
        }
      }

      // Если заголовки присутствуют но не содержат retry-after, используем экспоненциальную задержку
      return RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1)
    }

    // Если заголовков нет, используем экспоненциальную задержку с максимальным ограничением
    return Math.min(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1), RETRY_MAX_DELAY_NO_HEADERS)
  }
}
