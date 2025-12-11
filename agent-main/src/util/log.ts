import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import z from "zod"

export namespace Log {
  // Определение уровней логирования: DEBUG, INFO, WARN, ERROR
  export const Level = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).meta({ ref: "LogLevel", description: "Log level" })
  export type Level = z.infer<typeof Level>

  // Приоритеты уровней логирования - выше число = выше приоритет
  const levelPriority: Record<Level, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  }

  // Текущий уровень логирования (по умолчанию INFO)
  let level: Level = "INFO"

  // Проверка, нужно ли логировать сообщение с заданным уровнем
  // Возвращает true, если уровень сообщения >= текущему уровню логирования
  function shouldLog(input: Level): boolean {
    return levelPriority[input] >= levelPriority[level]
  }

  // Интерфейс Logger предоставляет методы для логирования сообщений
  export type Logger = {
    debug(message?: any, extra?: Record<string, any>): void
    info(message?: any, extra?: Record<string, any>): void
    error(message?: any, extra?: Record<string, any>): void
    warn(message?: any, extra?: Record<string, any>): void
    // Добавляет тег к логгеру для отслеживания контекста
    tag(key: string, value: string): Logger
    // Создает копию логгера с теми же тегами
    clone(): Logger
    // Логирует время выполнения операции
    time(
      message: string,
      extra?: Record<string, any>,
    ): {
      stop(): void
      [Symbol.dispose](): void
    }
  }

  // Кеш логгеров по названию сервиса для переиспользования
  const loggers = new Map<string, Logger>()

  // Логгер по умолчанию для сервиса
  export const Default = create({ service: "default" })

  // Опции инициализации логирования
  export interface Options {
    print: boolean
    dev?: boolean
    level?: Level
  }

  // Путь к файлу логирования
  let logpath = ""
  export function file() {
    return logpath
  }
  // Функция записи логов (по умолчанию в stderr, может быть переопределена)
  let write = (msg: any) => Bun.stderr.write(msg)

  // Инициализирует логирование: устанавливает уровень и файл логирования
  // Если print=true, логи выводятся в консоль, иначе записываются в файл
  export async function init(options: Options) {
    if (options.level) level = options.level
    cleanup(Global.Path.log)
    if (options.print) return
    logpath = path.join(
      Global.Path.log,
      options.dev ? "dev.log" : new Date().toISOString().split(".")[0].replace(/:/g, "") + ".log",
    )
    const logfile = Bun.file(logpath)
    await fs.truncate(logpath).catch(() => {})
    const writer = logfile.writer()
    write = async (msg: any) => {
      const num = writer.write(msg)
      writer.flush()
      return num
    }
  }

  // Очищает старые логи, оставляя только 10 самых новых файлов
  async function cleanup(dir: string) {
    const glob = new Bun.Glob("????-??-??T??????.log")
    const files = await Array.fromAsync(
      glob.scan({
        cwd: dir,
        absolute: true,
      }),
    )
    if (files.length <= 5) return

    const filesToDelete = files.slice(0, -10)
    await Promise.all(filesToDelete.map((file) => fs.unlink(file).catch(() => {})))
  }

  // Форматирует ошибку с её причинами (если есть цепь ошибок)
  // Рекурсивно развертывает цепь причин до 10 уровней глубины
  function formatError(error: Error, depth = 0): string {
    const result = error.message
    return error.cause instanceof Error && depth < 10
      ? result + " Caused by: " + formatError(error.cause, depth + 1)
      : result
  }

  // Отслеживает время последнего логирования для расчета разницы между сообщениями
  let last = Date.now()

  // Создает новый логгер с заданными тегами или возвращает кешированный логгер
  export function create(tags?: Record<string, any>) {
    tags = tags || {}

    // Проверяет, есть ли уже логгер для этого сервиса
    const service = tags["service"]
    if (service && typeof service === "string") {
      const cached = loggers.get(service)
      if (cached) {
        return cached
      }
    }

    // Формирует строку префикса логирования с тегами, временем и разницей между сообщениями
    function build(message: any, extra?: Record<string, any>) {
      const prefix = Object.entries({
        ...tags,
        ...extra,
      })
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => {
          const prefix = `${key}=`
          if (value instanceof Error) return prefix + formatError(value)
          if (typeof value === "object") return prefix + JSON.stringify(value)
          return prefix + value
        })
        .join(" ")
      const next = new Date()
      const diff = next.getTime() - last
      last = next.getTime()
      return [next.toISOString().split(".")[0], "+" + diff + "ms", prefix, message].filter(Boolean).join(" ") + "\n"
    }

    // Реализация логгера со всеми методами логирования
    const result: Logger = {
      debug(message?: any, extra?: Record<string, any>) {
        if (shouldLog("DEBUG")) {
          write("DEBUG " + build(message, extra))
        }
      },
      info(message?: any, extra?: Record<string, any>) {
        if (shouldLog("INFO")) {
          write("INFO  " + build(message, extra))
        }
      },
      error(message?: any, extra?: Record<string, any>) {
        if (shouldLog("ERROR")) {
          write("ERROR " + build(message, extra))
        }
      },
      warn(message?: any, extra?: Record<string, any>) {
        if (shouldLog("WARN")) {
          write("WARN  " + build(message, extra))
        }
      },
      tag(key: string, value: string) {
        if (tags) tags[key] = value
        return result
      },
      clone() {
        return Log.create({ ...tags })
      },
      // Логирует время выполнения операции (начало и завершение)
      time(message: string, extra?: Record<string, any>) {
        const now = Date.now()
        result.info(message, { status: "started", ...extra })
        function stop() {
          result.info(message, {
            status: "completed",
            duration: Date.now() - now,
            ...extra,
          })
        }
        return {
          stop,
          [Symbol.dispose]() {
            stop()
          },
        }
      },
    }

    // Кеширует логгер если указан сервис
    if (service && typeof service === "string") {
      loggers.set(service, result)
    }

    return result
  }
}
