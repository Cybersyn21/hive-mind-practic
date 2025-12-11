import z from "zod"
import * as fs from "fs"
import * as path from "path"
import { Tool } from "./tool"
import { FileTime } from "../file/time"
import DESCRIPTION from "./read.txt"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import { Provider } from "../provider/provider"
import { Identifier } from "../id/id"
import { iife } from "../util/iife"

// Инструмент Read для чтения содержимого файлов
// Поддерживает чтение текстовых файлов, изображений и отказывает для бинарных файлов

// Стандартное количество строк для чтения (2000 строк)
const DEFAULT_READ_LIMIT = 2000
// Максимальная длина одной строки при выводе (2000 символов)
const MAX_LINE_LENGTH = 2000

// Определение инструмента Read для чтения содержимого файлов
// Инструмент позволяет читать текстовые файлы и изображения из файловой системы
export const ReadTool = Tool.define("read", {
  description: DESCRIPTION,
  // Параметры инструмента для чтения файлов
  parameters: z.object({
    // Путь к файлу для чтения
    filePath: z.string().describe("The path to the file to read"),
    // Опциональное смещение (номер строки, с которой начать чтение)
    offset: z.coerce.number().describe("The line number to start reading from (0-based)").optional(),
    // Опциональное количество строк для чтения (по умолчанию 2000)
    limit: z.coerce.number().describe("The number of lines to read (defaults to 2000)").optional(),
  }),
  // Функция выполнения инструмента
  async execute(params, ctx) {
    // Преобразуем относительный путь в абсолютный
    let filepath = params.filePath
    if (!path.isAbsolute(filepath)) {
      filepath = path.join(process.cwd(), filepath)
    }
    // Определяем название файла для вывода (относительное имя в директории worktree)
    const title = path.relative(Instance.worktree, filepath)

    // Открываем файл с помощью Bun
    const file = Bun.file(filepath)
    // Проверяем, существует ли файл
    if (!(await file.exists())) {
      // Если файл не найден, пытаемся предложить похожие файлы
      const dir = path.dirname(filepath)
      const base = path.basename(filepath)

      // Получаем список всех файлов в директории
      const dirEntries = fs.readdirSync(dir)
      // Фильтруем файлы, похожие по имени на искомый (пересечение строк)
      const suggestions = dirEntries
        .filter(
          (entry) =>
            entry.toLowerCase().includes(base.toLowerCase()) || base.toLowerCase().includes(entry.toLowerCase()),
        )
        .map((entry) => path.join(dir, entry))
        .slice(0, 3) // Берем до 3 рекомендаций

      // Если есть похожие файлы, выбрасываем ошибку с рекомендациями
      if (suggestions.length > 0) {
        throw new Error(`File not found: ${filepath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`)
      }

      // Иначе выбрасываем простую ошибку о том, что файл не найден
      throw new Error(`File not found: ${filepath}`)
    }

    // Проверяем, является ли файл изображением по его расширению
    const isImage = isImageFile(filepath)
    // Проверяем, поддерживает ли текущая модель чтение изображений
    const supportsImages = await (async () => {
      // Если нет провайдера или модели в контексте, не поддерживаем изображения
      if (!ctx.extra?.["providerID"] || !ctx.extra?.["modelID"]) return false
      const providerID = ctx.extra["providerID"] as string
      const modelID = ctx.extra["modelID"] as string
      // Получаем информацию о модели
      const model = await Provider.getModel(providerID, modelID).catch(() => undefined)
      if (!model) return false
      // Проверяем, есть ли модальность "image" в входных данных
      return model.info.modalities?.input?.includes("image") ?? false
    })()

    // Если это изображение, обрабатываем его специально
    if (isImage) {
      // Проверяем, может ли модель обрабатывать изображения
      if (!supportsImages) {
        throw new Error(`Failed to read image: ${filepath}, model may not be able to read images`)
      }
      // Получаем MIME-тип файла
      const mime = file.type
      const msg = "Image read successfully"
      // Возвращаем изображение как вложение (attachment) в base64
      return {
        title,
        output: msg,
        metadata: {
          preview: msg,
        },
        attachments: [
          {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "file",
            mime,
            // Кодируем изображение в base64 для передачи в API
            url: `data:${mime};base64,${Buffer.from(await file.bytes()).toString("base64")}`,
          },
        ],
      }
    }

    // Проверяем, является ли файл бинарным (не текстовым)
    const isBinary = await isBinaryFile(filepath, file)
    // Отказываем читать бинарные файлы
    if (isBinary) throw new Error(`Cannot read binary file: ${filepath}`)

    // Определяем лимит строк и смещение для чтения
    const limit = params.limit ?? DEFAULT_READ_LIMIT // Используем переданный лимит или стандартный
    const offset = params.offset || 0 // Смещение от начала файла
    // Читаем содержимое файла и разбиваем его на строки
    const lines = await file.text().then((text) => text.split("\n"))
    // Выбираем диапазон строк: от offset до offset+limit
    const raw = lines.slice(offset, offset + limit).map((line) => {
      // Обрезаем длинные строки и добавляем "..." если они превышают максимум
      return line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "..." : line
    })
    // Форматируем строки с номерами линий (5 цифр, выравнено справа)
    const content = raw.map((line, index) => {
      return `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`
    })
    // Создаем предпросмотр: первые 20 строк для отображения в интерфейсе
    const preview = raw.slice(0, 20).join("\n")

    // Формируем вывод с обрамлением <file>...</file>
    let output = "<file>\n"
    output += content.join("\n")

    // Определяем информацию о конце файла
    const totalLines = lines.length
    const lastReadLine = offset + content.length
    const hasMoreLines = totalLines > lastReadLine

    // Добавляем информацию о наличии дополнительных строк
    if (hasMoreLines) {
      output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${lastReadLine})`
    } else {
      output += `\n\n(End of file - total ${totalLines} lines)`
    }
    output += "\n</file>"

    // Записываем событие чтения файла для LSP-клиента
    FileTime.read(ctx.sessionID, filepath)

    // Возвращаем результаты чтения файла
    return {
      title, // Название файла
      output, // Содержимое файла с номерами строк
      metadata: {
        preview, // Предпросмотр первых 20 строк
      },
    }
  },
})

// Функция для определения, является ли файл изображением
// Возвращает MIME-тип изображения или false
function isImageFile(filePath: string): string | false {
  // Получаем расширение файла в нижнем регистре
  const ext = path.extname(filePath).toLowerCase()
  // Проверяем расширение и возвращаем MIME-тип
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "JPEG"
    case ".png":
      return "PNG"
    case ".gif":
      return "GIF"
    case ".bmp":
      return "BMP"
    case ".webp":
      return "WebP"
    default:
      return false // Не является изображением
  }
}

// Функция для определения, является ли файл бинарным
// Проверяет расширение файла и содержимое
async function isBinaryFile(filepath: string, file: Bun.BunFile): Promise<boolean> {
  // Получаем расширение файла в нижнем регистре
  const ext = path.extname(filepath).toLowerCase()
  // Проверяем известные бинарные расширения
  switch (ext) {
    // Архивы
    case ".zip":
    case ".tar":
    case ".gz":
    case ".7z":
    // Исполняемые файлы
    case ".exe":
    case ".dll":
    case ".so":
    // Java
    case ".class":
    case ".jar":
    case ".war":
    // Microsoft Office и документы
    case ".doc":
    case ".docx":
    case ".xls":
    case ".xlsx":
    case ".ppt":
    case ".pptx":
    // OpenDocument
    case ".odt":
    case ".ods":
    case ".odp":
    // Остальные бинарные форматы
    case ".bin":
    case ".dat":
    case ".obj":
    case ".o":
    case ".a":
    case ".lib":
    case ".wasm":
    case ".pyc":
    case ".pyo":
      return true
    default:
      break // Продолжаем проверку содержимого
  }

  // Получаем размер файла
  const stat = await file.stat()
  const fileSize = stat.size
  // Пустые файлы считаем текстовыми
  if (fileSize === 0) return false

  // Читаем первые 4096 байт файла для анализа
  const bufferSize = Math.min(4096, fileSize)
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength === 0) return false
  const bytes = new Uint8Array(buffer.slice(0, bufferSize))

  // Подсчитываем количество непечатаемых символов
  let nonPrintableCount = 0
  for (let i = 0; i < bytes.length; i++) {
    // Нулевой байт почти всегда указывает на бинарный файл
    if (bytes[i] === 0) return true
    // Символы контроля (кроме tab, LF, CR)
    if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
      nonPrintableCount++
    }
  }
  // Если более 30% непечатаемых символов, считаем файл бинарным
  return nonPrintableCount / bytes.length > 0.3
}
