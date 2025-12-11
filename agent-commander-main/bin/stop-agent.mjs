#!/usr/bin/env node

/**
 * stop-agent CLI command
 * Stop a detached agent
 */

// CLI команда для остановки отсоединённого агента.
// Используется для завершения работы агентов, запущенных в detached режиме
// с изоляцией screen или docker. Отправляет команду остановки соответствующей
// screen сессии или docker контейнеру.
import { agent } from '../src/index.mjs';
import {
  parseStopAgentArgs,
  showStopAgentHelp,
  validateStopAgentOptions,
} from '../src/cli-parser.mjs';

// Основная функция CLI приложения
async function main() {
  // Получаем и парсим аргументы командной строки
  const args = process.argv.slice(2);
  const options = parseStopAgentArgs(args);

  // Показываем справку, если запрошена
  if (options.help) {
    showStopAgentHelp();
    process.exit(0);
  }

  // Валидируем опции (должен быть указан режим изоляции и соответствующее имя)
  const validation = validateStopAgentOptions(options);
  if (!validation.valid) {
    console.error('Error: Invalid options\n');
    validation.errors.forEach((error) => console.error(`  - ${error}`));
    console.error('\nRun "stop-agent --help" for usage information.');
    process.exit(1);
  }

  try {
    // Создаём контроллер агента (минимальная конфигурация, нужна только для остановки)
    // tool и workingDirectory не используются при остановке, но требуются API
    const agentController = agent({
      tool: 'dummy',              // Не используется для остановки
      workingDirectory: '/tmp',   // Не используется для остановки
      isolation: options.isolation,        // Режим изоляции (screen/docker)
      screenName: options.screenName,      // Имя screen сессии для остановки
      containerName: options.containerName, // Имя docker контейнера для остановки
    });

    // Останавливаем агента, отправляя команду quit для screen или stop для docker
    const result = await agentController.stop({
      dryRun: options.dryRun,  // Режим пробного запуска (показать команду без выполнения)
    });

    console.log('Agent stopped successfully');
    process.exit(result.exitCode);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Запускаем главную функцию
main();
