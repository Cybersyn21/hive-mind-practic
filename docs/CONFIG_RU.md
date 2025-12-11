# Руководство по конфигурации

Приложение Hive Mind теперь поддерживает расширенную конфигурацию через переменные окружения, используя пакет `getenv`. Это позволяет вам настраивать различные аспекты приложения без изменения исходного кода.

## Обзор конфигурации

Вся конфигурация управляется модулем `src/config.lib.mjs`, который использует `getenv` из use-m для обработки переменных окружения. Конфигурация использует имена свойств в camelCase для соответствия стилю JavaScript.

## Категории конфигурации

### 1. Конфигурация тайм-аутов (timeouts)

- `HIVE_MIND_CLAUDE_TIMEOUT_SECONDS`: Тайм-аут Claude CLI в секундах (по умолчанию: 60)
- `HIVE_MIND_GITHUB_API_DELAY_MS`: Задержка между вызовами GitHub API (по умолчанию: 5000)
- `HIVE_MIND_GITHUB_REPO_DELAY_MS`: Задержка между операциями репозитория (по умолчанию: 2000)
- `HIVE_MIND_RETRY_BASE_DELAY_MS`: Базовая задержка для операций повтора (по умолчанию: 5000)
- `HIVE_MIND_RETRY_BACKOFF_DELAY_MS`: Задержка отката для повторов (по умолчанию: 1000)

Доступно как: `timeouts.claudeCli`, `timeouts.githubApiDelay`, и т.д.

### 2. Параметры автоматического продолжения (autoContinue)

- `HIVE_MIND_AUTO_CONTINUE_AGE_HOURS`: Минимальный возраст PR перед автоматическим продолжением (по умолчанию: 24)

Доступно как: `autoContinue.ageThresholdHours`

### 3. Лимиты GitHub API (githubLimits)

- `HIVE_MIND_GITHUB_COMMENT_MAX_SIZE`: Максимальный размер комментариев GitHub (по умолчанию: 65536)
- `HIVE_MIND_GITHUB_FILE_MAX_SIZE`: Максимальный размер файла для операций GitHub (по умолчанию: 26214400 / 25MB)
- `HIVE_MIND_GITHUB_ISSUE_BODY_MAX_SIZE`: Максимальный размер тела проблемы (по умолчанию: 60000)
- `HIVE_MIND_GITHUB_ATTACHMENT_MAX_SIZE`: Максимальный размер вложения (по умолчанию: 10485760 / 10MB)
- `HIVE_MIND_GITHUB_BUFFER_MAX_SIZE`: Максимальный размер буфера для операций GitHub (по умолчанию: 10485760 / 10MB)

Доступно как: `githubLimits.commentMaxSize`, `githubLimits.fileMaxSize`, и т.д.

### 4. Лимиты системных ресурсов (systemLimits)

- `HIVE_MIND_MIN_DISK_SPACE_MB`: Минимальное требуемое дисковое пространство в МБ (по умолчанию: 500)
- `HIVE_MIND_DEFAULT_PAGE_SIZE_KB`: Размер страницы памяти по умолчанию в КБ (по умолчанию: 16)

Доступно как: `systemLimits.minDiskSpaceMb`, `systemLimits.defaultPageSizeKb`

### 5. Конфигурация повторных попыток (retryLimits)

- `HIVE_MIND_MAX_FORK_RETRIES`: Максимальное количество повторов создания форка (по умолчанию: 5)
- `HIVE_MIND_MAX_VERIFY_RETRIES`: Максимальное количество повторов проверки (по умолчанию: 5)
- `HIVE_MIND_MAX_API_RETRIES`: Максимальное количество повторов вызовов API (по умолчанию: 3)
- `HIVE_MIND_RETRY_BACKOFF_MULTIPLIER`: Множитель отката повтора (по умолчанию: 2)

Доступно как: `retryLimits.maxForkRetries`, `retryLimits.maxVerifyRetries`, и т.д.

