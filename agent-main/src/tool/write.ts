import z from "zod"
import * as path from "path"
import { Tool } from "./tool"
import DESCRIPTION from "./write.txt"
import { Instance } from "../project/instance"

// Инструмент Write для записи содержимого в файлы
// Позволяет создавать новые файлы или перезаписывать существующие

// Определение инструмента Write для записи в файлы
// Инструмент позволяет агентам писать текстовое содержимое в файловую систему
export const WriteTool = Tool.define("write", {
  description: DESCRIPTION,
  // Параметры инструмента для записи файлов
  parameters: z.object({
    // Содержимое для записи в файл
    content: z.string().describe("The content to write to the file"),
    // Абсолютный путь к файлу (должен быть абсолютным)
    filePath: z.string().describe("The absolute path to the file to write (must be absolute, not relative)"),
  }),
  // Функция выполнения инструмента
  async execute(params, ctx) {
    // Преобразуем путь: если он абсолютный, используем как есть; если относительный, присоединяем к директории Instance
    const filepath = path.isAbsolute(params.filePath) ? params.filePath : path.join(Instance.directory, params.filePath)

    // Получаем объект файла для проверки его существования
    const file = Bun.file(filepath)
    // Проверяем, существует ли файл перед записью
    const exists = await file.exists()

    // Записываем содержимое в файл (создаем новый или перезаписываем существующий)
    await Bun.write(filepath, params.content)

    // Возвращаем результаты записи файла
    return {
      // Название файла (относительное имя в директории worktree)
      title: path.relative(Instance.worktree, filepath),
      metadata: {
        // Пустой объект диагностики (для совместимости)
        diagnostics: {},
        // Абсолютный путь файла
        filepath,
        // Флаг, существовал ли файл перед записью
        exists: exists,
      },
      // Пустой вывод (запись файла не возвращает содержимое)
      output: "",
    }
  },
})
