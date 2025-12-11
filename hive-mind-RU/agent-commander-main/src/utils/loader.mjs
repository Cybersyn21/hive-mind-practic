/**
 * Dynamic module loader using use-m
 * Inspired by hive-mind's approach to loading dependencies
 */

// Динамический загрузчик модулей с использованием use-m.
// Вдохновлён подходом hive-mind к загрузке зависимостей.
// Позволяет загружать npm пакеты динамически во время выполнения,
// без необходимости их предварительной установки через npm install.
// Это упрощает развёртывание и позволяет работать без node_modules.

// Кэшированная функция use из библиотеки use-m
let useFunction;

/**
 * Initialize the use-m loader
 */
// Инициализирует загрузчик use-m, загружая его с CDN
async function initializeLoader() {
  // Если уже инициализирован, возвращаем кэшированную функцию
  if (useFunction) {
    return useFunction;
  }

  try {
    // Загружаем use-m с CDN unpkg
    const response = await fetch('https://unpkg.com/use-m/use.js');
    const code = await response.text();
    // Выполняем полученный код для получения модуля
    // eval используется для динамического выполнения загруженного кода
    const module = await eval(code);
    useFunction = module.use;
    return useFunction;
  } catch (error) {
    console.error('Failed to load use-m:', error.message);
    process.exit(1);
  }
}

/**
 * Load a module using use-m
 * @param {string} moduleName - The name of the module to load
 * @returns {Promise<any>} The loaded module
 */
// Загружает npm модуль динамически используя use-m.
// Модуль загружается с CDN и кэшируется для повторного использования.
export async function use(moduleName) {
  const loader = await initializeLoader();
  return await loader(moduleName);
}

/**
 * Get command-stream $ function for executing commands
 * @returns {Promise<{$: Function}>} Command execution function
 */
// Получает библиотеку command-stream для выполнения shell команд.
// Возвращает объект с функцией $ для выполнения команд в стиле tagged templates.
export async function getCommandStream() {
  const commandStream = await use('command-stream');
  return commandStream;
}

/**
 * Get getenv for environment variable access
 * @returns {Promise<Function>} getenv function
 */
// Получает библиотеку getenv для безопасного доступа к переменным окружения.
// Позволяет читать переменные окружения с валидацией и значениями по умолчанию.
export async function getEnv() {
  return await use('getenv');
}