### 6. Параметры файлов и путей (filePaths)

- `HIVE_MIND_TEMP_DIR`: Путь временного каталога (по умолчанию: /tmp)
- `HIVE_MIND_TASK_INFO_FILENAME`: Имя файла информации о задаче (по умолчанию: CLAUDE.md)
- `HIVE_MIND_PROC_MEMINFO`: Путь к файлу информации о памяти (по умолчанию: /proc/meminfo)

Доступно как: `filePaths.tempDir`, `filePaths.taskInfoFilename`, и т.д.

### 7. Обработка текста (textProcessing)

- `HIVE_MIND_TOKEN_MASK_MIN_LENGTH`: Минимальная длина для маскирования токена (по умолчанию: 12)
- `HIVE_MIND_TOKEN_MASK_START_CHARS`: Символы для отображения в начале при маскировании (по умолчанию: 5)
- `HIVE_MIND_TOKEN_MASK_END_CHARS`: Символы для отображения в конце при маскировании (по умолчанию: 5)
- `HIVE_MIND_TEXT_PREVIEW_LENGTH`: Длина предварительного просмотра текста (по умолчанию: 100)
- `HIVE_MIND_LOG_TRUNCATION_LENGTH`: Длина усечения журнала (по умолчанию: 5000)

Доступно как: `textProcessing.tokenMaskMinLength`, `textProcessing.textPreviewLength`, и т.д.

### 8. Параметры отображения (display)

- `HIVE_MIND_LABEL_WIDTH`: Ширина метки в отформатированном выводе (по умолчанию: 25)

Доступно как: `display.labelWidth`

### 9. Отслеживание ошибок Sentry (sentry)

- `HIVE_MIND_SENTRY_DSN`: Sentry DSN для отслеживания ошибок (по умолчанию: предоставлено)
- `HIVE_MIND_SENTRY_TRACES_SAMPLE_RATE_DEV`: Частота выборки трассировок в разработке (по умолчанию: 1.0)
- `HIVE_MIND_SENTRY_TRACES_SAMPLE_RATE_PROD`: Частота выборки трассировок в рабочей среде (по умолчанию: 0.1)
- `HIVE_MIND_SENTRY_PROFILE_SESSION_SAMPLE_RATE_DEV`: Частота выборки профилей в разработке (по умолчанию: 1.0)
- `HIVE_MIND_SENTRY_PROFILE_SESSION_SAMPLE_RATE_PROD`: Частота выборки профилей в рабочей среде (по умолчанию: 0.1)

Доступно как: `sentry.dsn`, `sentry.tracesSampleRateDev`, и т.д.

### 10. Внешние URL (externalUrls)

