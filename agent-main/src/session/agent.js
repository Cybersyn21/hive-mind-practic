// Ссылки на исходный код OpenCode для справки
// Permalink: https://github.com/sst/opencode/blob/main/packages/opencode/src/session/prompt.ts
// Permalink: https://github.com/sst/opencode/blob/main/packages/opencode/src/session/index.ts
// Permalink: https://github.com/sst/opencode/blob/main/packages/opencode/src/provider/provider.ts

import { ToolRegistry } from '../tool/registry.ts'

/**
 * Класс Agent - основной класс для обработки агентских запросов и выполнения инструментов.
 * Эмулирует поведение OpenCode, генерируя события и выполняя инструменты.
 *
 * Основные возможности:
 * - Генерация уникальных идентификаторов для сессий и сообщений
 * - Обработка текстовых сообщений
 * - Выполнение инструментов (tools) с передачей результатов
 * - Эмиссия событий в формате OpenCode (step_start, text, tool_use, step_finish)
 */
export class Agent {
  /**
   * Конструктор создает новый экземпляр агента и генерирует уникальные идентификаторы.
   * Идентификаторы генерируются в том же формате, что и в OpenCode, используя:
   * - Временную метку в base36
   * - Случайную строку для уникальности
   */
  constructor() {
    // Генерация случайного идентификатора в формате base36
    const randomId = Math.random().toString(36).substring(2, 15)
    // Создание ID сессии с префиксом 'ses_'
    this.sessionID = `ses_${Date.now().toString(36)}${randomId}`
    // Создание ID сообщения с префиксом 'msg_'
    this.messageID = `msg_${Date.now().toString(36)}${randomId}`
    // Счетчик частей (parts) для отслеживания компонентов ответа
    this.partCounter = 0
  }

