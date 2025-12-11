import z from "zod"
import { spawn } from "child_process"
import { Tool } from "./tool"
import DESCRIPTION from "./bash.txt"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { lazy } from "../util/lazy"
import { Language } from "web-tree-sitter"
import { $ } from "bun"
import { Filesystem } from "../util/filesystem"
import { fileURLToPath } from "url"

// Инструмент Bash для выполнения команд в терминале
// Этот файл предоставляет функциональность для выполнения bash-команд с ограничениями по времени и размеру вывода

// Максимальная длина вывода команды (30 КБ)
const MAX_OUTPUT_LENGTH = 30_000
// Стандартное время ожидания выполнения команды (1 минута)
const DEFAULT_TIMEOUT = 1 * 60 * 1000
// Максимальное время ожидания выполнения команды (10 минут)
const MAX_TIMEOUT = 10 * 60 * 1000
// Время ожидания перед отправкой SIGKILL после SIGTERM (200 мс)
const SIGKILL_TIMEOUT_MS = 200

export const log = Log.create({ service: "bash-tool" })

// Функция для разрешения пути к WASM-файлам
// Преобразует различные форматы путей (file://, абсолютные, относительные) в абсолютные пути
const resolveWasm = (asset: string) => {
  // Если путь начинается с "file://", преобразуем в абсолютный путь
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  // Если уже абсолютный путь (UNIX или Windows), возвращаем как есть
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  // Для относительных путей, разрешаем относительно текущего модуля
  const url = new URL(asset, import.meta.url)
  return fileURLToPath(url)
}

// Ленивая инициализация парсера Bash с помощью tree-sitter
// Парсер используется для анализа синтаксиса bash-команд
// Инициализируется только при первом использовании благодаря паттерну lazy
const parser = lazy(async () => {
  // Импортируем парсер tree-sitter
  const { Parser } = await import("web-tree-sitter")
  // Импортируем WASM-модуль tree-sitter
  const { default: treeWasm } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
    with: { type: "wasm" },
  })
  // Разрешаем путь к WASM-файлу
  const treePath = resolveWasm(treeWasm)
  // Инициализируем парсер с WASM-модулем
  await Parser.init({
    locateFile() {
      return treePath
    },
  })
  // Импортируем WASM-модуль для bash-языка
  const { default: bashWasm } = await import("tree-sitter-bash/tree-sitter-bash.wasm" as string, {
    with: { type: "wasm" },
  })
  // Разрешаем путь к bash WASM-файлу
  const bashPath = resolveWasm(bashWasm)
  // Загружаем язык bash
  const bashLanguage = await Language.load(bashPath)
  // Создаем новый парсер
  const p = new Parser()
  // Устанавливаем язык bash для парсера
  p.setLanguage(bashLanguage)
  return p
})

