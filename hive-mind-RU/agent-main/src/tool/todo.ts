import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { Todo } from "../session/todo"

// Инструмент для обновления списка задач (todo list)
// Позволяет обновлять статусы задач, добавлять новые задачи и управлять списком
export const TodoWriteTool = Tool.define("todowrite", {
  description: DESCRIPTION_WRITE,
  parameters: z.object({
    todos: z.array(z.object(Todo.Info.shape)).describe("The updated todo list"),
  }),
  // Функция выполнения обновления списка задач
  async execute(params, opts) {
    // Обновляем список задач в сессии
    await Todo.update({
      sessionID: opts.sessionID,
      todos: params.todos,
    })
    // Возвращаем результат с информацией о количестве незавершённых задач
    return {
      title: `${params.todos.filter((x) => x.status !== "completed").length} todos`,
      output: JSON.stringify(params.todos, null, 2),
      metadata: {
        todos: params.todos,
      },
    }
  },
})

// Инструмент для чтения текущего списка задач
// Позволяет агенту просмотреть все текущие задачи и их статусы
export const TodoReadTool = Tool.define("todoread", {
  description: "Use this tool to read your todo list",
  parameters: z.object({}),
  // Функция получения списка задач из текущей сессии
  async execute(_params, opts) {
    // Получаем список задач для текущей сессии
    const todos = await Todo.get(opts.sessionID)
    // Возвращаем количество незавершённых задач и полный список
    return {
      title: `${todos.filter((x) => x.status !== "completed").length} todos`,
      metadata: {
        todos,
      },
      output: JSON.stringify(todos, null, 2),
    }
  },
})