  /**
   * Генерирует уникальный идентификатор для части ответа (part).
   * Каждая часть представляет отдельный компонент ответа агента
   * (например, текст, вызов инструмента, начало/конец шага).
   *
   * @returns {string} Уникальный ID с префиксом 'prt_'
   */
  generatePartId() {
    return `prt_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Основной метод обработки запроса к агенту.
   * Обрабатывает два типа запросов:
   * 1. Запросы на выполнение инструментов (tools)
   * 2. Обычные текстовые сообщения
   *
   * @param {Object} request - Объект запроса
   * @param {string} request.message - Текстовое сообщение (опционально)
   * @param {Array} request.tools - Массив инструментов для выполнения (опционально)
   * @returns {Promise<Object>} Объект с sessionID и временной меткой
   */
  async process(request) {
    const message = request.message || "hi"
    const sessionID = this.sessionID

    // Генерация хеша снимка состояния (заглушка для совместимости с OpenCode)
    const snapshot = Math.random().toString(16).substring(2, 42)

    // Эмиссия события начала шага обработки (аналог OpenCode)
    this.emitEvent('step_start', {
      part: {
        id: this.generatePartId(),
        sessionID,
        messageID: this.messageID,
        type: 'step-start',
        snapshot
      }
    })

    // Проверяем, является ли это запросом на выполнение инструментов
    if (request.tools && request.tools.length > 0) {
      // Обработка выполнения инструментов
      // Получаем список всех доступных инструментов из реестра
      const toolsList = await ToolRegistry.tools('', '')
      // Создаем карту инструментов для быстрого доступа по имени
      const toolsMap = Object.fromEntries(toolsList.map(t => [t.id, t]))

      // Итерируемся по всем запрошенным инструментам
      for (const tool of request.tools) {
        const toolFn = toolsMap[tool.name]
        if (toolFn) {
          try {
            const startTime = Date.now()
            // Генерация уникального ID вызова для отслеживания выполнения
            const callID = `call_${Math.floor(Math.random() * 100000000)}`

            // Создание контекста, совместимого с OpenCode
            // Контекст содержит всю необходимую информацию для выполнения инструмента
            const ctx = {
              sessionID,
              messageID: this.messageID,
              agent: 'default',
              callID,
              abort: new AbortController().signal, // Сигнал для отмены выполнения
              metadata: (data) => {
                // Обработка обновлений метаданных во время выполнения
              }
            }

            // Выполнение инструмента с переданными параметрами
            const result = await toolFn.execute(tool.params, ctx)
            const endTime = Date.now()

            // Эмиссия события использования инструмента с результатами
            this.emitEvent('tool_use', {
              part: {
                id: this.generatePartId(),
                sessionID,
                messageID: this.messageID,
                type: 'tool',
                callID,
                tool: tool.name,
                state: {
                  status: 'completed', // Статус успешного завершения
                  input: tool.params, // Входные параметры инструмента
                  output: result.output, // Результат выполнения
                  title: result.title || `${tool.name} ${JSON.stringify(tool.params)}`,
                  // Метаданные содержат дополнительную информацию о выполнении
                  metadata: result.metadata || {
                    output: result.output,
                    exit: result.exitCode || 0, // Код возврата (0 = успех)
                    ...(tool.params.description && { description: tool.params.description })
                  },
                  time: {
                    start: startTime,
                    end: endTime
                  }
                }
              }
            })
          } catch (error) {
            // Обработка ошибок при выполнении инструмента
            const errorTime = Date.now()
            const callID = `call_${Math.floor(Math.random() * 100000000)}`

            // Логирование полной ошибки в stderr для отладки
            console.error('Tool execution error:', error)

            // Эмиссия события использования инструмента с информацией об ошибке
            this.emitEvent('tool_use', {
              part: {
                id: this.generatePartId(),
                sessionID,
                messageID: this.messageID,
                type: 'tool',
                callID,
                tool: tool.name,
                state: {
                  status: 'error', // Статус ошибки
                  input: tool.params,
                  error: error.message || String(error), // Сообщение об ошибке
                  time: {
                    start: errorTime,
                    end: errorTime
                  }
                }
              }
            })
          }
        }
      }

      // Эмиссия события завершения шага для запросов с инструментами
      this.emitEvent('step_finish', {
        part: {
          id: this.generatePartId(),
          sessionID,
          messageID: this.messageID,
          type: 'step-finish',
          reason: 'stop', // Причина завершения: нормальная остановка
          snapshot,
          cost: 0, // Стоимость выполнения (в данном случае 0)
          // Информация об использованных токенах (mock данные для совместимости)
          tokens: {
            input: 1273, // Входные токены
            output: 2, // Выходные токены
            reasoning: 173, // Токены рассуждения
            cache: { read: 9536, write: 0 } // Использование кеша
          }
        }
      })

      return {
        sessionID,
        timestamp: Date.now()
      }
    }

    // Обработка обычных текстовых сообщений (без инструментов)
    // Симуляция задержки обработки для реалистичности
    await new Promise(resolve => setTimeout(resolve, 100))

    // Генерация текстового ответа в стиле OpenCode
    const responseText = message === "hi" ? "Hi!" : `You said: "${message}"`
    this.emitEvent('text', {
      part: {
        id: this.generatePartId(),
        sessionID,
        messageID: this.messageID,
        type: 'text',
        text: responseText,
        time: {
          start: Date.now(),
          end: Date.now()
        }
      }
    })

    // Эмиссия события завершения шага с информацией о стоимости и токенах
    this.emitEvent('step_finish', {
      part: {
        id: this.generatePartId(),
        sessionID,
        messageID: this.messageID,
        type: 'step-finish',
        reason: 'stop',
        snapshot,
        cost: 0,
        // Mock данные о токенах для совместимости с форматом OpenCode
        tokens: {
          input: 1273,
          output: 2,
          reasoning: 173,
          cache: { read: 9536, write: 0 }
        }
      }
    })

    return {
      sessionID,
      timestamp: Date.now()
    }
  }

  /**
   * Эмитирует событие в stdout в формате JSON.
   * События используются для коммуникации с клиентами агента.
   *
   * @param {string} type - Тип события (step_start, text, tool_use, step_finish и т.д.)
   * @param {Object} data - Данные события
   *
   * Формат вывода:
   * - Если установлена переменная окружения AGENT_CLI_COMPACT=1, выводится компактный JSON
   * - В противном случае выводится форматированный JSON с отступами (для удобства чтения человеком)
   */
  emitEvent(type, data) {
    const event = {
      type,
      timestamp: Date.now(),
      sessionID: this.sessionID,
      ...data
    }
    // Выбор формата вывода: компактный для программного использования, форматированный для людей
    // Используйте AGENT_CLI_COMPACT=1 для компактного вывода (тесты, автоматизация)
    const compact = process.env.AGENT_CLI_COMPACT === '1'
    console.log(compact ? JSON.stringify(event) : JSON.stringify(event, null, 2))
  }
}