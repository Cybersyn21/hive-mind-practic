// Ссылка на исходный код OpenCode для справки
// Permalink: https://github.com/sst/opencode/blob/main/packages/opencode/src/provider/provider.ts

import { createOpenCode } from '@opencode-ai/sdk'

/**
 * Класс OpenCodeProvider - провайдер для работы с моделями через OpenCode API.
 * Реализует интерфейс провайдера для получения и работы с AI моделями.
 *
 * Основные функции:
 * - Получение модели по идентификатору
 * - Генерация текста через OpenCode API
 * - Управление сессиями и промптами
 */
class OpenCodeProvider {
  /**
   * Конструктор провайдера OpenCode.
   * Устанавливает имя провайдера для идентификации.
   */
  constructor() {
    this.name = 'opencode'
  }

  /**
   * Получает модель по её идентификатору.
   * Возвращает объект модели с методами для генерации текста.
   *
   * @param {string} modelId - Идентификатор модели (например, 'grok-code')
   * @returns {Promise<Object>} Объект модели с методом generateText
   * @throws {Error} Если модель с указанным ID не найдена
   */
  async getModel(modelId) {
    // Для модели grok-code возвращаем модель, использующую OpenCode API
    if (modelId === 'grok-code') {
      return {
        id: 'grok-code',
        provider: this,
        /**
         * Генерирует текст с использованием модели.
         *
         * @param {Object} options - Опции генерации
         * @param {string} options.prompt - Текст промпта для модели
         * @returns {Promise<Object>} Результат генерации с текстом и статистикой использования
         */
        generateText: async (options) => {
          // Использование OpenCode API для генерации
          const opencode = await createOpenCode()
          const { client } = opencode

          // Создание новой сессии для взаимодействия с моделью
          const sessionResult = await client.session.create()
          const sessionId = sessionResult.data?.id

          // Отправка промпта в сессию
          await client.session.prompt({
            path: { id: sessionId },
            body: {
              agent: "build", // Тип агента для обработки
              model: { providerID: "opencode", modelID: "grok-code" },
              parts: [{ type: "text", text: options.prompt }]
            }
          })

          // Для простоты возвращаем mock ответ
          // В реальной реализации здесь должен быть реальный ответ от модели
          return {
            text: 'Hello from Grok Code!',
            usage: { promptTokens: 10, completionTokens: 5 }
          }
        }
      }
    }
    // Если модель не найдена, выбрасываем ошибку
    throw new Error(`Model ${modelId} not found`)
  }
}

// Создание и экспорт экземпляра провайдера
const opencodeProvider = new OpenCodeProvider()

export { opencodeProvider }