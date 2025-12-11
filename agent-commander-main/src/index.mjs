/**
 * Agent Commander - Main library interface
 * A JavaScript library to control agents enclosed in CLI commands
 */

// Agent Commander - главный интерфейс библиотеки.
// JavaScript библиотека для управления агентами, запущенными через CLI команды.
// Предоставляет API для запуска агентов в различных режимах изоляции (none, screen, docker),
// управления их жизненным циклом и сбора выходных данных.
import { buildAgentCommand, buildScreenStopCommand, buildDockerStopCommand } from './command-builder.mjs';
import { executeCommand, executeDetached, setupSignalHandler, startCommand } from './executor.mjs';

/**
 * Parse JSON messages from output if the tool supports it
 * @param {string} output - Raw output to parse
 * @returns {Array|null} Array of parsed JSON messages or null if parsing fails
 */
// Парсит JSON сообщения из вывода агента, если инструмент поддерживает JSON формат.
// Пытается распарсить вывод как JSON массив или объект, либо извлечь JSON построчно.
// Возвращает массив распарсенных сообщений или null, если парсинг не удался.
function parseJsonMessages(output) {
  try {
    // Пытаемся распарсить вывод как JSON массив или объект
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    // Если это один объект, оборачиваем его в массив
    return [parsed];
  } catch {
    // Если полный парсинг не удался, пытаемся извлечь JSON объекты построчно
    const lines = output.split('\n');
    const messages = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Проверяем, начинается ли строка с { или [ (признаки JSON)
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          messages.push(parsed);
        } catch {
          // Пропускаем строки, которые не являются валидным JSON
        }
      }
    }
    return messages.length > 0 ? messages : null;
  }
}

/**
 * Create an agent controller
 * @param {Object} options - Agent configuration
 * @param {string} options.tool - CLI tool to use (e.g., 'claude')
 * @param {string} options.workingDirectory - Working directory for the agent
 * @param {string} [options.prompt] - Prompt for the agent
 * @param {string} [options.systemPrompt] - System prompt for the agent
 * @param {string} [options.isolation='none'] - Isolation mode: 'none', 'screen', 'docker'
 * @param {string} [options.screenName] - Screen session name (for screen isolation)
 * @param {string} [options.containerName] - Container name (for docker isolation)
 * @returns {Object} Agent controller with start and stop methods
 */
