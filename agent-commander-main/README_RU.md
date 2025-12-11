# agent-commander

Библиотека JavaScript для управления агентами, заключёнными в CLI команды, такие как Anthropic Claude Code CLI.

Построенная на успехе [hive-mind](https://github.com/deep-assistant/hive-mind), `agent-commander` предоставляет гибкий интерфейс JavaScript и инструменты CLI для управления процессами агентов с различными уровнями изоляции.

## Функции

- **Поддержка универсального рантайма**: работает с Node.js, Bun и Deno
- **Несколько режимов изоляции**:
  - Без изоляции (прямое выполнение)
  - Сеансы Screen (отдельные сеансы терминала)
  - Контейнеры Docker (полная контейнеризация)
- **Интерфейс CLI и JavaScript**: используйте как библиотеку или инструмент командной строки
- **Корректное завершение**: обработка CTRL+C с надлежащей очисткой
- **Режим сухого запуска**: предварительный просмотр команд перед выполнением
- **Присоединённые/отсоединённые режимы**: следите за выводом в реальном времени или запускайте в фоне

## Установка

### Как глобальный инструмент CLI

```bash
npm install -g agent-commander
```

### Как библиотека

```bash
npm install agent-commander
```

### Для Deno

```javascript
import { agent } from 'https://raw.githubusercontent.com/deep-assistant/agent-commander/main/src/index.mjs';
```

### Для Bun

```bash
bun add agent-commander
```

## Использование CLI

### start-agent

Запустить агента с указанной конфигурацией:

```bash
start-agent --tool claude --working-directory "/tmp/dir" --prompt "Solve the issue"
```

#### Параметры

- `--tool <name>` - инструмент CLI для использования (например, 'claude') [обязательный]
- `--working-directory <path>` - рабочий каталог для агента [обязательный]
- `--prompt <text>` - подсказка для агента
- `--system-prompt <text>` - системная подсказка для агента
- `--isolation <mode>` - режим изоляции: none, screen, docker (по умолчанию: none)
- `--screen-name <name>` - имя сеанса Screen (требуется для изоляции screen)
- `--container-name <name>` - имя контейнера (требуется для изоляции docker)
- `--detached` - запуск в отсоединённом режиме
- `--dry-run` - показать команду без выполнения
- `--help, -h` - показать справку

#### Примеры

**Базовое использование (без изоляции)**
```bash
start-agent --tool claude --working-directory "/tmp/dir" --prompt "Hello"
```

**С изоляцией Screen (отсоединённое)**
```bash
start-agent --tool claude --working-directory "/tmp/dir" \
  --isolation screen --screen-name my-agent --detached
```

**С изоляцией Docker (присоединённое)**
```bash
start-agent --tool claude --working-directory "/tmp/dir" \
  --isolation docker --container-name my-agent
```

**Сухой запуск**
```bash
start-agent --tool claude --working-directory "/tmp/dir" --dry-run
```

### stop-agent

Остановить отсоединённого агента:

```bash
stop-agent --isolation screen --screen-name my-agent
```

#### Параметры

- `--isolation <mode>` - режим изоляции: screen, docker [обязательный]
- `--screen-name <name>` - имя сеанса Screen (требуется для изоляции screen)
- `--container-name <name>` - имя контейнера (требуется для изоляции docker)
- `--dry-run` - показать команду без выполнения
- `--help, -h` - показать справку

#### Примеры

**Остановить сеанс Screen**
```bash
stop-agent --isolation screen --screen-name my-agent
```

**Остановить контейнер Docker**
```bash
stop-agent --isolation docker --container-name my-agent
```

## JavaScript API

### Базовое использование

```javascript
import { agent } from 'agent-commander';

// Создать контроллер агента
const myAgent = agent({
  tool: 'claude',
  workingDirectory: '/tmp/project',
  prompt: 'Analyze this code',
  systemPrompt: 'You are a helpful assistant',
});

// Запустить агента (неблокирующий, возвращается немедленно)
await myAgent.start();

// Выполнить другую работу во время работы агента...

// Остановить агента и собрать вывод
const result = await myAgent.stop();
console.log('Exit code:', result.exitCode);
console.log('Plain output:', result.output.plain);
console.log('Parsed output:', result.output.parsed); // JSON сообщения, если поддерживается
```

### С изоляцией Screen

```javascript
import { agent } from 'agent-commander';

const myAgent = agent({
  tool: 'claude',
  workingDirectory: '/tmp/project',
  prompt: 'Run tests',
  isolation: 'screen',
  screenName: 'my-agent-session',
});

// Запустить в отсоединённом режиме
await myAgent.start({ detached: true });

// Позже остановить агента
const result = await myAgent.stop();
console.log('Exit code:', result.exitCode);
```

### С изоляцией Docker

```javascript
import { agent } from 'agent-commander';

const myAgent = agent({
  tool: 'claude',
  workingDirectory: '/tmp/project',
  prompt: 'Build the project',
  isolation: 'docker',
  containerName: 'my-agent-container',
});

// Запустить присоединённым (потоковый вывод в консоль)
await myAgent.start({ attached: true });

// Остановить контейнер и получить результаты
const result = await myAgent.stop();
console.log('Exit code:', result.exitCode);
```

### Режим сухого запуска

```javascript
const myAgent = agent({
  tool: 'claude',
  workingDirectory: '/tmp/project',
  prompt: 'Test command',
});

// Предварительный просмотр команды без выполнения (печатается в консоль)
await myAgent.start({ dryRun: true });
```

## Справочник API

### `agent(options)`

Создаёт контроллер агента.

**Параметры:**
- `options.tool` (string, обязательный) - инструмент CLI для использования
- `options.workingDirectory` (string, обязательный) - рабочий каталог
- `options.prompt` (string, необязательный) - подсказка для агента
- `options.systemPrompt` (string, необязательный) - системная подсказка
- `options.isolation` (string, необязательный) - 'none', 'screen' или 'docker' (по умолчанию: 'none')
- `options.screenName` (string, необязательный) - имя сеанса Screen (требуется для изоляции screen)
- `options.containerName` (string, необязательный) - имя контейнера (требуется для изоляции docker)

**Возвращает:** объект контроллера агента с методами `start()` и `stop()`

### `controller.start(startOptions)`

Запускает агента (неблокирующий - возвращается немедленно после запуска процесса).

**Параметры:**
- `startOptions.dryRun` (boolean, необязательный) - предварительный просмотр команды без выполнения
- `startOptions.detached` (boolean, необязательный) - запуск в отсоединённом режиме
- `startOptions.attached` (boolean, необязательный) - потоковый вывод (по умолчанию: true)

**Возвращает:** Promise, разрешающееся в `void` (или печатает команду в режиме сухого запуска)

### `controller.stop(stopOptions)`

Останавливает агента и собирает вывод.

Для `isolation: 'none'`: ждёт выхода процесса и собирает весь вывод.
Для `isolation: 'screen'` или `'docker'`: отправляет команду остановки в изолированную среду.

**Параметры:**
- `stopOptions.dryRun` (boolean, необязательный) - предварительный просмотр команды без выполнения

**Возвращает:** Promise, разрешающееся в:
```javascript
{
  exitCode: number,
  output: {
    plain: string,      // Необработанный текстовый вывод (stdout + stderr)
    parsed: Array|null  // JSON-разобранные сообщения (если инструмент это поддерживает, например, Claude)
  }
}
```

## Режимы изоляции

### Нет (по умолчанию)

Прямое выполнение без изоляции. Агент работает как дочерний процесс.

**Вариант использования:** простое, быстрое выполнение с полным доступом к системе

**CTRL+C:** корректно останавливает агента

### Screen

Запускает агента в сеансе GNU Screen.

**Вариант использования:** отсоединённые долгоживущие задачи, которые можно переподключить

**Требования:** должен быть установлен `screen`

**Управление:**
```bash
# Список сеансов
screen -ls

# Переподключиться
screen -r my-agent-session

# Отсоединиться
Ctrl+A, затем D
```

### Docker

Запускает агента в контейнере Docker с подключённым рабочим каталогом.

**Вариант использования:** изолированные, воспроизводимые среды

**Требования:** Docker должен быть установлен и запущен

**Управление:**
```bash
# Список контейнеров
docker ps -a

# Просмотр логов
docker logs my-agent-container

# Остановка
stop-agent --isolation docker --container-name my-agent-container
```

## Разработка

### Запуск тестов

```bash
# Node.js
npm test

# Bun
bun test

# Deno
deno test --allow-read --allow-run --allow-env --allow-net test/**/*.test.mjs
```

### Запуск примеров

```bash
npm run example
```

### Линтинг

```bash
npm run lint
```

## Архитектура

Библиотека построена с использованием паттернов из [hive-mind](https://github.com/deep-assistant/hive-mind) и использует:

- **use-m**: динамическая загрузка модулей из CDN
- **command-stream**: асинхронное выполнение команд с потоковым выводом

### Структура проекта

```
agent-commander/
├── src/
│   ├── index.mjs              # Основной интерфейс библиотеки
│   ├── command-builder.mjs    # Построение строк команд
│   ├── executor.mjs           # Логика выполнения команд
│   ├── cli-parser.mjs         # Разбор аргументов CLI
│   └── utils/
│       └── loader.mjs         # интеграция use-m
├── bin/
│   ├── start-agent.mjs        # CLI: start-agent
│   └── stop-agent.mjs         # CLI: stop-agent
├── test/                      # Файлы тестов
├── examples/                  # Примеры использования
└── .github/workflows/         # Конвейеры CI/CD
```

## Внесение вклада

Вклады приветствуются! Пожалуйста, убедитесь:

1. Все тесты проходят: `npm test`
2. Код линтирован: `npm run lint`
3. Тесты работают на Node.js, Bun и Deno

## Лицензия

Это свободное и ничем не ограниченное программное обеспечение, выпущенное в общественное достояние. Смотрите [LICENSE](LICENSE) для деталей.

## Благодарности

- Вдохновлено [hive-mind](https://github.com/deep-assistant/hive-mind) - платформой распределённой оркестровки AI
- Инфраструктура тестирования основана на [test-anywhere](https://github.com/link-foundation/test-anywhere)

## Связанные проекты

- [hive-mind](https://github.com/deep-assistant/hive-mind) - многоагентный решатель проблем GitHub
- [test-anywhere](https://github.com/link-foundation/test-anywhere) - универсальное тестирование JavaScript
