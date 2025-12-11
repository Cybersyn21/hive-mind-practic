# Примеры использования

Данный документ предоставляет практические примеры использования каждого инструмента с командами `@link-assistant/agent` и `opencode`.

> ⚠️ **Только Bun** - `@link-assistant/agent` требует [Bun](https://bun.sh) и НЕ поддерживает Node.js или Deno.

## Оглавление

- [Базовое использование](#базовое-использование)
- [Операции с файлами](#операции-с-файлами)
- [Инструменты поиска](#инструменты-поиска)
- [Инструменты выполнения](#инструменты-выполнения)
- [Служебные инструменты](#служебные-инструменты)

## Базовое использование

### Самые простые примеры - начните отсюда!

**Простой текст (@link-assistant/agent only, easiest!):**
```bash
echo "hi" | agent
```

**Простое JSON сообщение (оба варианта @link-assistant/agent и opencode):**

@link-assistant/agent:
```bash
echo '{"message":"hi"}' | agent
```

opencode:
```bash
echo '{"message":"hi"}' | opencode run --format json --model opencode/grok-code
```

### Простой текстовый ввод (@link-assistant/agent only)

```bash
# Простое сообщение
echo "hello world" | agent

# Задайте вопрос
echo "what is TypeScript?" | agent

# Запросить веб-поиск
echo "search the web for latest React news" | agent
```

### Примеры ввода JSON

**@link-assistant/agent:**
```bash
echo '{"message":"hello world"}' | agent
```

**opencode:**
```bash
echo '{"message":"hello world"}' | opencode run --format json --model opencode/grok-code
```

## Операции с файлами

### bash инструмент

Выполнить команды оболочки.

**@link-assistant/agent:**
```bash
echo '{"message":"run command","tools":[{"name":"bash","params":{"command":"echo hello world"}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"run command","tools":[{"name":"bash","params":{"command":"echo hello world"}}]}' | opencode run --format json --model opencode/grok-code
```

**Пример с описанием:**
```bash
echo '{"message":"list files","tools":[{"name":"bash","params":{"command":"ls -la","description":"List all files in current directory"}}]}' | agent
```

### read инструмент

Прочитать содержимое файла.

**@link-assistant/agent:**
```bash
echo '{"message":"read file","tools":[{"name":"read","params":{"file_path":"/path/to/file.txt"}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"read file","tools":[{"name":"read","params":{"file_path":"/path/to/file.txt"}}]}' | opencode run --format json --model opencode/grok-code
```

### write инструмент

Записать содержимое в файл.

**@link-assistant/agent:**
```bash
echo '{"message":"write file","tools":[{"name":"write","params":{"file_path":"/tmp/test.txt","content":"Hello World"}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"write file","tools":[{"name":"write","params":{"file_path":"/tmp/test.txt","content":"Hello World"}}]}' | opencode run --format json --model opencode/grok-code
```

### edit инструмент

Редактировать файл с заменой строк.

**@link-assistant/agent:**
```bash
echo '{"message":"edit file","tools":[{"name":"edit","params":{"file_path":"/tmp/test.txt","old_string":"Hello","new_string":"Hi"}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"edit file","tools":[{"name":"edit","params":{"file_path":"/tmp/test.txt","old_string":"Hello","new_string":"Hi"}}]}' | opencode run --format json --model opencode/grok-code
```

### list инструмент

Список содержимого каталога.

**@link-assistant/agent:**
```bash
echo '{"message":"list directory","tools":[{"name":"list","params":{"path":"."}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"list directory","tools":[{"name":"list","params":{"path":"."}}]}' | opencode run --format json --model opencode/grok-code
```

## Инструменты поиска

### glob инструмент

Найти файлы с использованием шаблонов glob.

**@link-assistant/agent:**
```bash
# Найти все файлы JavaScript
echo '{"message":"find js files","tools":[{"name":"glob","params":{"pattern":"**/*.js"}}]}' | agent

# Найти файлы TypeScript в каталоге src
echo '{"message":"find ts files","tools":[{"name":"glob","params":{"pattern":"src/**/*.ts"}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"find js files","tools":[{"name":"glob","params":{"pattern":"**/*.js"}}]}' | opencode run --format json --model opencode/grok-code
```

### grep инструмент

Поиск текста в файлах с использованием регулярных выражений.

**@link-assistant/agent:**
```bash
# Поиск шаблона в файлах
echo '{"message":"search pattern","tools":[{"name":"grep","params":{"pattern":"function","output_mode":"files_with_matches"}}]}' | agent

# Поиск с отображением содержимого
echo '{"message":"search TODO","tools":[{"name":"grep","params":{"pattern":"TODO","output_mode":"content"}}]}' | agent

# Поиск без учета регистра в файлах JavaScript
echo '{"message":"search error","tools":[{"name":"grep","params":{"pattern":"error","-i":true,"type":"js","output_mode":"content"}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"search pattern","tools":[{"name":"grep","params":{"pattern":"TODO","output_mode":"content"}}]}' | opencode run --format json --model opencode/grok-code
```

### websearch инструмент

Поиск в веб с использованием Exa API.

**@link-assistant/agent (переменная окружения не требуется!):**
```bash
echo '{"message":"search web","tools":[{"name":"websearch","params":{"query":"TypeScript latest features"}}]}' | agent

echo '{"message":"search web","tools":[{"name":"websearch","params":{"query":"React hooks best practices"}}]}' | agent
```

**opencode (требуется OPENCODE_EXPERIMENTAL_EXA=true):**
```bash
echo '{"message":"search web","tools":[{"name":"websearch","params":{"query":"TypeScript latest features"}}]}' | OPENCODE_EXPERIMENTAL_EXA=true opencode run --format json --model opencode/grok-code
```

### codesearch инструмент

Поиск в репозиториях кода и документации.

**@link-assistant/agent (переменная окружения не требуется!):**
```bash
echo '{"message":"search code","tools":[{"name":"codesearch","params":{"query":"React hooks implementation"}}]}' | agent

echo '{"message":"search code","tools":[{"name":"codesearch","params":{"query":"async/await patterns"}}]}' | agent
```

**opencode (требуется OPENCODE_EXPERIMENTAL_EXA=true):**
```bash
echo '{"message":"search code","tools":[{"name":"codesearch","params":{"query":"React hooks implementation"}}]}' | OPENCODE_EXPERIMENTAL_EXA=true opencode run --format json --model opencode/grok-code
```

## Инструменты выполнения

### batch инструмент

Объединить несколько вызовов инструментов вместе для оптимальной производительности.

**@link-assistant/agent (конфигурация не требуется!):**
```bash
echo '{"message":"run batch","tools":[{"name":"batch","params":{"tool_calls":[{"tool":"bash","parameters":{"command":"echo hello"}},{"tool":"bash","parameters":{"command":"echo world"}}]}}]}' | agent
```

**opencode (требуется экспериментальная конфигурация):**
```bash
# Сначала создайте файл конфигурации
mkdir -p .opencode
echo '{"experimental":{"batch_tool":true}}' > .opencode/config.json

# Затем запустите
echo '{"message":"run batch","tools":[{"name":"batch","params":{"tool_calls":[{"tool":"bash","parameters":{"command":"echo hello"}},{"tool":"bash","parameters":{"command":"echo world"}}]}}]}' | opencode run --format json --model opencode/grok-code
```

### task инструмент

Запустить специализированные агенты для сложных задач.

**@link-assistant/agent:**
```bash
echo '{"message":"launch task","tools":[{"name":"task","params":{"description":"Analyze codebase","prompt":"Find all TODO comments in JavaScript files","subagent_type":"general-purpose"}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"launch task","tools":[{"name":"task","params":{"description":"Analyze codebase","prompt":"Find all TODO comments in JavaScript files","subagent_type":"general-purpose"}}]}' | opencode run --format json --model opencode/grok-code
```

## Служебные инструменты

### todo инструмент

Чтение и запись элементов TODO для отслеживания задач.

**@link-assistant/agent:**
```bash
# Записать todos
echo '{"message":"add todos","tools":[{"name":"todowrite","params":{"todos":[{"content":"Implement feature X","status":"pending","activeForm":"Implementing feature X"},{"content":"Write tests","status":"pending","activeForm":"Writing tests"}]}}]}' | agent

# Прочитать todos
echo '{"message":"read todos","tools":[{"name":"todoread","params":{}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"add todos","tools":[{"name":"todowrite","params":{"todos":[{"content":"Implement feature X","status":"pending","activeForm":"Implementing feature X"}]}}]}' | opencode run --format json --model opencode/grok-code
```

### webfetch инструмент

Получить и обработать веб-содержимое.

**@link-assistant/agent:**
```bash
echo '{"message":"fetch url","tools":[{"name":"webfetch","params":{"url":"https://example.com","prompt":"Summarize the content"}}]}' | agent
```

**opencode:**
```bash
echo '{"message":"fetch url","tools":[{"name":"webfetch","params":{"url":"https://example.com","prompt":"Summarize the content"}}]}' | opencode run --format json --model opencode/grok-code
```

## Формат вывода

### JSON стандарты

@link-assistant/agent поддерживает два стандарта формата вывода JSON через опцию `--json-standard`:

#### Стандарт OpenCode (по умолчанию)

```bash
# По умолчанию - то же самое, что --json-standard opencode
echo "hi" | agent

# Явный стандарт opencode
echo "hi" | agent --json-standard opencode
```

#### Стандарт Claude (экспериментальный)

```bash
# Формат, совместимый с Claude CLI (NDJSON)
echo "hi" | agent --json-standard claude
```

### JSON потоковый вывод событий (красиво отформатированный) - Стандарт OpenCode

@link-assistant/agent выводит события JSON в красиво отформатированном потоковом формате для удобства чтения, 100% совместимо со структурой событий OpenCode:

```bash
echo "hi" | agent
```

Вывод (красиво отформатированные события JSON):
```json
{
  "type": "step_start",
  "timestamp": 1763618628840,
  "sessionID": "ses_560236487ffe3ROK1ThWvPwTEF",
  "part": {
    "id": "prt_a9fdca4e8001APEs6AriJx67me",
    "type": "step-start",
    ...
  }
}
{
  "type": "text",
  "timestamp": 1763618629886,
  "sessionID": "ses_560236487ffe3ROK1ThWvPwTEF",
  "part": {
    "type": "text",
    "text": "Hi! How can I help with your coding tasks today?",
    ...
  }
}
{
  "type": "step_finish",
  "timestamp": 1763618629916,
  "sessionID": "ses_560236487ffe3ROK1ThWvPwTEF",
  "part": {
    "type": "step-finish",
    "reason": "stop",
    ...
  }
}
```

Этот формат предназначен для:
- **Читаемость**: Красиво отформатированный JSON легко читать и отлаживать
- **Потоковая передача**: События выводятся в реальном времени по мере их возникновения
- **Совместимость**: 100% совместимо со структурой событий OpenCode
- **Автоматизация**: Может быть проанализировано с использованием стандартных инструментов JSON (см. примеры фильтрации ниже)

### Вывод Claude Stream-JSON (NDJSON)

При использовании `--json-standard claude` вывод находится в формате NDJSON (Newline-Delimited JSON), совместимом с Claude CLI:

```bash
echo "hi" | agent --json-standard claude
```

Вывод (компактный NDJSON):
```json
{"type":"init","timestamp":"2025-01-01T00:00:00.000Z","session_id":"ses_560236487ffe3ROK1ThWvPwTEF"}
{"type":"message","timestamp":"2025-01-01T00:00:01.000Z","session_id":"ses_560236487ffe3ROK1ThWvPwTEF","role":"assistant","content":[{"type":"text","text":"Hi! How can I help with your coding tasks today?"}]}
{"type":"result","timestamp":"2025-01-01T00:00:01.100Z","session_id":"ses_560236487ffe3ROK1ThWvPwTEF","status":"success","duration_ms":1100}
```

Ключевые различия от формата OpenCode:
- **Компактность**: Один JSON на строку (без красивого форматирования)
- **Типы событий**: `init`, `message`, `tool_use`, `tool_result`, `result`
- **Временные метки**: Строки ISO 8601 вместо миллисекунд Unix
- **ID сеанса**: `session_id` (snake_case) вместо `sessionID` (camelCase)
- **Содержимое**: Содержимое сообщения в формате массива с объектами `{type, text}`

### Фильтрация вывода

Извлечение определенных типов событий с использованием `jq`:

```bash
# Получить только текстовые ответы
echo '{"message":"hello"}' | agent | jq -r 'select(.type=="text") | .part.text'

# Получить события использования инструментов
echo '{"message":"run","tools":[{"name":"bash","params":{"command":"ls"}}]}' | agent | jq 'select(.type=="tool_use")'

# Получить вывод инструмента bash
echo '{"message":"run","tools":[{"name":"bash","params":{"command":"echo test"}}]}' | agent | jq -r 'select(.type=="tool_use" and .part.tool=="bash") | .part.state.output'

# Красивый вывод всех событий
echo "hello" | agent | jq
```

## Советы

### Преимущества @link-assistant/agent

1. **Без конфигурации**: Инструменты WebSearch, CodeSearch и Batch работают без какой-либо настройки
2. **Простой текстовый ввод**: Может использоваться простой текст вместо JSON
3. **Всегда включено**: Все инструменты доступны по умолчанию
4. **Только Bun**: Оптимизировано для среды выполнения Bun (без Node.js/Deno)

### Работа с JSON

Используйте одинарные кавычки для внешней команды оболочки и двойные кавычки внутри JSON:

```bash
echo '{"message":"test","tools":[{"name":"bash","params":{"command":"echo hello"}}]}' | agent
```

### Отладка

Добавьте `| jq` для красивого вывода JSON:

```bash
echo "hello" | agent | jq
```

### Объединение команд

Обработка вывода со стандартными инструментами Unix:

```bash
# Подсчет событий
echo "hello" | agent | wc -l

# Фильтрация и форматирование
echo "hello" | agent | jq -r 'select(.type=="text") | .part.text'
```