// Определение инструмента Bash для выполнения shell-команд
// Инструмент позволяет агентам выполнять bash-команды с контролем времени и вывода
export const BashTool = Tool.define("bash", {
  description: DESCRIPTION,
  // Параметры инструмента, определяющие входные данные
  parameters: z.object({
    // Команда для выполнения в shell
    command: z.string().describe("The command to execute"),
    // Опциональное время ожидания в миллисекундах
    timeout: z.number().describe("Optional timeout in milliseconds").optional(),
    // Опциональное описание команды для логирования и метаданных
    description: z
      .string()
      .describe(
        "Clear, concise description of what this command does in 5-10 words. Examples:\nInput: ls\nOutput: Lists files in current directory\n\nInput: git status\nOutput: Shows working tree status\n\nInput: npm install\nOutput: Installs package dependencies\n\nInput: mkdir foo\nOutput: Creates directory 'foo'",
      )
      .optional(),
  }),
  // Функция выполнения команды
  async execute(params, ctx) {
    // Проверка, что время ожидания имеет положительное значение
    if (params.timeout !== undefined && params.timeout < 0) {
      throw new Error(`Invalid timeout value: ${params.timeout}. Timeout must be a positive number.`)
    }
    // Установка времени ожидания: используем переданное значение или стандартное, но не больше максимума
    const timeout = Math.min(params.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT)

    // Запуск процесса с командой в shell
    const proc = spawn(params.command, {
      shell: true, // Использование shell для выполнения команды
      cwd: Instance.directory, // Рабочая директория процесса
      env: {
        ...process.env, // Передача переменных окружения в процесс
      },
      stdio: ["ignore", "pipe", "pipe"], // Входной поток игнорируется, выходы перенаправляются в pipe
      detached: process.platform !== "win32", // На Unix-системах отделяем процесс от родителя
    })

    // Переменная для накопления вывода команды
    let output = ""

    // Инициализация метаданных с пустым выводом
    ctx.metadata({
      metadata: {
        output: "",
        description: params.description,
      },
    })

    // Функция для добавления данных вывода и обновления метаданных в реальном времени
    const append = (chunk: Buffer) => {
      output += chunk.toString()
      // Обновляем метаданные по мере получения данных из процесса
      ctx.metadata({
        metadata: {
          output,
          description: params.description,
        },
      })
    }

    // Подписываемся на события потоков stdout и stderr процесса
    proc.stdout?.on("data", append)
    proc.stderr?.on("data", append)

    // Флаги для отслеживания состояния процесса
    let timedOut = false // Процесс превысил время ожидания
    let aborted = false // Процесс был отменен пользователем
    let exited = false // Процесс завершил выполнение

    // Функция для завершения процесса и всех его дочерних процессов
    const killTree = async () => {
      const pid = proc.pid
      // Если нет PID или процесс уже завершился, выходим
      if (!pid || exited) {
        return
      }

      // На Windows используем taskkill для завершения процесса и его дочерних процессов
      if (process.platform === "win32") {
        await new Promise<void>((resolve) => {
          const killer = spawn("taskkill", ["/pid", String(pid), "/f", "/t"], { stdio: "ignore" })
          killer.once("exit", resolve)
          killer.once("error", resolve)
        })
        return
      }

      // На Unix-системах: сначала отправляем SIGTERM, затем SIGKILL если не сработало
      try {
        // Отправляем SIGTERM всей группе процессов (отрицательный PID)
        process.kill(-pid, "SIGTERM")
        // Даем процессу время на корректное завершение
        await Bun.sleep(SIGKILL_TIMEOUT_MS)
        // Если не завершился, отправляем SIGKILL (принудительное завершение)
        if (!exited) {
          process.kill(-pid, "SIGKILL")
        }
      } catch (_e) {
        // Если завершение группы процессов не сработало, пытаемся завершить сам процесс
        proc.kill("SIGTERM")
        await Bun.sleep(SIGKILL_TIMEOUT_MS)
        if (!exited) {
          proc.kill("SIGKILL")
        }
      }
    }

    // Если команда отмены уже установлена, сразу завершаем процесс
    if (ctx.abort.aborted) {
      aborted = true
      await killTree()
    }

    // Обработчик события отмены (abort signal)
    const abortHandler = () => {
      aborted = true
      void killTree() // Запускаем завершение без ожидания
    }

    // Подписываемся на событие отмены (только один раз)
    ctx.abort.addEventListener("abort", abortHandler, { once: true })

    // Установка таймера на указанное время ожидания
    const timeoutTimer = setTimeout(() => {
      timedOut = true // Отмечаем, что произошло превышение времени
      void killTree() // Убиваем процесс
    }, timeout)

    // Ожидаем завершения процесса (корректного или по сигналу)
    await new Promise<void>((resolve, reject) => {
      // Функция для очистки ресурсов (таймер и обработчики событий)
      const cleanup = () => {
        clearTimeout(timeoutTimer)
        ctx.abort.removeEventListener("abort", abortHandler)
      }

      // Обработчик успешного завершения процесса
      proc.once("exit", () => {
        exited = true
        cleanup()
        resolve()
      })

      // Обработчик ошибки при выполнении процесса
      proc.once("error", (error) => {
        exited = true
        cleanup()
        reject(error)
      })
    })

    // Если вывод слишком большой, обрезаем его до максимального размера
    if (output.length > MAX_OUTPUT_LENGTH) {
      output = output.slice(0, MAX_OUTPUT_LENGTH)
      output += "\n\n(Output was truncated due to length limit)"
    }

    // Добавляем сообщение если команда превысила время ожидания
    if (timedOut) {
      output += `\n\n(Command timed out after ${timeout} ms)`
    }

    // Добавляем сообщение если команда была отменена пользователем
    if (aborted) {
      output += "\n\n(Command was aborted)"
    }

    // Возвращаем результаты выполнения команды
    return {
      title: params.command, // Название = сама команда
      metadata: {
        output, // Вывод команды
        exit: proc.exitCode, // Код выхода процесса
        description: params.description, // Описание команды
      },
      output, // Основной вывод
    }
  },
})
