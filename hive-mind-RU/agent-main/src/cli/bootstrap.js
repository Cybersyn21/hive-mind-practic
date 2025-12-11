// Ссылки на исходный код OpenCode для справки
// Permalink: https://github.com/sst/opencode/blob/main/packages/opencode/src/cli/bootstrap.ts
// Permalink: https://github.com/sst/opencode/blob/main/packages/opencode/src/project/instance.ts
// Permalink: https://github.com/sst/opencode/blob/main/packages/opencode/src/project/bootstrap.ts

/**
 * Модуль bootstrap - отвечает за инициализацию и управление экземпляром проекта.
 * Предоставляет инфраструктуру для работы с директориями проекта и рабочими деревьями.
 *
 * Основные компоненты:
 * - Instance: управляет контекстом выполнения и директориями
 * - InstanceBootstrap: выполняет инициализацию экземпляра
 * - bootstrap: основная функция для запуска кода в контексте проекта
 */

import { createOpencode } from '@opencode-ai/sdk'

/**
 * Класс Instance - управляет экземпляром проекта и его контекстом.
 * Хранит информацию о директориях и предоставляет механизм для выполнения
 * кода в контексте определенного проекта.
 */
class Instance {
  // Директория проекта (по умолчанию текущая рабочая директория)
  static directory = process.cwd()
  // Рабочее дерево проекта (обычно совпадает с directory)
  static worktree = process.cwd()

  /**
   * Предоставляет контекст для выполнения функции в рамках проекта.
   * Устанавливает директории проекта и выполняет переданную функцию.
   *
   * @param {Object} options - Опции настройки
   * @param {string} options.directory - Директория проекта
   * @param {Function} options.fn - Функция для выполнения в контексте проекта
   * @returns {Promise} Результат выполнения функции
   */
  static provide(options) {
    this.directory = options.directory
    this.worktree = options.directory
    return options.fn()
  }

  /**
   * Освобождает ресурсы и очищает контекст экземпляра.
   * Вызывается после завершения работы с проектом.
   */
  static dispose() {
    // Очистка ресурсов (в данной реализации минимальная)
  }
}

/**
 * Класс InstanceBootstrap - отвечает за инициализацию экземпляра проекта.
 * Выполняет необходимые подготовительные действия перед началом работы.
 */
class InstanceBootstrap {
  /**
   * Выполняет инициализацию экземпляра.
   * В минимальной реализации не выполняет действий, но может быть расширена.
   *
   * @returns {Promise<void>}
   */
  static async init() {
    // Минимальная инициализация (может быть расширена в будущем)
  }
}

/**
 * Основная функция bootstrap - запускает callback в контексте проекта.
 * Обеспечивает правильную инициализацию и очистку ресурсов.
 *
 * Процесс работы:
 * 1. Устанавливает контекст проекта через Instance.provide
 * 2. Выполняет переданный callback
 * 3. Гарантирует очистку ресурсов через Instance.dispose (даже при ошибках)
 *
 * @param {string} directory - Директория проекта для работы
 * @param {Function} cb - Callback функция для выполнения в контексте проекта
 * @returns {Promise} Результат выполнения callback функции
 */
export async function bootstrap(directory, cb) {
  return Instance.provide({
    directory,
    init: InstanceBootstrap,
    fn: async () => {
      try {
        // Выполняем переданную функцию в контексте проекта
        const result = await cb()
        return result
      } finally {
        // Всегда очищаем ресурсы, даже если произошла ошибка
        await Instance.dispose()
      }
    },
  })
}