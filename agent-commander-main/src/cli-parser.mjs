/**
 * Parse CLI arguments
 * Simple argument parser without external dependencies
 */

// Модуль для парсинга аргументов командной строки.
// Простой парсер без внешних зависимостей, поддерживающий long-форматы (--option).
// Обрабатывает как флаги (--flag), так и опции со значениями (--option value).

/**
 * Parse command line arguments
 * @param {string[]} args - Process arguments
 * @returns {Object} Parsed options
 */
// Парсит аргументы командной строки в объект опций.
// Поддерживает --option value для опций со значениями и --flag для булевых флагов.
// Позиционные аргументы (без --) сохраняются в _positional.
export function parseArgs(args) {
  const options = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      // Извлекаем имя опции (убираем --)
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Проверяем, это флаг (булевый) или опция со значением
      if (nextArg && !nextArg.startsWith('--')) {
        // Следующий аргумент - значение опции
        options[key] = nextArg;
        i++; // Пропускаем следующий аргумент, так как это значение
      } else {
        // Флаг без значения (булевый)
        options[key] = true;
      }
    } else {
      // Позиционный аргумент (без --)
      positional.push(arg);
    }
  }

  options._positional = positional;
  return options;
}

/**
 * Parse start-agent CLI arguments
 * @param {string[]} args - Process arguments
 * @returns {Object} Parsed configuration
 */
// Парсит аргументы для команды start-agent.
// Преобразует аргументы в структурированный объект конфигурации с дефолтными значениями.
export function parseStartAgentArgs(args) {
  const parsed = parseArgs(args);

  return {
    tool: parsed.tool,                           // CLI инструмент для запуска
    workingDirectory: parsed['working-directory'], // Рабочая директория
    prompt: parsed.prompt,                        // Пользовательский промпт
    systemPrompt: parsed['system-prompt'],        // Системный промпт
    isolation: parsed.isolation || 'none',        // Режим изоляции (по умолчанию none)
    screenName: parsed['screen-name'],            // Имя screen сессии
    containerName: parsed['container-name'],      // Имя docker контейнера
    dryRun: parsed['dry-run'] || false,          // Режим пробного запуска
    detached: parsed.detached || false,          // Отсоединённый режим
    attached: !parsed.detached,                  // Присоединённый режим (по умолчанию если не detached)
    help: parsed.help || parsed.h || false,      // Запрос справки
  };
}

/**
 * Parse stop-agent CLI arguments
 * @param {string[]} args - Process arguments
 * @returns {Object} Parsed configuration
 */
// Парсит аргументы для команды stop-agent.
// Возвращает минимальный набор опций, необходимых для остановки агента.
export function parseStopAgentArgs(args) {
  const parsed = parseArgs(args);

  return {
    isolation: parsed.isolation,             // Режим изоляции (screen/docker)
    screenName: parsed['screen-name'],       // Имя screen сессии для остановки
    containerName: parsed['container-name'], // Имя docker контейнера для остановки
    dryRun: parsed['dry-run'] || false,     // Режим пробного запуска
    help: parsed.help || parsed.h || false, // Запрос справки
  };
}

/**
 * Show start-agent help message
 */
// Выводит справочное сообщение для команды start-agent.
// Показывает синтаксис, доступные опции и примеры использования.
export function showStartAgentHelp() {
  console.log(`
Usage: start-agent [options]

Options:
  --tool <name>                    CLI tool to use (e.g., 'claude') [required]
  --working-directory <path>       Working directory for the agent [required]
  --prompt <text>                  Prompt for the agent
  --system-prompt <text>           System prompt for the agent
  --isolation <mode>               Isolation mode: none, screen, docker (default: none)
  --screen-name <name>             Screen session name (required for screen isolation)
  --container-name <name>          Container name (required for docker isolation)
  --detached                       Run in detached mode
  --dry-run                        Show command without executing
  --help, -h                       Show this help message

Examples:
  # Basic usage (no isolation)
  start-agent --tool claude --working-directory "/tmp/dir" --prompt "Hello"

  # With screen isolation (detached)
  start-agent --tool claude --working-directory "/tmp/dir" \\
    --isolation screen --screen-name my-agent --detached

  # With docker isolation (attached)
  start-agent --tool claude --working-directory "/tmp/dir" \\
    --isolation docker --container-name my-container

  # Dry run
  start-agent --tool claude --working-directory "/tmp/dir" --dry-run
`);
}

/**
 * Show stop-agent help message
 */
// Выводит справочное сообщение для команды stop-agent.
// Показывает синтаксис, доступные опции и примеры использования.
export function showStopAgentHelp() {
  console.log(`
Usage: stop-agent [options]

Options:
  --isolation <mode>               Isolation mode: screen, docker [required]
  --screen-name <name>             Screen session name (required for screen isolation)
  --container-name <name>          Container name (required for docker isolation)
  --dry-run                        Show command without executing
  --help, -h                       Show this help message

Examples:
  # Stop screen session
  stop-agent --isolation screen --screen-name my-agent

  # Stop docker container
  stop-agent --isolation docker --container-name my-container

  # Dry run
  stop-agent --isolation screen --screen-name my-agent --dry-run
`);
}

/**
 * Validate start-agent options
 * @param {Object} options - Parsed options
 * @returns {Object} Validation result with { valid: boolean, errors: string[] }
 */
// Валидирует опции для команды start-agent.
// Проверяет наличие обязательных параметров и корректность значений.
// Возвращает объект с флагом valid и массивом ошибок.
export function validateStartAgentOptions(options) {
  const errors = [];

  // Проверяем обязательные параметры
  if (!options.tool) {
    errors.push('--tool is required');
  }

  if (!options.workingDirectory) {
    errors.push('--working-directory is required');
  }

  // Проверяем специфичные требования для режимов изоляции
  if (options.isolation === 'screen' && !options.screenName) {
    errors.push('--screen-name is required for screen isolation');
  }

  if (options.isolation === 'docker' && !options.containerName) {
    errors.push('--container-name is required for docker isolation');
  }

  // Проверяем корректность значения isolation
  if (options.isolation && !['none', 'screen', 'docker'].includes(options.isolation)) {
    errors.push('--isolation must be one of: none, screen, docker');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate stop-agent options
 * @param {Object} options - Parsed options
 * @returns {Object} Validation result with { valid: boolean, errors: string[] }
 */
// Валидирует опции для команды stop-agent.
// Проверяет наличие режима изоляции и соответствующего имени (screen/container).
// Возвращает объект с флагом valid и массивом ошибок.
export function validateStopAgentOptions(options) {
  const errors = [];

  // Режим изоляции обязателен для остановки
  if (!options.isolation) {
    errors.push('--isolation is required');
  }

  // Для остановки допустимы только screen и docker
  if (options.isolation && !['screen', 'docker'].includes(options.isolation)) {
    errors.push('--isolation must be one of: screen, docker');
  }

  // Проверяем наличие имени для соответствующего режима
  if (options.isolation === 'screen' && !options.screenName) {
    errors.push('--screen-name is required for screen isolation');
  }

  if (options.isolation === 'docker' && !options.containerName) {
    errors.push('--container-name is required for docker isolation');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
