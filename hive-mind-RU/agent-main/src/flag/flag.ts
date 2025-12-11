// Flag модуль управляет переменными окружения и флагами функциональности
// Предоставляет доступ к конфигурационным переменным и экспериментальным функциям
export namespace Flag {
  // OPENCODE_AUTO_SHARE removed - no sharing support
  // Переменная окружения для пути к конфигурационному файлу
  export const OPENCODE_CONFIG = process.env["OPENCODE_CONFIG"]

  // Переменная окружения для директории конфигурации
  export const OPENCODE_CONFIG_DIR = process.env["OPENCODE_CONFIG_DIR"]

  // Переменная окружения для содержимого конфигурации (в формате строки)
  export const OPENCODE_CONFIG_CONTENT = process.env["OPENCODE_CONFIG_CONTENT"]

  // Флаг для отключения автоматического обновления приложения
  export const OPENCODE_DISABLE_AUTOUPDATE = truthy("OPENCODE_DISABLE_AUTOUPDATE")

  // Флаг для отключения автоматической очистки (pruning) неиспользуемых данных
  export const OPENCODE_DISABLE_PRUNE = truthy("OPENCODE_DISABLE_PRUNE")

  // Флаг для включения экспериментальных AI моделей
  export const OPENCODE_ENABLE_EXPERIMENTAL_MODELS = truthy("OPENCODE_ENABLE_EXPERIMENTAL_MODELS")

  // Флаг для отключения автоматической оптимизации размера (autocompact)
  export const OPENCODE_DISABLE_AUTOCOMPACT = truthy("OPENCODE_DISABLE_AUTOCOMPACT")

  // Экспериментальные флаги функциональности
  // Общий флаг для включения всех экспериментальных функций
  export const OPENCODE_EXPERIMENTAL = truthy("OPENCODE_EXPERIMENTAL")

  // Флаг для экспериментального режима наблюдения за файлами (watcher)
  // Включается если либо OPENCODE_EXPERIMENTAL=true, либо явно установлен этот флаг
  export const OPENCODE_EXPERIMENTAL_WATCHER = OPENCODE_EXPERIMENTAL || truthy("OPENCODE_EXPERIMENTAL_WATCHER")

  // Вспомогательная функция для преобразования строкового значения в boolean
  // Возвращает true если значение переменной окружения - "true" или "1"
  function truthy(key: string) {
    const value = process.env[key]?.toLowerCase()
    return value === "true" || value === "1"
  }
}
