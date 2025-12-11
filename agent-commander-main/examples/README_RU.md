# Каталог examples/ — Примеры использования

## Описание

Каталог `examples/` содержит практические примеры использования библиотеки agent-commander.

## Файлы

### basic-usage.mjs
**Назначение**: Базовый пример использования JavaScript API.

**Содержание**:
```javascript
import { agent } from 'agent-commander';

// Создание контроллера агента
const myAgent = agent({
  tool: 'claude',
  workingDirectory: '/tmp/project',
  prompt: 'Проанализируй этот код',
  systemPrompt: 'Ты полезный ассистент',
});

// Запуск агента (неблокирующий)
await myAgent.start();

// Можно делать другую работу пока агент работает...

// Остановка и получение результата
const result = await myAgent.stop();
console.log('Код выхода:', result.exitCode);
console.log('Вывод:', result.output.plain);
console.log('Разобранный вывод:', result.output.parsed);
```

**Запуск**:
```bash
npm run example
# или
node examples/basic-usage.mjs
```

### cli-examples.sh
**Назначение**: Примеры использования CLI команд.

**Содержание**:
```bash
#!/bin/bash

# Простой запуск без изоляции
start-agent --tool claude --working-directory "/tmp/test" --prompt "Привет"

# Запуск с Screen изоляцией в фоне
start-agent --tool claude --working-directory "/tmp/test" \
  --isolation screen --screen-name my-agent --detached

# Проверка статуса screen сессии
screen -ls

# Остановка screen сессии
stop-agent --isolation screen --screen-name my-agent

# Запуск с Docker изоляцией
start-agent --tool claude --working-directory "/tmp/test" \
  --isolation docker --container-name my-agent

# Проверка статуса docker контейнера
docker ps

# Остановка docker контейнера
stop-agent --isolation docker --container-name my-agent

# Dry run — показать команду без выполнения
start-agent --tool claude --working-directory "/tmp/test" --dry-run
```

**Запуск**:
```bash
chmod +x examples/cli-examples.sh
./examples/cli-examples.sh
```

## Сценарии использования

### 1. Быстрый запуск для простой задачи
```javascript
import { agent } from 'agent-commander';

const quickAgent = agent({
  tool: 'claude',
  workingDirectory: process.cwd(),
  prompt: 'Создай README.md для этого проекта'
});

await quickAgent.start();
const result = await quickAgent.stop();
console.log(result.output.plain);
```

### 2. Фоновая задача с мониторингом
```javascript
import { agent } from 'agent-commander';

const backgroundAgent = agent({
  tool: 'claude',
  workingDirectory: '/tmp/long-task',
  prompt: 'Выполни рефакторинг всего кода',
  isolation: 'screen',
  screenName: 'refactor-task'
});

// Запуск в фоне
await backgroundAgent.start({ detached: true });

console.log('Агент запущен в фоне');
console.log('Для просмотра: screen -r refactor-task');

// Позже — остановка
// const result = await backgroundAgent.stop();
```

### 3. Изолированное выполнение в Docker
```javascript
import { agent } from 'agent-commander';

const isolatedAgent = agent({
  tool: 'claude',
  workingDirectory: '/app/project',
  prompt: 'Собери проект и запусти тесты',
  isolation: 'docker',
  containerName: 'build-agent'
});

await isolatedAgent.start({ attached: true }); // Вывод в консоль
const result = await isolatedAgent.stop();

console.log('Сборка завершена с кодом:', result.exitCode);
```

## Дополнительные ресурсы

- Полная документация: [README.md](../README.md)
- Тесты: [test/](../test/)
- Исходный код: [src/](../src/)
