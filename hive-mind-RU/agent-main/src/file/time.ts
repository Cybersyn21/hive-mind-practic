import { Instance } from "../project/instance"
import { Log } from "../util/log"

// Пространство имен для отслеживания времени чтения файлов
// Используется для предотвращения перезаписи файлов, которые были изменены после последнего чтения
export namespace FileTime {
  const log = Log.create({ service: "file.time" })

  // Состояние для хранения времени последнего чтения файлов для каждой сессии
  // Структура: sessionID -> filepath -> Date когда файл был прочитан
  export const state = Instance.state(() => {
    const read: {
      [sessionID: string]: {
        [path: string]: Date | undefined
      }
    } = {}
    return {
      read,
    }
  })

  // Записывает время чтения файла для заданной сессии
  // Вызывается каждый раз, когда инструмент Read читает файл
  export function read(sessionID: string, file: string) {
    log.info("read", { sessionID, file })
    const { read } = state()
    read[sessionID] = read[sessionID] || {}
    read[sessionID][file] = new Date()
  }

  // Получает время последнего чтения файла в заданной сессии
  // Возвращает Date или undefined, если файл не был прочитан
  export function get(sessionID: string, file: string) {
    return state().read[sessionID]?.[file]
  }

  // Проверяет, что файл был прочитан и не был изменен с момента последнего чтения
  // Выбрасывает ошибку, если файл не был прочитан или был изменен
  // Используется перед записью в файл для предотвращения потери изменений
  export async function assert(sessionID: string, filepath: string) {
    const time = get(sessionID, filepath)
    // Проверяем, что файл был прочитан в этой сессии
    if (!time) throw new Error(`You must read the file ${filepath} before overwriting it. Use the Read tool first`)
    // Проверяем время последней модификации файла на диске
    const stats = await Bun.file(filepath).stat()
    // Если файл был изменен после последнего чтения, выбрасываем ошибку
    if (stats.mtime.getTime() > time.getTime()) {
      throw new Error(
        `File ${filepath} has been modified since it was last read.\nLast modification: ${stats.mtime.toISOString()}\nLast read: ${time.toISOString()}\n\nPlease read the file again before modifying it.`,
      )
    }
  }
}
