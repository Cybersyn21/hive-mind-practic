import { Bus } from "../bus"
import { File } from "../file"
import { Log } from "../util/log"
import path from "path"
import z from "zod"

import * as Formatter from "./formatter"
import { Config } from "../config/config"
import { mergeDeep } from "remeda"
import { Instance } from "../project/instance"

// Format модуль отвечает за управление форматированием файлов кода
// Инициализирует форматеры, проверяет их доступность и применяет форматирование при сохранении файла
export namespace Format {
  // Логгер для отслеживания операций форматирования
  const log = Log.create({ service: "format" })

  // Тип Status описывает информацию о статусе каждого форматтера
  // Содержит имя, поддерживаемые расширения файлов и флаг доступности
  export const Status = z
    .object({
      name: z.string(),                   // Имя форматтера
      extensions: z.string().array(),     // Список расширений, которые поддерживает форматтер
      enabled: z.boolean(),               // Флаг: доступен ли форматтер в текущей системе
    })
    .meta({
      ref: "FormatterStatus",
    })
  export type Status = z.infer<typeof Status>

  // Состояние форматеров - кешируется на уровне инстанса проекта
  // Инициализирует список доступных форматеров и применяет конфигурацию
  const state = Instance.state(async () => {
    // Кеш статуса доступности для каждого форматтера (чтобы не проверять несколько раз)
    const enabled: Record<string, boolean> = {}
    const cfg = await Config.get()

    // Словарь всех доступных форматеров
    const formatters: Record<string, Formatter.Info> = {}

    // Если форматирование отключено в конфигурации, возвращаем пустое состояние
    if (cfg.formatter === false) {
      log.info("all formatters are disabled")
      return {
        enabled,
        formatters,
      }
    }

    // Загружаем все встроенные форматеры из модуля formatter
    for (const item of Object.values(Formatter)) {
      formatters[item.name] = item
    }

    // Применяем пользовательскую конфигурацию форматеров
    // Позволяет отключить форматеры или переопределить их настройки
    for (const [name, item] of Object.entries(cfg.formatter ?? {})) {
      // Если форматтер отключен в конфигурации, удаляем его из списка
      if (item.disabled) {
        delete formatters[name]
        continue
      }
      // Объединяем встроенные настройки форматтера с пользовательскими
      const result: Formatter.Info = mergeDeep(formatters[name] ?? {}, {
        command: [],
        extensions: [],
        ...item,
      })

      // Пропускаем форматтер если не задана команда
      if (result.command.length === 0) continue

      // Для пользовательских форматеров всегда считаем их доступными
      result.enabled = async () => true
      result.name = name
      formatters[name] = result
    }

    return {
      enabled,
      formatters,
    }
  })

  // Проверяет доступность форматтера с кешированием результата
  // Результат проверки сохраняется в состояние чтобы не выполнять проверку повторно
  async function isEnabled(item: Formatter.Info) {
    const s = await state()
    let status = s.enabled[item.name]
    // Если статус не был проверен ранее, выполняем асинхронную проверку
    if (status === undefined) {
      status = await item.enabled()
      // Кешируем результат для последующих вызовов
      s.enabled[item.name] = status
    }
    return status
  }

  // Получает список форматеров, доступных для файла с указанным расширением
  // Проверяет доступность каждого форматтера перед включением в результат
  async function getFormatter(ext: string) {
    const formatters = await state().then((x) => x.formatters)
    const result = []
    for (const item of Object.values(formatters)) {
      // Логируем проверку форматтера
      log.info("checking", { name: item.name, ext })
      // Пропускаем если форматтер не поддерживает это расширение
      if (!item.extensions.includes(ext)) continue
      // Пропускаем если форматтер недоступен в текущей системе
      if (!(await isEnabled(item))) continue
      log.info("enabled", { name: item.name, ext })
      result.push(item)
    }
    return result
  }

  // Возвращает статус всех форматеров и их доступность
  // Используется для отображения информации о форматерах пользователю
  export async function status() {
    const s = await state()
    const result: Status[] = []
    // Получаем информацию о каждом форматтере и его доступности
    for (const formatter of Object.values(s.formatters)) {
      const enabled = await isEnabled(formatter)
      result.push({
        name: formatter.name,
        extensions: formatter.extensions,
        enabled,
      })
    }
    return result
  }

  // Инициализирует систему форматирования
  // Подписывается на событие редактирования файла и применяет форматирование
  export function init() {
    log.info("init")
    // Подписываемся на событие когда файл был отредактирован
    Bus.subscribe(File.Event.Edited, async (payload) => {
      const file = payload.properties.file
      log.info("formatting", { file })
      // Определяем расширение файла чтобы найти подходящие форматеры
      const ext = path.extname(file)

      // Получаем список форматеров поддерживающих это расширение
      for (const item of await getFormatter(ext)) {
        log.info("running", { command: item.command })
        try {
          // Заменяем $FILE плейсхолдер на реальный путь файла
          // Запускаем форматтер как отдельный процесс
          const proc = Bun.spawn({
            cmd: item.command.map((x) => x.replace("$FILE", file)),
            cwd: Instance.directory,
            // Применяем переменные окружения форматтера
            env: { ...process.env, ...item.environment },
            stdout: "ignore",
            stderr: "ignore",
          })
          // Ждем завершения процесса форматирования
          const exit = await proc.exited
          if (exit !== 0)
            log.error("failed", {
              command: item.command,
              ...item.environment,
            })
        } catch (error) {
          log.error("failed to format file", {
            error,
            command: item.command,
            ...item.environment,
            file,
          })
        }
      }
    })
  }
}
