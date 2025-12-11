import { Bus } from "../bus"
import { Instance } from "../project/instance"
import z from "zod"

// Пространство имен для управления статусами сессий
// Отслеживает состояние сессий: idle (простой), busy (занята), retry (повтор)
export namespace SessionStatus {
  // Схема описывающая возможные статусы сессии
  export const Info = z
    .union([
      z.object({
        type: z.literal("idle"), // Сессия в режиме ожидания
      }),
      z.object({
        type: z.literal("retry"), // Сессия повторяет запрос после ошибки
        attempt: z.number(), // Номер текущей попытки
        message: z.string(), // Сообщение об ошибке
        next: z.number(), // Время следующей попытки
      }),
      z.object({
        type: z.literal("busy"), // Сессия занята выполнением задачи
      }),
    ])
    .meta({
      ref: "SessionStatus",
    })
  export type Info = z.infer<typeof Info>

  // События для отслеживания изменений статуса
  export const Event = {
    // Событие изменения статуса сессии
    Status: Bus.event(
      "session.status",
      z.object({
        sessionID: z.string(),
        status: Info,
      }),
    ),
    // Устаревшее событие перехода в режим ожидания
    // deprecated
    Idle: Bus.event(
      "session.idle",
      z.object({
        sessionID: z.string(),
      }),
    ),
  }

  // Хранилище состояний для всех активных сессий
  const state = Instance.state(() => {
    const data: Record<string, Info> = {}
    return data
  })

  // Получает текущий статус указанной сессии
  // Возвращает "idle" если статус не установлен
  export function get(sessionID: string) {
    return (
      state()[sessionID] ?? {
        type: "idle",
      }
    )
  }

  // Возвращает список всех текущих статусов сессий
  export function list() {
    return Object.values(state())
  }

  // Устанавливает новый статус для сессии и публикует события
  // При установке статуса "idle" удаляет запись о сессии из хранилища
  export function set(sessionID: string, status: Info) {
    Bus.publish(Event.Status, {
      sessionID,
      status,
    })
    if (status.type === "idle") {
      // Публикуем устаревшее событие для обратной совместимости
      // deprecated
      Bus.publish(Event.Idle, {
        sessionID,
      })
      // Удаляем сессию из хранилища когда она становится idle
      delete state()[sessionID]
      return
    }
    state()[sessionID] = status
  }
}
