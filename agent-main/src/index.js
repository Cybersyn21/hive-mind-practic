#!/usr/bin/env bun

/**
 * Главный файл агента - точка входа в приложение.
 *
 * Этот модуль реализует CLI интерфейс для агента на основе OpenCode.
 * Агент может работать в двух режимах:
 * 1. Server Mode - запускает HTTP сервер для обработки запросов
 * 2. Direct Mode - обрабатывает запросы напрямую без сервера
 *
 * Основные функции:
 * - Чтение входных данных из stdin (JSON или текст)
 * - Создание и управление сессиями агента
 * - Обработка событий через систему шины (Bus)
 * - Вывод событий в различных JSON форматах (OpenCode или Claude)
 * - Поддержка кастомных системных сообщений для промптов
 * - Обработка команд MCP (Model Context Protocol)
 */

import { Server } from './server/server.ts'
import { Instance } from './project/instance.ts'
import { Log } from './util/log.ts'
import { Bus } from './bus/index.ts'
import { Session } from './session/index.ts'
import { SessionPrompt } from './session/prompt.ts'
import { EOL } from 'os'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createEventHandler, isValidJsonStandard } from './json-standard/index.ts'
import { McpCommand } from './cli/cmd/mcp.ts'

// Отслеживание ошибок для правильного кода возврата процесса
let hasError = false

// Установка глобальных обработчиков ошибок для гарантии ненулевого кода выхода
// Это важно для интеграции с другими системами (CI/CD, скрипты и т.д.)
process.on('uncaughtException', (error) => {
  hasError = true
  console.error(JSON.stringify({
    type: 'error',
    errorType: error.name || 'UncaughtException',
    message: error.message,
    stack: error.stack
  }, null, 2))
  process.exit(1)
})

// Обработчик необработанных Promise rejection'ов
process.on('unhandledRejection', (reason, promise) => {
  hasError = true
  console.error(JSON.stringify({
    type: 'error',
    errorType: 'UnhandledRejection',
    message: reason?.message || String(reason),
    stack: reason?.stack
  }, null, 2))
  process.exit(1)
})

/**
 * Асинхронно читает данные из stdin.
 * Используется для получения входных данных от пользователя или других программ.
 *
 * @returns {Promise<string>} Promise с прочитанными данными из stdin
 */
async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ''
    // Обработчик получения данных - накапливает chunks
    const onData = chunk => {
      data += chunk
    }
    // Обработчик завершения потока - возвращает накопленные данные
    const onEnd = () => {
      cleanup()
      resolve(data)
    }
    // Обработчик ошибок чтения
    const onError = err => {
      cleanup()
      reject(err)
    }
    // Очистка обработчиков событий для предотвращения утечек памяти
    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.removeListener('end', onEnd)
      process.stdin.removeListener('error', onError)
    }
    // Регистрация обработчиков событий stdin
    process.stdin.on('data', onData)
    process.stdin.on('end', onEnd)
    process.stdin.on('error', onError)
  })
}

/**
 * Запускает агента в режиме обработки входных данных из stdin.
 * Обрабатывает параметры командной строки, читает системные сообщения,
 * парсит входные данные и выбирает режим работы (server или direct).
 *
 * @param {Object} argv - Аргументы командной строки из yargs
 */
