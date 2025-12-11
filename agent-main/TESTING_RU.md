# Руководство по тестированию

## Запуск тестов вручную

Все тесты можно запустить вручную, используя встроенный test runner Bun.

### Предварительные требования

Убедитесь, что зависимости установлены:
```bash
bun install
```

### Запуск всех тестов

Для запуска полного набора тестов:
```bash
bun test
```

### Запуск отдельных файлов тестов

Вы можете запустить отдельные файлы тестов:

```bash
# Запуск MCP тестов
bun test tests/mcp.test.js

# Запуск базовых тестов
bun test tests/basic.test.js

# Запуск тестов инструментов
bun test tests/bash.tools.test.js
bun test tests/read.tools.test.js
bun test tests/write.tools.test.js
bun test tests/edit.tools.test.js
bun test tests/glob.tools.test.js
bun test tests/grep.tools.test.js
bun test tests/list.tools.test.js
bun test tests/todo.tools.test.js
bun test tests/task.tools.test.js
bun test tests/batch.tools.test.js
bun test tests/websearch.tools.test.js
bun test tests/codesearch.tools.test.js
bun test tests/webfetch.tools.test.js

# Запуск тестов ввода/сообщений
bun test tests/plaintext.input.test.js
bun test tests/system-message.test.js
bun test tests/system-message-file.test.js

# Запуск тестов серверного режима
bun test tests/server-mode.test.js
```

### Запуск тестов с фильтрацией по шаблону

Bun позволяет фильтровать тесты по шаблону:

```bash
# Запуск всех тестов инструментов
bun test tests/*.tools.test.js

# Запуск всех тестов ввода
bun test tests/*.input.test.js
```

## Непрерывная интеграция

Тесты настроены на запуск вручную через GitHub Actions workflow dispatch.

### Запуск CI тестов вручную

1. Перейдите на [вкладку Actions](https://github.com/link-assistant/agent/actions)
2. Выберите workflow "Tests"
3. Нажмите кнопку "Run workflow"
4. Выберите ветку, которую хотите протестировать
5. Нажмите "Run workflow" для запуска тестирования

CI workflow будет:
1. Установить зависимости
2. Запустить полный набор тестов с помощью `bun test`
3. Выполнить тесты MCP CLI команд

## Структура тестов

### MCP тесты (`tests/mcp.test.js`)

Набор тестов MCP проверяет:
- Вывод справки CLI команд
- Генерация файла конфигурации
- Поддержка Playwright MCP
- Обработка многоаргументных команд
- Конфигурация удаленного сервера
- Сохранение конфигурации

**Всего 11 тестов**, охватывающих всю функциональность MCP.

### Тесты инструментов

Каждый инструмент имеет выделенный файл тестов, проверяющий:
- Выполнение инструмента
- Совместимость формата вывода с OpenCode
- Валидацию JSON структуры
- Обработку ошибок

### Интеграционные тесты

- `tests/basic.test.js` - Базовая функциональность агента
- `tests/server-mode.test.js` - HTTP серверный режим
- `tests/plaintext.input.test.js` - Обработка простого текстового ввода
- `tests/system-message*.test.js` - Конфигурация системных сообщений

## Решение проблем

### Отсутствующие зависимости

Если вы видите ошибки о недостающих модулях:
```bash
bun install
```

### Ошибки тестов

1. Проверьте, что вы используете Bun >= 1.0.0:
   ```bash
   bun --version
   ```

2. Убедитесь, что все зависимости установлены:
   ```bash
   rm -rf node_modules
   bun install
   ```

3. Запустите тесты в режиме verbose для подробного вывода:
   ```bash
   bun test --verbose
   ```
