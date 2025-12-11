# Каталог tests/ — Тесты

## Описание

Каталог `tests/` содержит комплексный набор тестов для проверки функциональности агента. Тесты написаны для Bun test runner.

## Запуск тестов

```bash
# Все тесты
bun test

# Конкретный файл
bun test tests/bash.tools.test.js
bun test tests/websearch.tools.test.js
```

## Файлы тестов

### Тесты инструментов

| Файл | Тестируемый инструмент |
|------|------------------------|
| `bash.tools.test.js` | bash — выполнение shell-команд |
| `batch.tools.test.js` | batch — пакетное выполнение |
| `codesearch.tools.test.js` | codesearch — поиск кода |
| `edit.tools.test.js` | edit — редактирование файлов |
| `glob.tools.test.js` | glob — поиск файлов по шаблону |
| `grep.tools.test.js` | grep — поиск текста |
| `list.tools.test.js` | list — просмотр директорий |
| `read.tools.test.js` | read — чтение файлов |
| `task.tools.test.js` | task — подзадачи |
| `todo.tools.test.js` | todo — управление задачами |
| `webfetch.tools.test.js` | webfetch — загрузка URL |
| `websearch.tools.test.js` | websearch — веб-поиск |
| `write.tools.test.js` | write — запись файлов |

### Тесты ядра

| Файл | Описание |
|------|----------|
| `basic.test.js` | Базовая функциональность агента |
| `mcp.test.js` | Model Context Protocol |
| `server-mode.test.js` | Режим HTTP сервера |
| `plaintext.input.test.js` | Ввод простого текста |

### Тесты системных сообщений

| Файл | Описание |
|------|----------|
| `system-message.test.js` | Системные промпты |
| `system-message-file.test.js` | Загрузка промптов из файлов |

### Тесты JSON стандартов

| Файл | Описание |
|------|----------|
| `json-standard-unit.test.js` | Юнит-тесты форматов |
| `json-standard-opencode.test.js` | Формат OpenCode |
| `json-standard-claude.test.js` | Формат Claude |

## Структура теста

```javascript
import { test, expect, describe } from 'bun:test';

describe('Инструмент bash', () => {
  test('выполняет простую команду', async () => {
    const result = await bash({ command: 'echo "test"' });
    expect(result.stdout).toBe('test\n');
  });

  test('возвращает код выхода', async () => {
    const result = await bash({ command: 'exit 42' });
    expect(result.exitCode).toBe(42);
  });
});
```

## Покрытие тестами

- ✅ 13 инструментов полностью покрыты
- ✅ Поддержка текстового ввода
- ✅ Совместимость с OpenCode
- ✅ Совместимость с форматом Claude
- ✅ Юнит-тесты JSON стандартов
- ✅ 100% совместимость с JSON форматом OpenCode

## Создание нового теста

1. Создайте файл `new-feature.test.js` в каталоге `tests/`
2. Импортируйте необходимые модули
3. Используйте `describe` для группировки
4. Используйте `test` для отдельных тестов
5. Запустите `bun test tests/new-feature.test.js`

## Пример комплексного теста

```javascript
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { agent } from '../src/agent/agent';
import * as fs from 'fs';

describe('Агент: работа с файлами', () => {
  const testDir = '/tmp/agent-test';

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('создаёт файл через write', async () => {
    const result = await agent({
      message: 'Создай файл test.txt с текстом "hello"',
      workingDir: testDir
    });

    expect(fs.existsSync(`${testDir}/test.txt`)).toBe(true);
    expect(fs.readFileSync(`${testDir}/test.txt`, 'utf8')).toBe('hello');
  });

  test('читает файл через read', async () => {
    fs.writeFileSync(`${testDir}/input.txt`, 'данные');

    const result = await agent({
      message: 'Прочитай файл input.txt',
      workingDir: testDir
    });

    expect(result.output).toContain('данные');
  });
});
```

## CI/CD

Тесты автоматически запускаются в GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
```
