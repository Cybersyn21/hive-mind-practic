/**
 * Execute commands using command-stream
 */

// Модуль для выполнения shell команд с использованием command-stream.
// Предоставляет функции для синхронного и асинхронного выполнения команд,
// обработки сигналов и управления фоновыми процессами.

import { getCommandStream } from './utils/loader.mjs';

/**
 * Execute a command and return the result
 * @param {string} command - Command to execute
 * @param {Object} [options] - Execution options
 * @param {boolean} [options.dryRun] - If true, just return the command without executing
 * @param {boolean} [options.attached] - If true, stream output to console
 * @param {Function} [options.onStdout] - Callback for stdout chunks
 * @param {Function} [options.onStderr] - Callback for stderr chunks
 * @param {Function} [options.onExit] - Callback for exit code
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>} Execution result
 */
// Выполняет команду и возвращает результат (блокирующая операция).
// Ждёт завершения команды и собирает весь stdout/stderr.
// Поддерживает потоковый вывод в консоль и колбэки для обработки чанков данных.
export async function executeCommand(command, options = {}) {
  const { dryRun = false, attached = true, onStdout, onStderr, onExit } = options;

  // В режиме dry-run только показываем команду
  if (dryRun) {
    console.log('Dry run - command that would be executed:');
    console.log(command);
    return { exitCode: 0, stdout: '', stderr: '', command };
  }

  // Получаем функцию $ из command-stream для выполнения команд
  const { $ } = await getCommandStream();
  const commandStream = $`${command}`;

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    // Итерируемся по потоку событий от выполняемой команды
    for await (const chunk of commandStream.stream()) {
      if (chunk.type === 'stdout') {
        // Накапливаем stdout
        stdout += chunk.data;
        // Если attached режим, пробрасываем в консоль
        if (attached) {
          process.stdout.write(chunk.data);
        }
        // Вызываем колбэк, если предоставлен
        if (onStdout) {
          onStdout(chunk.data);
        }
      } else if (chunk.type === 'stderr') {
        // Накапливаем stderr
        stderr += chunk.data;
        if (attached) {
          process.stderr.write(chunk.data);
        }
        if (onStderr) {
          onStderr(chunk.data);
        }
      } else if (chunk.type === 'exit') {
        // Сохраняем код выхода
        exitCode = chunk.code;
        if (onExit) {
          onExit(chunk.code);
        }
      }
    }
  } catch (error) {
    console.error('Command execution failed:', error.message);
    exitCode = 1;
    stderr += error.message;
  }

  return { exitCode, stdout, stderr, command };
}

/**
 * Start a command execution without waiting for completion
 * @param {string} command - Command to execute
 * @param {Object} [options] - Execution options
 * @param {boolean} [options.attached] - If true, stream output to console
 * @returns {Promise<Object>} Process handle with methods to interact with the process
 */
// Запускает выполнение команды без ожидания завершения (неблокирующая операция).
// Возвращает хендл процесса с методами для взаимодействия.
// Позволяет запустить команду и продолжить работу, а затем дождаться результата через waitForExit().
export async function startCommand(command, options = {}) {
  const { attached = true } = options;

  const { $ } = await getCommandStream();
  const commandStream = $`${command}`;

  let stdout = '';
  let stderr = '';
  let exitCode = null;
  let hasExited = false;
  let resolveExit;

  // Создаём Promise для ожидания завершения процесса
  const exitPromise = new Promise((resolve) => {
    resolveExit = resolve;
  });

  // Запускаем обработку потока в фоне (IIFE)
  (async () => {
    try {
      for await (const chunk of commandStream.stream()) {
        if (chunk.type === 'stdout') {
          stdout += chunk.data;
          if (attached) {
            process.stdout.write(chunk.data);
          }
        } else if (chunk.type === 'stderr') {
          stderr += chunk.data;
          if (attached) {
            process.stderr.write(chunk.data);
          }
        } else if (chunk.type === 'exit') {
          // Процесс завершился
          exitCode = chunk.code;
          hasExited = true;
          resolveExit(chunk.code);
          return;
        }
      }
      // Если дошли сюда без события exit, резолвим с успехом
      if (!hasExited) {
        exitCode = 0;
        hasExited = true;
        resolveExit(0);
      }
    } catch (error) {
      console.error('Command execution failed:', error.message);
      exitCode = 1;
      stderr += error.message;
      hasExited = true;
      resolveExit(1);
    }
  })();

  // Даём потоку момент для старта
  await Promise.resolve();

  // Возвращаем хендл для взаимодействия с процессом
  return {
    command,
    waitForExit: () => exitPromise,                               // Ждать завершения
    getOutput: () => ({ stdout, stderr, exitCode, hasExited }),  // Получить текущий вывод
    commandStream,                                                // Доступ к потоку
  };
}

/**
 * Execute a command in the background (detached)
 * @param {string} command - Command to execute
 * @returns {Promise<{pid: number|null}>} Process information
 */
// Выполняет команду в фоновом режиме (полностью отсоединённый процесс).
// Использует Node.js child_process.spawn с флагом detached.
// Процесс продолжит работу даже после завершения родительского процесса.
export async function executeDetached(command) {
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    try {
      // Запускаем процесс в detached режиме
      const child = spawn('bash', ['-c', command], {
        detached: true,  // Процесс не привязан к родителю
        stdio: 'ignore', // Игнорируем stdio (нет связи с родительским процессом)
      });

      // Отсоединяем процесс, позволяя ему работать независимо
      child.unref();

      resolve({ pid: child.pid });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Setup CTRL+C handler for graceful shutdown
 * @param {Function} cleanupFn - Function to call on CTRL+C
 * @returns {Function} Function to remove the handler
 */
// Устанавливает обработчик CTRL+C (SIGINT/SIGTERM) для graceful shutdown.
// Поддерживает Node.js и Deno runtime.
// Вызывает функцию очистки перед завершением процесса.
// Возвращает функцию для удаления обработчика.
export function setupSignalHandler(cleanupFn) {
  // Определяем runtime окружение
  const isDeno = typeof Deno !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

  if (isDeno) {
    // Обработка сигналов в Deno
    const handler = async () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      try {
        await cleanupFn();
      } catch (error) {
        console.error('Error during cleanup:', error.message);
      }
      Deno.exit(0);
    };

    // Добавляем слушатель SIGINT в Deno
    Deno.addSignalListener('SIGINT', handler);

    // Возвращаем функцию для удаления слушателя
    return () => {
      try {
        Deno.removeSignalListener('SIGINT', handler);
      } catch {
        // Слушатель мог быть уже удалён
      }
    };
  } else if (isNode) {
    // Обработка сигналов в Node.js
    const handler = async (signal) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      try {
        await cleanupFn();
      } catch (error) {
        console.error('Error during cleanup:', error.message);
      }
      process.exit(0);
    };

    // Добавляем обработчики для SIGINT (CTRL+C) и SIGTERM
    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);

    // Возвращаем функцию для удаления обработчиков
    return () => {
      process.off('SIGINT', handler);
      process.off('SIGTERM', handler);
    };
  }

  // Для других runtime возвращаем no-op функцию
  return () => {};
}
