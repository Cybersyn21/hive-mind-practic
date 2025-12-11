# Каталог bin/ — CLI команды

## Описание

Каталог `bin/` содержит исполняемые файлы для командной строки, которые устанавливаются глобально при установке пакета.

## Файлы

### start-agent.mjs
**Назначение**: Запуск AI-агента с заданной конфигурацией.

**Использование**:
```bash
start-agent [опции]
```

**Опции**:

| Опция | Описание | Обязательно |
|-------|----------|-------------|
| `--tool <name>` | Инструмент (claude, opencode, codex, agent) | Да |
| `--working-directory <path>` | Рабочая директория | Да |
| `--prompt <text>` | Промпт для агента | Нет |
| `--system-prompt <text>` | Системный промпт | Нет |
| `--isolation <mode>` | Режим: none, screen, docker | Нет (default: none) |
| `--screen-name <name>` | Имя screen сессии | Для screen |
| `--container-name <name>` | Имя docker контейнера | Для docker |
| `--detached` | Запуск в фоне | Нет |
| `--dry-run` | Показать команду без выполнения | Нет |
| `--help, -h` | Показать справку | Нет |

**Примеры**:

```bash
# Простой запуск
start-agent --tool claude --working-directory /tmp/project --prompt "Привет"

# С Screen изоляцией в фоне
start-agent --tool claude --working-directory /tmp/project \
  --isolation screen --screen-name my-agent --detached

# С Docker изоляцией
start-agent --tool claude --working-directory /tmp/project \
  --isolation docker --container-name my-agent

# Предварительный просмотр команды
start-agent --tool claude --working-directory /tmp/project --dry-run
```

### stop-agent.mjs
**Назначение**: Остановка запущенного агента.

**Использование**:
```bash
stop-agent [опции]
```

**Опции**:

| Опция | Описание | Обязательно |
|-------|----------|-------------|
| `--isolation <mode>` | Режим: screen, docker | Да |
| `--screen-name <name>` | Имя screen сессии | Для screen |
| `--container-name <name>` | Имя docker контейнера | Для docker |
| `--dry-run` | Показать команду без выполнения | Нет |
| `--help, -h` | Показать справку | Нет |

**Примеры**:

```bash
# Остановка screen сессии
stop-agent --isolation screen --screen-name my-agent

# Остановка docker контейнера
stop-agent --isolation docker --container-name my-agent

# Предварительный просмотр
stop-agent --isolation screen --screen-name my-agent --dry-run
```

## Как это работает

### start-agent

1. Парсит аргументы командной строки
2. Валидирует обязательные опции
3. Строит команду запуска агента
4. Применяет обёртку изоляции (если указана)
5. Выполняет команду

### stop-agent

1. Парсит аргументы
2. Определяет тип изоляции
3. Формирует команду остановки:
   - Для screen: `screen -S <name> -X quit`
   - Для docker: `docker stop <name>`
4. Выполняет команду

## Поддерживаемые инструменты

| Инструмент | Команда | Описание |
|------------|---------|----------|
| claude | `claude` | Anthropic Claude Code CLI |
| opencode | `opencode` | OpenCode AI CLI |
| codex | `codex` | OpenAI Codex CLI |
| agent | `agent` | @link-assistant/agent |

## Коды выхода

| Код | Описание |
|-----|----------|
| 0 | Успешное завершение |
| 1 | Ошибка валидации аргументов |
| 2 | Ошибка выполнения команды |
| 130 | Прервано пользователем (CTRL+C) |
