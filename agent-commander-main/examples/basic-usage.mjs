/**
 * Basic usage example for agent-commander
 */

// Базовый пример использования библиотеки agent-commander.
// Демонстрирует различные режимы запуска агентов: с изоляцией и без,
// в detached режиме и в attached режиме, а также dry-run для просмотра команд.
import { agent } from '../src/index.mjs';

// Асинхронная функция для демонстрации базовых примеров использования агентов
async function basicExample() {
  console.log('=== Basic Agent Usage Example ===\n');

  // Пример 1: Пробный запуск (dry run) без изоляции
  // Показывает команду, которая была бы выполнена, не выполняя её
  console.log('1. Dry run with no isolation:');
  const agent1 = agent({
    tool: 'echo',                // CLI инструмент для выполнения
    workingDirectory: '/tmp',    // Рабочая директория
    prompt: 'Hello, World!',     // Промпт для агента
  });

  await agent1.start({ dryRun: true });
  console.log('(Command printed above)\n');

  // Пример 2: Реальное выполнение без изоляции
  // Запускает агента и ждёт его завершения для получения результата
  console.log('2. Actual execution with no isolation:');
  const agent2 = agent({
    tool: 'echo',
    workingDirectory: '/tmp',
    prompt: 'Hello from agent!',
  });

  // Запускаем агента в attached режиме
  await agent2.start();
  // Останавливаем агента и получаем результат выполнения
  const result2 = await agent2.stop();
  console.log('Exit code:', result2.exitCode);
  console.log('Output (plain):', result2.output.plain.trim());
  console.log('Output (parsed):', result2.output.parsed);
  console.log();

  // Пример 3: Пробный запуск с изоляцией screen в detached режиме
  // Screen позволяет запускать процессы в отдельных терминальных сессиях
  console.log('3. Dry run with screen isolation (detached):');
  const agent3 = agent({
    tool: 'echo',
    workingDirectory: '/tmp',
    prompt: 'Running in screen',
    isolation: 'screen',              // Режим изоляции через screen
    screenName: 'my-agent-session',   // Имя screen сессии
  });

  await agent3.start({ dryRun: true, detached: true });
  console.log('(Command printed above)\n');

  // Пример 4: Пробный запуск с изоляцией docker
  // Docker изоляция запускает агента внутри контейнера
  console.log('4. Dry run with docker isolation:');
  const agent4 = agent({
    tool: 'echo',
    workingDirectory: '/tmp',
    prompt: 'Running in docker',
    isolation: 'docker',                  // Режим изоляции через docker
    containerName: 'my-agent-container',  // Имя docker контейнера
  });

  await agent4.start({ dryRun: true, detached: true });
  console.log('(Command printed above)\n');

  // Пример 5: Команды остановки (пробный режим)
  // Показывает команды для остановки screen сессий и docker контейнеров
  console.log('5. Stop command for screen (dry run):');
  const result5 = await agent3.stop({ dryRun: true });
  console.log('Exit code:', result5.exitCode);
  console.log();

  console.log('6. Stop command for docker (dry run):');
  const result6 = await agent4.stop({ dryRun: true });
  console.log('Exit code:', result6.exitCode);
  console.log();

  console.log('=== Examples completed ===');
}

// Запускаем примеры и обрабатываем ошибки
basicExample().catch(console.error);