async function runAgentMode(argv) {
  // Парсинг аргумента модели в формате providerID/modelID
  const modelParts = argv.model.split('/')
  const providerID = modelParts[0] || 'opencode'
  const modelID = modelParts[1] || 'grok-code'

  // Валидация и получение стандарта JSON (opencode или claude)
  const jsonStandard = argv['json-standard']
  if (!isValidJsonStandard(jsonStandard)) {
    console.error(`Invalid JSON standard: ${jsonStandard}. Use "opencode" or "claude".`)
    process.exit(1)
  }

  // Чтение системных сообщений из файлов (если указаны)
  let systemMessage = argv['system-message']
  let appendSystemMessage = argv['append-system-message']

  // Загрузка полного системного сообщения из файла
  if (argv['system-message-file']) {
    const resolvedPath = require('path').resolve(process.cwd(), argv['system-message-file'])
    const file = Bun.file(resolvedPath)
    if (!(await file.exists())) {
      console.error(`System message file not found: ${argv['system-message-file']}`)
      process.exit(1)
    }
    systemMessage = await file.text()
  }

  // Загрузка дополнительного системного сообщения из файла
  if (argv['append-system-message-file']) {
    const resolvedPath = require('path').resolve(process.cwd(), argv['append-system-message-file'])
    const file = Bun.file(resolvedPath)
    if (!(await file.exists())) {
      console.error(`Append system message file not found: ${argv['append-system-message-file']}`)
      process.exit(1)
    }
    appendSystemMessage = await file.text()
  }

  // Инициализация логирования с перенаправлением в файл вместо stderr
  // Это предотвращает смешивание логов с JSON выводом
  await Log.init({
    print: false,  // Не выводить в stderr
    level: 'INFO'
  })

  // Чтение входных данных из stdin
  const input = await readStdin()
  const trimmedInput = input.trim()

  // Попытка распарсить как JSON, если не удается - трактуем как обычный текст
  let request
  try {
    request = JSON.parse(trimmedInput)
  } catch (e) {
    // Не JSON, обрабатываем как текстовое сообщение
    request = {
      message: trimmedInput
    }
  }

  // Оборачиваем в Instance.provide для использования инфраструктуры OpenCode
  await Instance.provide({
    directory: process.cwd(),
    fn: async () => {
      if (argv.server) {
        // РЕЖИМ СЕРВЕРА: Запуск HTTP сервера для коммуникации
        await runServerMode(request, providerID, modelID, systemMessage, appendSystemMessage, jsonStandard)
      } else {
        // ПРЯМОЙ РЕЖИМ: Выполнение всего в одном процессе без сервера
        await runDirectMode(request, providerID, modelID, systemMessage, appendSystemMessage, jsonStandard)
      }
    }
  })

  // Явный выход для гарантии завершения процесса с правильным кодом
  process.exit(hasError ? 1 : 0)
}

/**
 * Запускает агента в режиме сервера.
 * В этом режиме создается HTTP сервер для обработки запросов через REST API.
 * События передаются через систему шины (Bus) и выводятся в выбранном JSON формате.
 *
 * @param {Object} request - Объект запроса с сообщением или инструментами
 * @param {string} providerID - ID провайдера модели (например, 'opencode')
 * @param {string} modelID - ID модели (например, 'grok-code')
 * @param {string} systemMessage - Полное системное сообщение для переопределения
 * @param {string} appendSystemMessage - Дополнительное системное сообщение
 * @param {string} jsonStandard - Стандарт JSON для вывода ('opencode' или 'claude')
 */
