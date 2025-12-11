import path from "path"
import { Global } from "../global"
import fs from "fs/promises"
import z from "zod"

// Модуль аутентификации для хранения и управления учетными данными различных провайдеров
export namespace Auth {
  // Схема OAuth аутентификации с токенами обновления и доступа
  // Используется для провайдеров, поддерживающих OAuth 2.0 flow
  export const Oauth = z
    .object({
      type: z.literal("oauth"),
      refresh: z.string(), // Токен обновления для получения нового access token
      access: z.string(), // Токен доступа для API запросов
      expires: z.number(), // Время истечения токена (Unix timestamp)
      enterpriseUrl: z.string().optional(), // URL для enterprise версий (например, GitHub Enterprise)
    })
    .meta({ ref: "OAuth" })

  // Схема API ключа для простой аутентификации
  // Используется для провайдеров с прямым API ключом
  export const Api = z
    .object({
      type: z.literal("api"),
      key: z.string(), // API ключ провайдера
    })
    .meta({ ref: "ApiAuth" })

  // Схема WellKnown аутентификации для специальных случаев
  // Используется для провайдеров с custom authentication flow
  export const WellKnown = z
    .object({
      type: z.literal("wellknown"),
      key: z.string(), // Идентификатор ключа
      token: z.string(), // Токен доступа
    })
    .meta({ ref: "WellKnownAuth" })

  // Объединенный тип для всех видов аутентификации
  // Использует discriminated union для type-safe различения типов
  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown]).meta({ ref: "Auth" })
  export type Info = z.infer<typeof Info>

  // Путь к файлу с учетными данными
  const filepath = path.join(Global.Path.data, "auth.json")

  // Получить учетные данные для конкретного провайдера
  // Возвращает undefined если провайдер не найден
  export async function get(providerID: string) {
    const file = Bun.file(filepath)
    return file
      .json()
      .catch(() => ({})) // Возвращаем пустой объект если файл не существует
      .then((x) => x[providerID] as Info | undefined)
  }

  // Получить все сохраненные учетные данные
  // Возвращает объект с ключами-идентификаторами провайдеров
  export async function all(): Promise<Record<string, Info>> {
    const file = Bun.file(filepath)
    return file.json().catch(() => ({}))
  }

  // Сохранить учетные данные для провайдера
  // Объединяет с существующими данными и устанавливает безопасные права доступа (только владелец)
  export async function set(key: string, info: Info) {
    const file = Bun.file(filepath)
    const data = await all()
    await Bun.write(file, JSON.stringify({ ...data, [key]: info }, null, 2))
    await fs.chmod(file.name!, 0o600) // Устанавливаем права доступа 600 (только чтение/запись владельцем)
  }

  // Удалить учетные данные провайдера
  // Сохраняет остальные данные и поддерживает безопасные права доступа
  export async function remove(key: string) {
    const file = Bun.file(filepath)
    const data = await all()
    delete data[key]
    await Bun.write(file, JSON.stringify(data, null, 2))
    await fs.chmod(file.name!, 0o600)
  }
}
