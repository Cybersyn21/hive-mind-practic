#!/usr/bin/env node

/**
 * Центральный модуль конфигурации для всех настраиваемых значений
 * Предоставляет переопределение через переменные окружения с разумными дефолтами
 * Используется для централизованного управления таймаутами, лимитами, путями и других параметров
 */

// Используем use-m для динамического импорта модулей
if (typeof globalThis.use === 'undefined') {
  try {
    globalThis.use = (await eval(await (await fetch('https://unpkg.com/use-m/use.js')).text())).use;
  } catch (error) {
    console.error('❌ Fatal error: Failed to load dependencies for configuration');
    console.error(`   ${error.message}`);
    console.error('   This might be due to network issues or missing dependencies.');
    console.error('   Please check your internet connection and try again.');
    process.exit(1);
  }
}

const getenv = await use('getenv');

// Импортируем lino для парсинга формата Links Notation
const { lino } = await import('./lino.lib.mjs');

// Вспомогательная функция безопасного парсинга целых чисел с фоллбэком
const parseIntWithDefault = (envVar, defaultValue) => {
  const value = getenv(envVar, defaultValue.toString());
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Вспомогательная функция безопасного парсинга чисел с плавающей точкой с фоллбэком
const parseFloatWithDefault = (envVar, defaultValue) => {
  const value = getenv(envVar, defaultValue.toString());
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Конфигурации таймаутов (в миллисекундах)
// Определяют максимальное время ожидания для различных операций
export const timeouts = {
  claudeCli: parseIntWithDefault('HIVE_MIND_CLAUDE_TIMEOUT_SECONDS', 60) * 1000,
  opencodeCli: parseIntWithDefault('HIVE_MIND_OPENCODE_TIMEOUT_SECONDS', 60) * 1000,
  codexCli: parseIntWithDefault('HIVE_MIND_CODEX_TIMEOUT_SECONDS', 60) * 1000,
  githubApiDelay: parseIntWithDefault('HIVE_MIND_GITHUB_API_DELAY_MS', 5000),
  githubRepoDelay: parseIntWithDefault('HIVE_MIND_GITHUB_REPO_DELAY_MS', 2000),
  retryBaseDelay: parseIntWithDefault('HIVE_MIND_RETRY_BASE_DELAY_MS', 5000),
  retryBackoffDelay: parseIntWithDefault('HIVE_MIND_RETRY_BACKOFF_DELAY_MS', 1000),
};

// Конфигурации автоматического продолжения работы
export const autoContinue = {
  ageThresholdHours: parseIntWithDefault('HIVE_MIND_AUTO_CONTINUE_AGE_HOURS', 24),
};

// Лимиты GitHub API
// Определяют максимальные размеры для различных типов контента
export const githubLimits = {
  commentMaxSize: parseIntWithDefault('HIVE_MIND_GITHUB_COMMENT_MAX_SIZE', 65536),
  fileMaxSize: parseIntWithDefault('HIVE_MIND_GITHUB_FILE_MAX_SIZE', 25 * 1024 * 1024),
  issueBodyMaxSize: parseIntWithDefault('HIVE_MIND_GITHUB_ISSUE_BODY_MAX_SIZE', 60000),
  attachmentMaxSize: parseIntWithDefault('HIVE_MIND_GITHUB_ATTACHMENT_MAX_SIZE', 10 * 1024 * 1024),
  bufferMaxSize: parseIntWithDefault('HIVE_MIND_GITHUB_BUFFER_MAX_SIZE', 10 * 1024 * 1024),
};

// Конфигурации памяти и диска
export const systemLimits = {
  minDiskSpaceMb: parseIntWithDefault('HIVE_MIND_MIN_DISK_SPACE_MB', 500),
  defaultPageSizeKb: parseIntWithDefault('HIVE_MIND_DEFAULT_PAGE_SIZE_KB', 16),
};

// Конфигурации повторных попыток
// Определяют количество попыток и задержки для различных операций
export const retryLimits = {
  maxForkRetries: parseIntWithDefault('HIVE_MIND_MAX_FORK_RETRIES', 5),
  maxVerifyRetries: parseIntWithDefault('HIVE_MIND_MAX_VERIFY_RETRIES', 5),
  maxApiRetries: parseIntWithDefault('HIVE_MIND_MAX_API_RETRIES', 3),
  retryBackoffMultiplier: parseFloatWithDefault('HIVE_MIND_RETRY_BACKOFF_MULTIPLIER', 2),
  max503Retries: parseIntWithDefault('HIVE_MIND_MAX_503_RETRIES', 3),
  initial503RetryDelayMs: parseIntWithDefault('HIVE_MIND_INITIAL_503_RETRY_DELAY_MS', 5 * 60 * 1000), // 5 минут
};

// Конфигурации путей к файлам и директориям
export const filePaths = {
  tempDir: getenv('HIVE_MIND_TEMP_DIR', '/tmp'),
  taskInfoFilename: getenv('HIVE_MIND_TASK_INFO_FILENAME', 'CLAUDE.md'),
  procMeminfo: getenv('HIVE_MIND_PROC_MEMINFO', '/proc/meminfo'),
};

// Конфигурации обработки текста
// Определяют параметры маскирования токенов и обрезки текста
export const textProcessing = {
  tokenMaskMinLength: parseIntWithDefault('HIVE_MIND_TOKEN_MASK_MIN_LENGTH', 12),
  tokenMaskStartChars: parseIntWithDefault('HIVE_MIND_TOKEN_MASK_START_CHARS', 5),
  tokenMaskEndChars: parseIntWithDefault('HIVE_MIND_TOKEN_MASK_END_CHARS', 5),
  textPreviewLength: parseIntWithDefault('HIVE_MIND_TEXT_PREVIEW_LENGTH', 100),
  logTruncationLength: parseIntWithDefault('HIVE_MIND_LOG_TRUNCATION_LENGTH', 5000),
};

// Конфигурации отображения UI
export const display = {
  labelWidth: parseIntWithDefault('HIVE_MIND_LABEL_WIDTH', 25),
};

// Конфигурации Sentry для мониторинга ошибок
export const sentry = {
  dsn: getenv('HIVE_MIND_SENTRY_DSN', 'https://77b711f23c84cbf74366df82090dc389@o4510072519983104.ingest.us.sentry.io/4510072523325440'),
  tracesSampleRateDev: parseFloatWithDefault('HIVE_MIND_SENTRY_TRACES_SAMPLE_RATE_DEV', 1.0),
  tracesSampleRateProd: parseFloatWithDefault('HIVE_MIND_SENTRY_TRACES_SAMPLE_RATE_PROD', 0.1),
  profileSessionSampleRateDev: parseFloatWithDefault('HIVE_MIND_SENTRY_PROFILE_SESSION_SAMPLE_RATE_DEV', 1.0),
  profileSessionSampleRateProd: parseFloatWithDefault('HIVE_MIND_SENTRY_PROFILE_SESSION_SAMPLE_RATE_PROD', 0.1),
};

// Внешние URL
export const externalUrls = {
  githubBase: getenv('HIVE_MIND_GITHUB_BASE_URL', 'https://github.com'),
  bunInstall: getenv('HIVE_MIND_BUN_INSTALL_URL', 'https://bun.sh/'),
};

// Конфигурации моделей AI
// Дефолтные доступные модели в формате Links Notation (только алиасы)
const defaultAvailableModels = `(
  opus
  sonnet
  haiku
)`;

export const modelConfig = {
  availableModels: (() => {
    const envValue = getenv('HIVE_MIND_AVAILABLE_MODELS', defaultAvailableModels);
    // Парсим формат Links Notation
    const parsed = lino.parse(envValue);
    // Если парсинг вернул пустой массив, используем три алиаса по умолчанию
    return parsed.length > 0 ? parsed : ['opus', 'sonnet', 'haiku'];
  })(),
  defaultModel: getenv('HIVE_MIND_DEFAULT_MODEL', 'sonnet'),
  // Разрешить любой ID модели - валидация делегирована реализации инструмента
  restrictModels: getenv('HIVE_MIND_RESTRICT_MODELS', 'false').toLowerCase() === 'true',
};

// Конфигурации версии
export const version = {
  fallback: getenv('HIVE_MIND_VERSION_FALLBACK', '0.14.3'),
  default: getenv('HIVE_MIND_VERSION_DEFAULT', '0.14.3'),
};

// Вспомогательная функция для валидации значений конфигурации
// Проверяет что все численные значения валидны и в допустимых диапазонах
export function validateConfig() {
  // Проверяем что все численные значения валидны
  const numericConfigs = [
    ...Object.values(timeouts),
    ...Object.values(githubLimits),
    ...Object.values(systemLimits),
    ...Object.values(retryLimits).filter(v => typeof v === 'number'),
    ...Object.values(textProcessing),
    display.labelWidth,
    autoContinue.ageThresholdHours,
  ];

  for (const value of numericConfigs) {
    if (isNaN(value) || value < 0) {
      throw new Error(`Invalid numeric configuration value: ${value}`);
    }
  }

  // Проверяем что sample rates находятся между 0 и 1
  const sampleRates = [
    sentry.tracesSampleRateDev,
    sentry.tracesSampleRateProd,
    sentry.profileSessionSampleRateDev,
    sentry.profileSessionSampleRateProd,
  ];

  for (const rate of sampleRates) {
    if (isNaN(rate) || rate < 0 || rate > 1) {
      throw new Error(`Invalid sample rate configuration: ${rate}. Must be between 0 and 1.`);
    }
  }

  // Проверяем что обязательные пути существуют
  if (!filePaths.tempDir) {
    throw new Error('tempDir configuration is required');
  }

  return true;
}

// Экспортируем функцию для получения всех конфигураций как объекта (полезно для отладки)
export function getAllConfigurations() {
  return {
    timeouts,
    autoContinue,
    githubLimits,
    systemLimits,
    retryLimits,
    filePaths,
    textProcessing,
    display,
    sentry,
    externalUrls,
    modelConfig,
    version,
  };
}

// Экспортируем функцию для вывода текущей конфигурации (полезно для отладки)
export function printConfiguration() {
  console.log('Current Configuration:');
  console.log(JSON.stringify(getAllConfigurations(), null, 2));
}