async function runServerMode(request, providerID, modelID, systemMessage, appendSystemMessage, jsonStandard) {
  // Запуск сервера как в OpenCode (порт 0 = автоматический выбор свободного порта)
  const server = Server.listen({ port: 0, hostname: "127.0.0.1" })
  let unsub = null

  try {
    // Создание сессии через HTTP API
    const createRes = await fetch(`http://${server.hostname}:${server.port}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    const session = await createRes.json()
    const sessionID = session.id

    if (!sessionID) {
      throw new Error("Failed to create session")
    }

    // Создание обработчика событий для выбранного JSON стандарта
    const eventHandler = createEventHandler(jsonStandard, sessionID)

    // Подписка на все события шины и вывод в выбранном формате
    const eventPromise = new Promise((resolve) => {
      unsub = Bus.subscribeAll((event) => {
        // Вывод событий в выбранном JSON формате
        if (event.type === 'message.part.updated') {
          const part = event.properties.part
          if (part.sessionID !== sessionID) return

          // Обработка различных типов событий
          // Событие начала шага обработки
          if (part.type === 'step-start') {
            eventHandler.output({
              type: 'step_start',
              timestamp: Date.now(),
              sessionID,
              part
            })
          }

          // Событие завершения шага обработки
          if (part.type === 'step-finish') {
            eventHandler.output({
              type: 'step_finish',
              timestamp: Date.now(),
              sessionID,
              part
            })
          }

          // Событие текстового ответа (только если время окончания установлено)
          if (part.type === 'text' && part.time?.end) {
            eventHandler.output({
              type: 'text',
              timestamp: Date.now(),
              sessionID,
              part
            })
          }

          // Событие использования инструмента (только при завершении)
          if (part.type === 'tool' && part.state.status === 'completed') {
            eventHandler.output({
              type: 'tool_use',
              timestamp: Date.now(),
              sessionID,
              part
            })
          }
        }

        // Обработка простоя сессии для определения момента остановки
        if (event.type === 'session.idle' && event.properties.sessionID === sessionID) {
          resolve()
        }

        // Обработка ошибок
        if (event.type === 'session.error') {
          const props = event.properties
          if (props.sessionID !== sessionID || !props.error) return
          hasError = true
          eventHandler.output({
            type: 'error',
            timestamp: Date.now(),
            sessionID,
            error: props.error
          })
        }
      })
    })

    // Отправка сообщения в сессию с указанной моделью (по умолчанию: opencode/grok-code)
    const message = request.message || "hi"
    const parts = [{ type: "text", text: message }]

    // Запуск промпта (не ждем ответа, события приходят через Bus)
    fetch(`http://${server.hostname}:${server.port}/session/${sessionID}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts,
        model: {
          providerID,
          modelID
        },
        system: systemMessage, // Полное переопределение системного сообщения
        appendSystem: appendSystemMessage // Дополнение к системному сообщению
      })
    }).catch((error) => {
      hasError = true
      eventHandler.output({
        type: 'error',
        timestamp: Date.now(),
        sessionID,
        error: error instanceof Error ? error.message : String(error)
      })
    })

    // Ожидание простоя сессии (завершения обработки)
    await eventPromise
  } finally {
    // Всегда очищаем ресурсы для предотвращения утечек
    if (unsub) unsub()
    server.stop()
    await Instance.dispose()
  }
}

/**
 * Запускает агента в прямом режиме (без сервера).
 * В этом режиме все выполняется в одном процессе, без HTTP коммуникации.
 * События по-прежнему передаются через Bus, но сессия создается напрямую.
 *
 * @param {Object} request - Объект запроса с сообщением или инструментами
 * @param {string} providerID - ID провайдера модели
 * @param {string} modelID - ID модели
 * @param {string} systemMessage - Полное системное сообщение
 * @param {string} appendSystemMessage - Дополнительное системное сообщение
 * @param {string} jsonStandard - Стандарт JSON для вывода
 */
