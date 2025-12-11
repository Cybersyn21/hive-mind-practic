#!/usr/bin/env node

/**
 * start-agent CLI command
 * Start an agent with specified configuration
 */

// CLI команда для запуска агента с заданной конфигурацией.
// Этот исполняемый файл служит точкой входа для команды start-agent,
// которая позволяет запускать агентов с различными параметрами изоляции,
// промптами и рабочими директориями из командной строки.
import { agent } from '../src/index.mjs';
import {
  parseStartAgentArgs,
  showStartAgentHelp,
  validateStartAgentOptions,
} from '../src/cli-parser.mjs';

// Основная функция CLI приложения
async function main() {
  // Получаем аргументы командной строки (начиная с индекса 2, пропуская node и путь к скрипту)
  const args = process.argv.slice(2);
  // Парсим аргументы в структурированный объект опций
  const options = parseStartAgentArgs(args);

  // Показываем справку, если пользователь запросил её
  if (options.help) {
    showStartAgentHelp();
    process.exit(0);
  }

  // Валидируем полученные опции перед выполнением
  const validation = validateStartAgentOptions(options);
  if (!validation.valid) {
    console.error('Error: Invalid options\n');
    validation.errors.forEach((error) => console.error(`  - ${error}`));
    console.error('\nRun "start-agent --help" for usage information.');
    process.exit(1);
  }

  try {
    // Создаём контроллер агента с указанными параметрами
    const agentController = agent({
      tool: options.tool,                      // CLI инструмент (например, 'claude')
      workingDirectory: options.workingDirectory,  // Рабочая директория агента
      prompt: options.prompt,                  // Пользовательский промпт
      systemPrompt: options.systemPrompt,      // Системный промпт
      isolation: options.isolation,            // Режим изоляции (none/screen/docker)
      screenName: options.screenName,          // Имя screen сессии
      containerName: options.containerName,    // Имя docker контейнера
    });

    // Запускаем агента с указанными опциями старта
    const result = await agentController.start({
      dryRun: options.dryRun,      // Режим пробного запуска (только показать команду)
      detached: options.detached,  // Отсоединённый режим (фоновый процесс)
      attached: options.attached,  // Присоединённый режим (потоковый вывод в консоль)
    });

    // Завершаем процесс с кодом выхода агента (только для attached и не dry-run)
    if (!options.detached && !options.dryRun) {
      process.exit(result.exitCode);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Запускаем главную функцию
main();