- `HIVE_MIND_GITHUB_BASE_URL`: Базовый URL GitHub (по умолчанию: https://github.com)
  - Полезно для экземпляров GitHub Enterprise
- `HIVE_MIND_BUN_INSTALL_URL`: URL установки Bun (по умолчанию: https://bun.sh/)

Доступно как: `externalUrls.githubBase`, `externalUrls.bunInstall`

### 11. Конфигурация модели (modelConfig)

- `HIVE_MIND_AVAILABLE_MODELS`: Список доступных моделей, разделенный запятыми (по умолчанию: opus,sonnet,claude-sonnet-4-5-20250929,claude-opus-4-5-20251101)
- `HIVE_MIND_DEFAULT_MODEL`: Модель по умолчанию для использования (по умолчанию: sonnet)

Доступно как: `modelConfig.availableModels`, `modelConfig.defaultModel`

### 12. Параметры версии (version)

- `HIVE_MIND_VERSION_FALLBACK`: Резервный номер версии (по умолчанию: 0.14.3)
- `HIVE_MIND_VERSION_DEFAULT`: Номер версии по умолчанию (по умолчанию: 0.14.3)

Доступно как: `version.fallback`, `version.default`

## Примеры использования

### Установка переменных окружения

```bash
# Увеличить тайм-аут Claude до 2 минут
export HIVE_MIND_CLAUDE_TIMEOUT_SECONDS=120

# Сократить задержку GitHub API для более быстрых операций
export HIVE_MIND_GITHUB_API_DELAY_MS=2000

# Увеличить порог автоматического продолжения до 48 часов
export HIVE_MIND_AUTO_CONTINUE_AGE_HOURS=48

# Использовать пользовательский временный каталог
export HIVE_MIND_TEMP_DIR=/var/tmp/hive-mind

# Отключить Sentry в рабочей среде
export HIVE_MIND_SENTRY_DSN=""

# Настроить для GitHub Enterprise
export GITHUB_BASE_URL=https://github.enterprise.com
```

### Запуск с пользовательской конфигурацией

```bash
# Запуск с пользовательскими тайм-аутами
HIVE_MIND_CLAUDE_TIMEOUT_SECONDS=120 HIVE_MIND_RETRY_BASE_DELAY_MS=10000 hive monitor

# Запуск с повышенными лимитами
HIVE_MIND_GITHUB_FILE_MAX_SIZE=52428800 HIVE_MIND_MIN_DISK_SPACE_MB=1000 solve https://github.com/owner/repo/issues/123

# Запуск с пользовательскими параметрами автоматического продолжения
HIVE_MIND_AUTO_CONTINUE_AGE_HOURS=12 solve --auto-continue https://github.com/owner/repo/issues/456
```

### Файл конфигурации (необязательно)

Вы также можете создать файл `.env` в корне вашего проекта:

```bash
# .env файл
HIVE_MIND_CLAUDE_TIMEOUT_SECONDS=90
HIVE_MIND_GITHUB_API_DELAY_MS=3000
HIVE_MIND_AUTO_CONTINUE_AGE_HOURS=36
HIVE_MIND_TEMP_DIR=/opt/hive-mind/tmp
HIVE_MIND_SENTRY_DSN=your-custom-sentry-dsn
```

Затем загрузите его перед запуском:

```bash
source .env
hive monitor
```

## Использование разработчиком

### Импорт конфигурации

```javascript
import { timeouts, githubLimits, sentry } from './config.lib.mjs';

// Использование значений конфигурации
const timeout = timeouts.claudeCli;
const maxSize = githubLimits.fileMaxSize;
const dsn = sentry.dsn;
```

### Получение всей конфигурации

```javascript
import { getAllConfigurations, printConfiguration } from './config.lib.mjs';

// Получить всю конфигурацию как объект
const config = getAllConfigurations();

// Вывести текущую конфигурацию (полезно для отладки)
printConfiguration();
```

### Валидация конфигурации

```javascript
import { validateConfig } from './config.lib.mjs';

try {
  validateConfig();
  console.log('Configuration is valid');
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

## Примечания

- Конфигурация использует `getenv` из use-m для надежной обработки переменных окружения
- Все имена свойств используют camelCase для соответствия стилю JavaScript
- Все значения тайм-аута указаны в миллисекундах, если не указано иное
- Все лимиты размера указаны в байтах, если не указано иное
- Частоты выборки должны быть между 0.0 и 1.0
- Приложение проверяет все значения конфигурации при запуске
- Недействительные значения вызовут ошибку приложения при запуске
- Вы можете просмотреть текущую конфигурацию, проверив логи приложения в режиме многословности

## Устранение неполадок

Если вы столкнулись с проблемами конфигурации:

1. Проверьте, что числовые значения являются положительными целыми числами
2. Убедитесь, что частоты выборки находятся между 0 и 1
3. Проверьте, что пути существуют и доступны
4. Запустите с флагом `--verbose` для просмотра используемых значений конфигурации
5. Проверьте логи приложения на предмет ошибок валидации конфигурации
6. Используйте `printConfiguration()` для отладки текущих параметров
