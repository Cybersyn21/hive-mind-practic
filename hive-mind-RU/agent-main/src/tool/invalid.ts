import z from "zod"
import { Tool } from "./tool"

// Специальный инструмент для обработки ошибок валидации параметров других инструментов
// Вызывается когда параметры переданные в инструмент не соответствуют ожидаемой схеме
export const InvalidTool = Tool.define("invalid", {
  description: "Do not use", // Не должен использоваться напрямую
  parameters: z.object({
    tool: z.string(), // Имя инструмента с невалидными параметрами
    error: z.string(), // Описание ошибки валидации
  }),
  // Возвращает сообщение об ошибке валидации параметров
  async execute(params) {
    return {
      title: "Invalid Tool",
      output: `The arguments provided to the tool are invalid: ${params.error}`,
      metadata: {},
    }
  },
})
