import z from "zod"
import { Bus } from "../bus"
import { Storage } from "../storage/storage"

// Пространство имен для управления списками задач (TODO) в сессиях
// Позволяет создавать, обновлять и отслеживать задачи с их приоритетами и статусами
export namespace Todo {
  // Схема описывающая структуру элемента TODO списка
  export const Info = z
    .object({
      content: z.string().describe("Brief description of the task"), // Краткое описание задачи
      status: z.string().describe("Current status of the task: pending, in_progress, completed, cancelled"), // Текущий статус
      priority: z.string().describe("Priority level of the task: high, medium, low"), // Уровень приоритета
      id: z.string().describe("Unique identifier for the todo item"), // Уникальный идентификатор
    })
    .meta({ ref: "Todo" })
  export type Info = z.infer<typeof Info>

  // События для отслеживания обновлений TODO списка
  export const Event = {
    // Событие обновления списка задач
    Updated: Bus.event(
      "todo.updated",
      z.object({
        sessionID: z.string(),
        todos: z.array(Info),
      }),
    ),
  }

  // Обновляет список задач для указанной сессии
  // Сохраняет список в хранилище и публикует событие обновления
  export async function update(input: { sessionID: string; todos: Info[] }) {
    await Storage.write(["todo", input.sessionID], input.todos)
    Bus.publish(Event.Updated, input)
  }

  // Получает список задач для указанной сессии
  // Возвращает пустой массив если задачи не найдены или произошла ошибка
  export async function get(sessionID: string) {
    return Storage.read<Info[]>(["todo", sessionID])
      .then((x) => x || [])
      .catch(() => [])
  }
}
