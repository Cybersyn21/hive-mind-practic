import z from "zod"
import { Tool } from "./tool"
import { EditTool } from "./edit"
import DESCRIPTION from "./multiedit.txt"
import path from "path"
import { Instance } from "../project/instance"

// Инструмент для выполнения множественных последовательных редактирований одного файла
// Применяет массив операций замены текста одну за другой
export const MultiEditTool = Tool.define("multiedit", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The absolute path to the file to modify"),
    edits: z
      .array(
        z.object({
          filePath: z.string().describe("The absolute path to the file to modify"),
          oldString: z.string().describe("The text to replace"), // Текст для замены
          newString: z.string().describe("The text to replace it with (must be different from oldString)"), // Новый текст
          replaceAll: z.boolean().optional().describe("Replace all occurrences of oldString (default false)"), // Заменить все вхождения
        }),
      )
      .describe("Array of edit operations to perform sequentially on the file"),
  }),
  async execute(params, ctx) {
    // Получаем экземпляр инструмента редактирования
    const tool = await EditTool.init()
    const results = []
    // Последовательно применяем каждую операцию редактирования
    for (const [, edit] of params.edits.entries()) {
      const result = await tool.execute(
        {
          filePath: params.filePath,
          oldString: edit.oldString,
          newString: edit.newString,
          replaceAll: edit.replaceAll,
        },
        ctx,
      )
      results.push(result)
    }
    // Возвращаем результат с метаданными всех операций и выводом последней
    return {
      title: path.relative(Instance.worktree, params.filePath),
      metadata: {
        results: results.map((r) => r.metadata), // Собираем метаданные всех редактирований
      },
      output: results.at(-1)!.output, // Используем вывод последней операции
    }
  },
})
