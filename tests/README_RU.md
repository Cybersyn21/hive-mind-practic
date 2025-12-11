# Каталог tests/ — Тесты

## Описание

Каталог `tests/` содержит тесты для проверки функциональности Hive Mind.

## Текущий статус

На данный момент тестовая инфраструктура находится в разработке. В `package.json`:

```json
{
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

## Планируемые тесты

### Юнит-тесты
- Парсинг аргументов командной строки
- Обработка GitHub API ответов
- Формирование команд для агентов
- Обработка ошибок

### Интеграционные тесты
- Работа с GitHub API (mock)
- Запуск и остановка агентов
- Создание PR
- Обработка комментариев

### E2E тесты
- Полный цикл solve
- Оркестрация hive
- Telegram бот команды

## Запуск тестов

```bash
# Когда тесты будут реализованы
npm test
```

## Рекомендуемая структура

```
tests/
├── unit/                    # Юнит-тесты
│   ├── cli-parser.test.mjs
│   ├── github-api.test.mjs
│   └── command-builder.test.mjs
├── integration/             # Интеграционные тесты
│   ├── solve.test.mjs
│   └── hive.test.mjs
├── e2e/                     # End-to-end тесты
│   └── full-cycle.test.mjs
├── fixtures/                # Тестовые данные
│   ├── issues/
│   └── responses/
└── helpers/                 # Вспомогательные функции
    └── mock-github.mjs
```

## Добавление тестов

1. Создайте файл теста в соответствующей директории
2. Используйте Node.js test runner:
```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Название группы', () => {
  test('описание теста', () => {
    assert.strictEqual(actual, expected);
  });
});
```

3. Обновите script test в `package.json`
4. Запустите и убедитесь, что тесты проходят

## Ручное тестирование

До реализации автотестов используйте ручное тестирование:

```bash
# Тест solve (dry-run)
solve https://github.com/test/repo/issues/1 --dry-run --verbose

# Тест hive (dry-run, once)
hive https://github.com/test/repo --dry-run --once --verbose

# Тест Telegram бота
hive-telegram-bot --configuration "
  TELEGRAM_BOT_TOKEN: 'test'
  TELEGRAM_BOT_VERBOSE: true
" --dry-run
```
