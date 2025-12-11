// Инструмент для загрузки контента с веб-страниц с поддержкой различных форматов вывода
import z from "zod"
import { Tool } from "./tool"
import TurndownService from "turndown"
import DESCRIPTION from "./webfetch.txt"

// Ограничение на максимальный размер загружаемого контента (5 МБ)
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
// Таймаут по умолчанию для загрузки страницы (30 секунд)
const DEFAULT_TIMEOUT = 30 * 1000 // 30 seconds
// Максимальный таймаут для загрузки (2 минуты)
const MAX_TIMEOUT = 120 * 1000 // 2 minutes

// Определение инструмента для загрузки веб-страниц с параметрами формата и таймаута
export const WebFetchTool = Tool.define("webfetch", {
  description: DESCRIPTION,
  parameters: z.object({
    url: z.string().describe("The URL to fetch content from"),
    format: z
      .enum(["text", "markdown", "html"])
      .describe("The format to return the content in (text, markdown, or html)"),
    timeout: z.number().describe("Optional timeout in seconds (max 120)").optional(),
  }),
  // Асинхронная функция для выполнения загрузки с валидацией и обработкой контента
  async execute(params, ctx) {
    // Валидация URL - проверка начинается с http:// или https://
    if (!params.url.startsWith("http://") && !params.url.startsWith("https://")) {
      throw new Error("URL must start with http:// or https://")
    }

    // Без ограничений - неограниченная загрузка веб-контента
    // Расчет таймаута с учетом пользовательского значения и максимального лимита
    const timeout = Math.min((params.timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT)

    // Контроллер для управления отменой запроса по таймауту
    const controller = new AbortController()
    // Установка таймаута для автоматической отмены запроса
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    // Построение заголовка Accept на основе запрошенного формата с параметрами качества (q)
    // Параметры q определяют приоритет предпочтения типов контента
    let acceptHeader = "*/*"
    switch (params.format) {
      case "markdown":
        // Приоритет: markdown -> text -> html
        acceptHeader = "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1"
        break
      case "text":
        // Приоритет: text -> markdown -> html
        acceptHeader = "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1"
        break
      case "html":
        // Приоритет: html -> xhtml -> text -> markdown
        acceptHeader = "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1"
        break
      default:
        // По умолчанию стандартный заголовок Accept для браузера
        acceptHeader =
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    }

    // Выполнение GET запроса с имитацией браузера и поддержкой отмены
    const response = await fetch(params.url, {
      signal: AbortSignal.any([controller.signal, ctx.abort]),
      headers: {
        // User-Agent строка для имитации браузера Chrome
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: acceptHeader, // Заголовок с приоритетом типов контента
        "Accept-Language": "en-US,en;q=0.9",
      },
    })

    // Очистка таймаута после получения ответа
    clearTimeout(timeoutId)

    // Проверка успешности ответа (статус 200-299)
    if (!response.ok) {
      throw new Error(`Request failed with status code: ${response.status}`)
    }

    // Проверка размера контента из заголовка Content-Length перед загрузкой
    const contentLength = response.headers.get("content-length")
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)")
    }

    // Загрузка контента как бинарных данных для поддержки различных кодировок
    const arrayBuffer = await response.arrayBuffer()
    // Финальная проверка размера загруженного контента
    if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)")
    }

    // Декодирование бинарных данных в текст с автоматическим определением кодировки
    const content = new TextDecoder().decode(arrayBuffer)
    // Получение типа контента из заголовка ответа
    const contentType = response.headers.get("content-type") || ""

    // Формирование заголовка результата с URL и типом контента
    const title = `${params.url} (${contentType})`

    // Обработка контента на основе запрошенного формата и фактического типа контента
    switch (params.format) {
      case "markdown":
        if (contentType.includes("text/html")) {
          const markdown = convertHTMLToMarkdown(content)
          return {
            output: markdown,
            title,
            metadata: {},
          }
        }
        return {
          output: content,
          title,
          metadata: {},
        }

      case "text":
        if (contentType.includes("text/html")) {
          const text = await extractTextFromHTML(content)
          return {
            output: text,
            title,
            metadata: {},
          }
        }
        return {
          output: content,
          title,
          metadata: {},
        }

      case "html":
        return {
          output: content,
          title,
          metadata: {},
        }

      default:
        return {
          output: content,
          title,
          metadata: {},
        }
    }
  },
})

// Функция для извлечения только текстового содержимого из HTML, исключая скрипты и стили
async function extractTextFromHTML(html: string) {
  let text = "" // Накопитель для текстового контента
  let skipContent = false // Флаг для пропуска содержимого в служебных элементах

  // HTMLRewriter используется для потокового парсинга HTML без загрузки всего DOM в память
  const rewriter = new HTMLRewriter()
    .on("script, style, noscript, iframe, object, embed", {
      // Эти элементы содержат служебный контент, который нужно пропустить
      element() {
        skipContent = true
      },
      text() {
        // Пропуск текста внутри этих элементов
      },
    })
    .on("*", {
      // Обработка всех элементов для правильного управления флагом skipContent
      element(element) {
        // Сброс флага при выходе из служебных элементов
        if (!["script", "style", "noscript", "iframe", "object", "embed"].includes(element.tagName)) {
          skipContent = false
        }
      },
      text(input) {
        // Добавление текста только если мы не в служебном элементе
        if (!skipContent) {
          text += input.text
        }
      },
    })
    .transform(new Response(html))

  // Ожидание завершения парсинга
  await rewriter.text()
  return text.trim() // Возврат текста с удаленными пробелами в начале и конце
}

// Функция для преобразования HTML в Markdown с помощью библиотеки Turndown
function convertHTMLToMarkdown(html: string): string {
  // Инициализация сервиса преобразования с настройками форматирования для Markdown
  const turndownService = new TurndownService({
    headingStyle: "atx", // Использование # стиля для заголовков (вместо подчеркивания)
    hr: "---", // Разделитель горизонтальной линии
    bulletListMarker: "-", // Символ для маркированных списков
    codeBlockStyle: "fenced", // Использование обратных кавычек для блоков кода
    emDelimiter: "*", // Символ для выделения текста
  })
  // Удаление элементов, не нужных в Markdown
  turndownService.remove(["script", "style", "meta", "link"])
  // Преобразование HTML в Markdown и возврат результата
  return turndownService.turndown(html)
}