// Создаёт контроллер агента - главную фабричную функцию библиотеки.
// Возвращает объект с методами start() и stop() для управления жизненным циклом агента.
// Поддерживает три режима изоляции: none (прямой запуск), screen (терминальная сессия), docker (контейнер).
export function agent(options) {
  const {
    tool,                        // CLI инструмент для запуска (например, 'claude', 'echo')
    workingDirectory,            // Рабочая директория для агента
    prompt,                      // Пользовательский промпт
    systemPrompt,                // Системный промпт
    isolation = 'none',          // Режим изоляции: 'none', 'screen', 'docker'
    screenName,                  // Имя screen сессии (для screen изоляции)
    containerName,               // Имя docker контейнера (для docker изоляции)
  } = options;

  // Валидируем обязательные параметры
  if (!tool) {
    throw new Error('tool is required');
  }
  if (!workingDirectory) {
    throw new Error('workingDirectory is required');
  }
  if (isolation === 'screen' && !screenName) {
    throw new Error('screenName is required for screen isolation');
  }
  if (isolation === 'docker' && !containerName) {
    throw new Error('containerName is required for docker isolation');
  }

  // Внутреннее состояние контроллера агента
  let processHandle = null;         // Хендл запущенного процесса
  let removeSignalHandler = null;   // Функция для удаления обработчика сигналов
  let command = null;                // Сохранённая команда для выполнения

  /**
   * Start the agent (non-blocking)
   * @param {Object} [startOptions] - Start options
   * @param {boolean} [startOptions.dryRun] - If true, just show the command
   * @param {boolean} [startOptions.detached] - Run in detached mode
   * @param {boolean} [startOptions.attached=true] - Stream output to console
   * @returns {Promise<void>} Resolves when process is started (not when it exits)
   */
  // Запускает агента (неблокирующая операция).
  // Возвращает Promise, который резолвится при старте процесса, а не при его завершении.
  // Для получения результата нужно вызвать stop().
  const start = async (startOptions = {}) => {
    const { dryRun = false, detached = false, attached = true } = startOptions;

    // Строим команду для выполнения с учётом режима изоляции
    command = buildAgentCommand({
      tool,
      workingDirectory,
      prompt,
      systemPrompt,
      isolation,
      screenName,
      containerName,
      detached,
    });

    // В режиме dry-run только показываем команду без выполнения
    if (dryRun) {
      console.log('Dry run - command that would be executed:');
      console.log(command);
      return;
    }

    // Устанавливаем обработчик сигналов для graceful shutdown (только для attached режима без изоляции)
    if (!detached && isolation === 'none') {
      removeSignalHandler = setupSignalHandler(async () => {
        console.log('Propagating shutdown to agent...');
        // Процесс будет завершён естественным образом через SIGINT
      });
    }

    if (detached) {
      // Для detached режима запускаем процесс в фоне
      processHandle = await executeDetached(command);
      console.log(`Agent started in detached mode`);
      if (isolation === 'screen') {
        console.log(`Screen session: ${screenName}`);
      } else if (isolation === 'docker') {
        console.log(`Container: ${containerName}`);
      }
    } else {
      // Для attached режима запускаем команду без ожидания завершения
      processHandle = await startCommand(command, { attached });
    }
  };

  /**
   * Stop the agent and collect output
   * @param {Object} [stopOptions] - Stop options
   * @param {boolean} [stopOptions.dryRun] - If true, just show the command
   * @returns {Promise<Object>} Result with exitCode, output.plain, and output.parsed
   */
  // Останавливает агента и собирает выходные данные.
  // Для изоляции screen/docker отправляет команду остановки.
  // Для режима none ждёт завершения процесса и собирает stdout/stderr.
  const stop = async (stopOptions = {}) => {
    const { dryRun = false } = stopOptions;

    // Для режимов изоляции отправляем команду остановки
    if (isolation === 'screen' || isolation === 'docker') {
      let stopCommand;
      if (isolation === 'screen') {
        if (!screenName) {
          throw new Error('screenName is required to stop screen session');
        }
        // Строим команду для завершения screen сессии
        stopCommand = buildScreenStopCommand(screenName);
      } else if (isolation === 'docker') {
        if (!containerName) {
          throw new Error('containerName is required to stop docker container');
        }
        // Строим команду для остановки и удаления docker контейнера
        stopCommand = buildDockerStopCommand(containerName);
      }

      if (dryRun) {
        console.log('Dry run - command that would be executed:');
        console.log(stopCommand);
        return { exitCode: 0, output: { plain: '', parsed: null } };
      }

      // Выполняем команду остановки
      const result = await executeCommand(stopCommand, { dryRun, attached: true });
      return {
        exitCode: result.exitCode,
        output: {
          plain: result.stdout,
          parsed: null, // Команды остановки не производят парсимый вывод
        },
      };
    }

    // Для режима без изоляции ждём завершения процесса и собираем вывод
    if (isolation === 'none') {
      if (!processHandle) {
        throw new Error('Agent not started or already stopped');
      }

      // Ждём завершения процесса
      const exitCode = await processHandle.waitForExit();
      const { stdout, stderr } = processHandle.getOutput();

      // Объединяем stdout и stderr для текстового вывода
      const plainOutput = stdout + (stderr ? '\n' + stderr : '');

      // Пытаемся распарсить JSON сообщения из вывода
      const parsedOutput = parseJsonMessages(plainOutput);

      // Очищаем обработчик сигналов
      if (removeSignalHandler) {
        removeSignalHandler();
        removeSignalHandler = null;
      }

      return {
        exitCode,
        output: {
          plain: plainOutput,     // Весь текстовый вывод
          parsed: parsedOutput,   // Распарсенные JSON сообщения или null
        },
      };
    }

    throw new Error(`Unsupported isolation mode: ${isolation}`);
  };

  // Возвращаем API контроллера агента с методами start и stop
  return {
    start,
    stop,
  };
}

// Экспортируем вспомогательные утилиты для продвинутого использования
export { buildAgentCommand, buildScreenStopCommand, buildDockerStopCommand } from './command-builder.mjs';
export { executeCommand, executeDetached, setupSignalHandler } from './executor.mjs';
