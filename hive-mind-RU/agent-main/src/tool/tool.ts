// Модуль Tool - определяет структуру и интерфейсы для инструментов (tools) используемых AI-агентом
// Здесь определены типы, интерфейсы и фабричная функция для создания типобезопасных инструментов

import z from "zod"
import type { MessageV2 } from "../session/message-v2"

export namespace Tool {
  // Интерфейс для дополнительных метаданных инструмента
  // Может содержать любые дополнительные поля в формате ключ-значение
  interface Metadata {
    [key: string]: any
  }

  // Контекст выполнения инструмента - содержит информацию о сеансе, сообщении и контроль выполнения
  export type Context<M extends Metadata = Metadata> = {
    // Уникальный идентификатор сеанса (диалога)
    sessionID: string
    // Уникальный идентификатор сообщения в сеансе
    messageID: string
    // Имя/идентификатор агента, выполняющего инструмент
    agent: string
    // Сигнал для отмены выполнения инструмента
    abort: AbortSignal
    // Опциональный идентификатор конкретного вызова инструмента
    callID?: string
    // Дополнительные данные, специфичные для конкретного вызова
    extra?: { [key: string]: any }
    // Метод для установки метаданных результата выполнения инструмента
    metadata(input: { title?: string; metadata?: M }): void
  }
  // Интерфейс для описания инструмента (tool)
  // Содержит метаинформацию и инициализационную функцию для создания инструмента
  export interface Info<Parameters extends z.ZodType = z.ZodType, M extends Metadata = Metadata> {
    // Уникальный идентификатор инструмента
    id: string
    // Асинхронная функция инициализации, возвращающая детали инструмента
    init: () => Promise<{
      // Описание назначения и функциональности инструмента
      description: string
      // Zod-схема для валидации параметров инструмента
      parameters: Parameters
      // Функция выполнения инструмента с параметрами и контекстом
      execute(
        // Распарсенные и провалидированные параметры инструмента
        args: z.infer<Parameters>,
        // Контекст выполнения с информацией о сеансе
        ctx: Context,
      ): Promise<{
        // Название результата выполнения инструмента
        title: string
        // Метаданные результата
        metadata: M
        // Текстовой результат выполнения инструмента
        output: string
        // Опциональные файловые вложения (документы, изображения и т.д.)
        attachments?: MessageV2.FilePart[]
      }>
      // Опциональная функция для форматирования ошибок валидации параметров
      formatValidationError?(error: z.ZodError): string
    }>
  }

  // Утилита для извлечения типа параметров из типа инструмента
  export type InferParameters<T extends Info> = T extends Info<infer P> ? z.infer<P> : never
  // Утилита для извлечения типа метаданных из типа инструмента
  export type InferMetadata<T extends Info> = T extends Info<any, infer M> ? M : never

  // Фабричная функция для создания типобезопасного инструмента
  // Автоматически оборачивает функцию execute с валидацией параметров
  export function define<Parameters extends z.ZodType, Result extends Metadata>(
    // Уникальный идентификатор инструмента
    id: string,
    // Функция инициализации инструмента или уже инициализированный объект инструмента
    init: Info<Parameters, Result>["init"] | Awaited<ReturnType<Info<Parameters, Result>["init"]>>,
  ): Info<Parameters, Result> {
    return {
      id,
      // Возвращает инициализированный инструмент с добавленной валидацией параметров
      init: async () => {
        // Если init - это функция, вызываем её; иначе используем как готовый объект
        const toolInfo = init instanceof Function ? await init() : init
        // Сохраняем оригинальную функцию execute для последующего вызова
        const execute = toolInfo.execute
        // Оборачиваем execute функцией валидации параметров
        toolInfo.execute = (args, ctx) => {
          try {
            // Валидация параметров через Zod-схему
            toolInfo.parameters.parse(args)
          } catch (error) {
            // Если определена кастомная функция форматирования ошибок, используем её
            if (error instanceof z.ZodError && toolInfo.formatValidationError) {
              throw new Error(toolInfo.formatValidationError(error), { cause: error })
            }
            // Иначе выбрасываем ошибку с описанием ожидаемой схемы
            throw new Error(
              `The ${id} tool was called with invalid arguments: ${error}.\nPlease rewrite the input so it satisfies the expected schema.`,
              { cause: error },
            )
          }
          // Выполняем оригинальную функцию с валидированными параметрами
          return execute(args, ctx)
        }
        return toolInfo
      },
    }
  }
}
