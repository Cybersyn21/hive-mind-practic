import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import z from "zod"
import { data } from "./models-macro"

// Пространство имен для работы с данными о моделях из models.dev
// Управляет кэшированием и загрузкой информации о доступных AI моделях
export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  // Путь к кэшированному файлу с данными о моделях
  const filepath = path.join(Global.Path.cache, "models.json")

  // Zod схема для описания модели AI
  export const Model = z
    .object({
      id: z.string(), // Уникальный идентификатор модели
      name: z.string(), // Человекочитаемое имя модели
      release_date: z.string(), // Дата релиза модели
      attachment: z.boolean(), // Поддержка вложений
      reasoning: z.boolean(), // Поддержка рассуждений (reasoning)
      temperature: z.boolean(), // Поддержка параметра temperature
      tool_call: z.boolean(), // Поддержка вызова инструментов
      cost: z.object({
        input: z.number(), // Стоимость входных токенов
        output: z.number(), // Стоимость выходных токенов
        cache_read: z.number().optional(), // Стоимость чтения из кэша
        cache_write: z.number().optional(), // Стоимость записи в кэш
        context_over_200k: z
          .object({
            input: z.number(), // Стоимость для контекста >200k токенов
            output: z.number(),
            cache_read: z.number().optional(),
            cache_write: z.number().optional(),
          })
          .optional(),
      }),
      limit: z.object({
        context: z.number(), // Лимит контекстных токенов
        output: z.number(), // Лимит выходных токенов
      }),
      modalities: z
        .object({
          input: z.array(z.enum(["text", "audio", "image", "video", "pdf"])), // Поддерживаемые входные модальности
          output: z.array(z.enum(["text", "audio", "image", "video", "pdf"])), // Поддерживаемые выходные модальности
        })
        .optional(),
      experimental: z.boolean().optional(), // Флаг экспериментальной модели
      status: z.enum(["alpha", "beta", "deprecated"]).optional(), // Статус модели
      options: z.record(z.string(), z.any()), // Дополнительные опции провайдера
      headers: z.record(z.string(), z.string()).optional(), // HTTP заголовки для запросов
      provider: z.object({ npm: z.string() }).optional(), // NPM пакет провайдера
    })
    .meta({
      ref: "Model",
    })
  export type Model = z.infer<typeof Model>

  // Zod схема для провайдера AI моделей
  export const Provider = z
    .object({
      api: z.string().optional(), // URL API провайдера
      name: z.string(), // Название провайдера
      env: z.array(z.string()), // Переменные окружения для аутентификации
      id: z.string(), // Идентификатор провайдера
      npm: z.string().optional(), // NPM пакет для провайдера
      models: z.record(z.string(), Model), // Карта доступных моделей
    })
    .meta({
      ref: "Provider",
    })

  export type Provider = z.infer<typeof Provider>

  // Получает данные о провайдерах и моделях
  // Сначала пытается прочитать из кэша, затем из удаленного API
  export async function get() {
    refresh() // Асинхронно обновляем кэш
    const file = Bun.file(filepath)
    const result = await file.json().catch(() => {})
    if (result) return result as Record<string, Provider>
    // Если кэша нет, используем встроенные данные
    const json = await data()
    return JSON.parse(json) as Record<string, Provider>
  }

  // Обновляет кэшированные данные о моделях из models.dev API
  export async function refresh() {
    const file = Bun.file(filepath)
    log.info("refreshing", {
      file,
    })
    const result = await fetch("https://models.dev/api.json", {
      headers: {
        "User-Agent": "agent-cli/1.0.0",
      },
      signal: AbortSignal.timeout(10 * 1000), // Таймаут 10 секунд
    }).catch((e) => {
      log.error("Failed to fetch models.dev", {
        error: e,
      })
    })
    // Если запрос успешен, сохраняем данные в кэш
    if (result && result.ok) await Bun.write(file, await result.text())
  }
}

// Обновляем кэш каждый час
setInterval(() => ModelsDev.refresh(), 60 * 1000 * 60).unref()
