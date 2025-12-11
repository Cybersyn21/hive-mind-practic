# Каталог test/ — Тесты

## Описание

Каталог `test/` содержит набор тестов для проверки функциональности библиотеки agent-commander. Тесты совместимы с Node.js, Bun и Deno.

## Файлы

### cli-parser.test.mjs
**Тестирует**: Модуль `src/cli-parser.mjs`

**Покрытие**:
- Парсинг обязательных опций
- Парсинг опциональных опций
- Обработка некорректных значений
- Справка и версия
- Комбинации опций

**Примеры тестов**:
```javascript
test('парсит --tool и --working-directory', () => {
  const args = ['--tool', 'claude', '--working-directory', '/tmp'];
  const result = parseArgs(args);
  expect(result.tool).toBe('claude');
  expect(result.workingDirectory).toBe('/tmp');
});

test('выбрасывает ошибку без обязательных опций', () => {
  expect(() => parseArgs([])).toThrow();
});
```

### command-builder.test.mjs
**Тестирует**: Модуль `src/command-builder.mjs`

**Покрытие**:
- Построение базовых команд
- Добавление промпта и системного промпта
- Экранирование специальных символов
- Обёртки для screen
- Обёртки для docker

**Примеры тестов**:
```javascript
test('строит команду для claude', () => {
  const cmd = buildCommand({
    tool: 'claude',
    workingDirectory: '/tmp/project'
  });
  expect(cmd).toContain('claude');
  expect(cmd).toContain('/tmp/project');
});

test('добавляет screen обёртку', () => {
  const cmd = buildCommand({
    tool: 'claude',
    workingDirectory: '/tmp',
    isolation: 'screen',
    screenName: 'test-session'
  });
  expect(cmd).toContain('screen -S test-session');
});
```

### index.test.mjs
**Тестирует**: Модуль `src/index.mjs` (главный интерфейс)

**Покрытие**:
- Создание контроллера агента
- Методы start() и stop()
- Dry run режим
- Обработка ошибок
- Интеграционные сценарии

**Примеры тестов**:
```javascript
test('создаёт контроллер агента', () => {
  const myAgent = agent({
    tool: 'claude',
    workingDirectory: '/tmp'
  });
  expect(myAgent).toHaveProperty('start');
  expect(myAgent).toHaveProperty('stop');
});

test('dry run показывает команду', async () => {
  const myAgent = agent({
    tool: 'claude',
    workingDirectory: '/tmp'
  });
  const output = await myAgent.start({ dryRun: true });
  expect(output).toContain('claude');
});
```

## Запуск тестов

### Node.js
```bash
npm test
# или
node --test test/*.test.mjs
```

### Bun
```bash
bun test
```

### Deno
```bash
deno test --allow-read --allow-run --allow-env --allow-net test/*.test.mjs
```

## Структура теста

```javascript
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('Название группы', () => {
  beforeEach(() => {
    // Подготовка
  });

  afterEach(() => {
    // Очистка
  });

  test('описание теста', () => {
    // Тест
    assert.strictEqual(actual, expected);
  });
});
```

## CI/CD

Тесты автоматически запускаются в GitHub Actions при push и pull request:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    strategy:
      matrix:
        runtime: [node, bun, deno]
    steps:
      - run: npm test  # или bun test / deno test
```

## Добавление тестов

1. Создайте файл `new-feature.test.mjs`
2. Импортируйте тестируемый модуль
3. Используйте `describe` для группировки
4. Используйте `test` для отдельных тестов
5. Убедитесь, что тесты проходят во всех рантаймах