async function runDirectMode(request, providerID, modelID, systemMessage, appendSystemMessage, jsonStandard) {
  // ПРЯМОЙ РЕЖИМ: Выполнение в одном процессе без сервера
  let unsub = null

  try {
    // Создание сессии напрямую без HTTP API
    const session = await Session.createNext({
      directory: process.cwd()
    })
    const sessionID = session.id

    // Создание обработчика событий для выбранного JSON стандарта
    const eventHandler = createEventHandler(jsonStandard, sessionID)

    // Подписка на все события шины и вывод в выбранном формате
    // Логика идентична серверному режиму, но без HTTP коммуникации
    const eventPromise = new Promise((resolve) => {
      unsub = Bus.subscribeAll((event) => {
        // Вывод событий в выбранном JSON формате
        if (event.type === 'message.part.updated') {
          const part = event.properties.part
          if (part.sessionID !== sessionID) return

          // Обработка различных типов событий
          if (part.type === 'step-start') {
            eventHandler.output({
              type: 'step_start',
              timestamp: Date.now(),
              sessionID,
              part
            })
          }

          if (part.type === 'step-finish') {
            eventHandler.output({
              type: 'step_finish',
              timestamp: Date.now(),
              sessionID,
              part
            })
          }

          if (part.type === 'text' && part.time?.end) {
            eventHandler.output({
              type: 'text',
              timestamp: Date.now(),
              sessionID,
              part
            })
          }

          if (part.type === 'tool' && part.state.status === 'completed') {
            eventHandler.output({
              type: 'tool_use',
              timestamp: Date.now(),
              sessionID,
              part
            })
          }
        }

        // Обработка простоя сессии для определения момента остановки
        if (event.type === 'session.idle' && event.properties.sessionID === sessionID) {
          resolve()
        }

        // Обработка ошибок
        if (event.type === 'session.error') {
          const props = event.properties
          if (props.sessionID !== sessionID || !props.error) return
          hasError = true
          eventHandler.output({
            type: 'error',
            timestamp: Date.now(),
            sessionID,
            error: props.error
          })
        }
      })
    })

    // Отправка сообщения в сессию напрямую (без HTTP)
    const message = request.message || "hi"
    const parts = [{ type: "text", text: message }]

    // Запуск промпта напрямую без HTTP коммуникации
    SessionPrompt.prompt({
      sessionID,
      parts,
      model: {
        providerID,
        modelID
      },
      system: systemMessage,
      appendSystem: appendSystemMessage
    }).catch((error) => {
      hasError = true
      eventHandler.output({
        type: 'error',
        timestamp: Date.now(),
        sessionID,
        error: error instanceof Error ? error.message : String(error)
      })
    })

    // Ожидание простоя сессии (завершения обработки)
    await eventPromise
  } finally {
    // Всегда очищаем ресурсы
    if (unsub) unsub()
    await Instance.dispose()
  }
}

/**
 * Главная функция программы.
 * Парсит аргументы командной строки и запускает соответствующий режим работы.
 *
 * Поддерживаемые режимы:
 * - MCP команда (через McpCommand)
 * - Режим агента (чтение из stdin и обработка запросов)
 */
async function main() {
  try {
    // Парсинг аргументов командной строки с поддержкой подкоманд
    const argv = await yargs(hideBin(process.argv))
      .scriptName('agent')
      .usage('$0 [command] [options]')
      // Подкоманда MCP (Model Context Protocol)
      .command(McpCommand)
      // Опции для режима агента по умолчанию (при передаче данных через stdin)
      .option('model', {
        type: 'string',
        description: 'Model to use in format providerID/modelID',
        default: 'opencode/grok-code'
      })
      .option('json-standard', {
        type: 'string',
        description: 'JSON output format standard: "opencode" (default) or "claude" (experimental)',
        default: 'opencode',
        choices: ['opencode', 'claude']
      })
      .option('system-message', {
        type: 'string',
        description: 'Full override of the system message'
      })
      .option('system-message-file', {
        type: 'string',
        description: 'Full override of the system message from file'
      })
      .option('append-system-message', {
        type: 'string',
        description: 'Append to the default system message'
      })
      .option('append-system-message-file', {
        type: 'string',
        description: 'Append to the default system message from file'
      })
      .option('server', {
        type: 'boolean',
        description: 'Run in server mode (default)',
        default: true
      })
      .help()
      .argv

    // Если была выполнена команда (например, mcp), yargs обрабатывает её
    // В противном случае проверяем, нужно ли запустить режим агента (stdin piped)
    const commandExecuted = argv._ && argv._.length > 0

    if (!commandExecuted) {
      // Команда не указана, запускаем режим агента по умолчанию (обработка stdin)
      await runAgentMode(argv)
    }
  } catch (error) {
    hasError = true
    console.error(JSON.stringify({
      type: 'error',
      timestamp: Date.now(),
      errorType: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, null, 2))
    process.exit(1)
  }
}

// Запуск главной функции
main()
