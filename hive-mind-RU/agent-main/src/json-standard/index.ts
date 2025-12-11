/**
 * JSON Standard Format Handlers
 *
 * Provides adapters for different JSON output formats:
 * - opencode: OpenCode format (default) - pretty-printed JSON events
 * - claude: Claude CLI stream-json format - NDJSON (newline-delimited JSON)
 */

// Обработчики форматов JSON вывода
// Предоставляет адаптеры для различных форматов JSON:
// - opencode: формат OpenCode (по умолчанию) - форматированный JSON с отступами
// - claude: формат Claude CLI stream-json - NDJSON (JSON с разделителями-переводами строк)

import { EOL } from 'os'

// Поддерживаемые стандарты JSON вывода
export type JsonStandard = 'opencode' | 'claude'

/**
 * OpenCode JSON event types
 */
// Типы событий JSON в формате OpenCode
// Описывает структуру событий для вывода в формате OpenCode
export interface OpenCodeEvent {
  type: 'step_start' | 'step_finish' | 'text' | 'tool_use' | 'error' // Тип события
  timestamp: number // Временная метка в миллисекундах
  sessionID: string // Идентификатор сессии
  part?: Record<string, unknown> // Дополнительные данные части сообщения
  error?: string | Record<string, unknown> // Информация об ошибке
}

/**
 * Claude JSON event types (stream-json format)
 */
// Типы событий JSON в формате Claude CLI
// Описывает структуру событий для совместимости с Claude CLI stream-json форматом
export interface ClaudeEvent {
  type: 'init' | 'message' | 'tool_use' | 'tool_result' | 'result' // Тип события
  timestamp?: string // Временная метка в формате ISO
  session_id?: string // Идентификатор сессии
  role?: 'assistant' | 'user' // Роль отправителя сообщения
  content?: Array<{type: 'text' | 'tool_use', text?: string, name?: string, input?: unknown}> // Содержимое сообщения
  output?: string // Вывод результата
  name?: string // Имя инструмента
  input?: unknown // Входные данные инструмента
  tool_use_id?: string // Идентификатор вызова инструмента
  status?: 'success' | 'error' // Статус выполнения
  duration_ms?: number // Длительность в миллисекундах
  model?: string // Используемая модель
}

/**
 * Serialize JSON output based on the selected standard
 */
// Сериализует JSON вывод в зависимости от выбранного стандарта
// Для claude - компактный NDJSON (одна строка), для opencode - форматированный с отступами
export function serializeOutput(event: OpenCodeEvent | ClaudeEvent, standard: JsonStandard): string {
  if (standard === 'claude') {
    // NDJSON формат - компактный, одна строка
    return JSON.stringify(event) + EOL
  }
  // OpenCode формат - с форматированием и отступами
  return JSON.stringify(event, null, 2) + EOL
}

/**
 * Convert OpenCode event to Claude event format
 */
// Конвертирует событие OpenCode в формат события Claude
// Возвращает null, если событие не может быть сконвертировано
export function convertOpenCodeToClaude(event: OpenCodeEvent, startTime: number): ClaudeEvent | null {
  const timestamp = new Date(event.timestamp).toISOString()
  const session_id = event.sessionID

  // Конвертируем каждый тип события OpenCode в соответствующий тип Claude
  switch (event.type) {
    case 'step_start':
      // Начало шага -> инициализация
      return {
        type: 'init',
        timestamp,
        session_id
      }

    case 'text':
      // Текстовое сообщение -> сообщение ассистента
      if (event.part && typeof event.part.text === 'string') {
        return {
          type: 'message',
          timestamp,
          session_id,
          role: 'assistant',
          content: [{
            type: 'text',
            text: event.part.text
          }]
        }
      }
      return null

    case 'tool_use':
      // Использование инструмента -> вызов инструмента
      if (event.part && event.part.state) {
        const state = event.part.state as Record<string, unknown>
        const tool = state.tool as Record<string, unknown> | undefined
        return {
          type: 'tool_use',
          timestamp,
          session_id,
          name: (tool?.name as string) || 'unknown',
          input: tool?.parameters || {},
          tool_use_id: event.part.id as string
        }
      }
      return null

    case 'step_finish':
      // Завершение шага -> результат с успехом
      return {
        type: 'result',
        timestamp,
        session_id,
        status: 'success',
        duration_ms: event.timestamp - startTime
      }

    case 'error':
      // Ошибка -> результат с ошибкой
      return {
        type: 'result',
        timestamp,
        session_id,
        status: 'error',
        output: typeof event.error === 'string' ? event.error : JSON.stringify(event.error)
      }

    default:
      return null
  }
}

/**
 * Create an event output handler based on the selected standard
 */
// Создает обработчик вывода событий на основе выбранного стандарта
// Возвращает объект с методами для форматирования и вывода событий
export function createEventHandler(standard: JsonStandard, sessionID: string) {
  const startTime = Date.now()

  return {
    /**
     * Format and output an event
     */
    // Форматирует и выводит событие в stdout
    // Для claude - конвертирует и выводит в формате Claude, для opencode - выводит как есть
    output(event: OpenCodeEvent): void {
      if (standard === 'claude') {
        const claudeEvent = convertOpenCodeToClaude(event, startTime)
        if (claudeEvent) {
          process.stdout.write(serializeOutput(claudeEvent, standard))
        }
      } else {
        process.stdout.write(serializeOutput(event, standard))
      }
    },

    /**
     * Get the start time for duration calculations
     */
    // Возвращает время начала для расчета длительности
    getStartTime(): number {
      return startTime
    }
  }
}

/**
 * Validate JSON standard option
 */
// Проверяет, является ли значение допустимым стандартом JSON
// Type guard для JsonStandard
export function isValidJsonStandard(value: string): value is JsonStandard {
  return value === 'opencode' || value === 'claude'
}
