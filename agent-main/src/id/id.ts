import z from "zod"
import { randomBytes } from "crypto"

// Пространство имен для генерации уникальных идентификаторов
// Генерирует ID формата: префикс_временнаяметка_случайнаястрока
export namespace Identifier {
  // Префиксы для разных типов сущностей
  const prefixes = {
    session: "ses", // Сессии
    message: "msg", // Сообщения
    permission: "per", // Разрешения
    user: "usr", // Пользователи
    part: "prt", // Части сообщений
  } as const

  // Создает Zod схему для валидации ID с заданным префиксом
  export function schema(prefix: keyof typeof prefixes) {
    return z.string().startsWith(prefixes[prefix])
  }

  // Длина ID: 26 символов = 3 (префикс) + 1 (_) + 12 (hex timestamp) + 14 (random base62)
  const LENGTH = 26

  // Состояние для монотонной генерации ID
  // Используется для обеспечения уникальности и сортировки по времени
  let lastTimestamp = 0
  let counter = 0

  // Генерирует ID в возрастающем порядке (новые ID больше старых)
  // Используется для сортировки по времени создания
  export function ascending(prefix: keyof typeof prefixes, given?: string) {
    return generateID(prefix, false, given)
  }

  // Генерирует ID в убывающем порядке (новые ID меньше старых)
  // Используется для обратной сортировки по времени
  export function descending(prefix: keyof typeof prefixes, given?: string) {
    return generateID(prefix, true, given)
  }

  // Внутренняя функция для генерации или валидации ID
  function generateID(prefix: keyof typeof prefixes, descending: boolean, given?: string): string {
    if (!given) {
      return create(prefix, descending)
    }

    // Если ID передан, проверяем его префикс
    if (!given.startsWith(prefixes[prefix])) {
      throw new Error(`ID ${given} does not start with ${prefixes[prefix]}`)
    }
    return given
  }

  // Генерирует случайную строку в base62 (0-9, A-Z, a-z)
  // Base62 используется для компактности и читаемости
  function randomBase62(length: number): string {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    let result = ""
    const bytes = randomBytes(length)
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % 62]
    }
    return result
  }

  // Создает новый уникальный ID
  // Формат: префикс_hex(timestamp+counter)_random
  // timestamp+counter обеспечивает монотонность и сортируемость
  export function create(prefix: keyof typeof prefixes, descending: boolean, timestamp?: number): string {
    const currentTimestamp = timestamp ?? Date.now()

    // Увеличиваем счетчик для уникальности ID в пределах одной миллисекунды
    if (currentTimestamp !== lastTimestamp) {
      lastTimestamp = currentTimestamp
      counter = 0
    }
    counter++

    // Комбинируем timestamp и counter: timestamp * 0x1000 + counter
    // 0x1000 (4096) дает место для 4096 ID в одну миллисекунду
    let now = BigInt(currentTimestamp) * BigInt(0x1000) + BigInt(counter)

    // Для descending ID инвертируем биты (более новые ID будут меньше)
    now = descending ? ~now : now

    // Конвертируем в 6 байт (48 бит)
    const timeBytes = Buffer.alloc(6)
    for (let i = 0; i < 6; i++) {
      timeBytes[i] = Number((now >> BigInt(40 - 8 * i)) & BigInt(0xff))
    }

    // Формируем итоговый ID: префикс + _ + hex timestamp + random base62
    return prefixes[prefix] + "_" + timeBytes.toString("hex") + randomBase62(LENGTH - 12)
  }
}
