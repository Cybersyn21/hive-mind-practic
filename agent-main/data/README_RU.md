# Каталог data/ — Данные

## Описание

Каталог `data/` содержит данные, используемые для тестирования и разработки агента.

## Структура

```
data/
└── tests/                    # Тестовые данные
    └── prompts/             # Тестовые промпты
        ├── append-message.txt    # Пример добавляемого сообщения
        └── system-override.txt   # Пример переопределения системного промпта
```

## Тестовые промпты

### append-message.txt
**Назначение**: Пример текста для добавления к системному промпту.

Используется в тестах опции `--append-system-message-file`:
```bash
echo "вопрос" | agent --append-system-message-file data/tests/prompts/append-message.txt
```

### system-override.txt
**Назначение**: Пример полной замены системного промпта.

Используется в тестах опции `--system-message-file`:
```bash
echo "вопрос" | agent --system-message-file data/tests/prompts/system-override.txt
```

## Использование в тестах

```javascript
import { test, expect } from 'bun:test';
import * as fs from 'fs';

test('загружает системный промпт из файла', async () => {
  const prompt = fs.readFileSync('data/tests/prompts/system-override.txt', 'utf8');
  // ... тест
});
```

## Добавление тестовых данных

1. Создайте файл в соответствующей поддиректории
2. Используйте понятное имя файла
3. Документируйте назначение файла
4. Обновите этот README
