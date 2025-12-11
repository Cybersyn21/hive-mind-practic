/**
 * Build command strings for different agent tools
 */

// Модуль для построения строк команд для различных инструментов агентов.
// Генерирует shell команды с учётом режима изоляции, экранирования и рабочих директорий.
// Поддерживает три режима изоляции: none, screen, docker.

/**
 * Build the command for executing an agent
 * @param {Object} options - Command options
 * @param {string} options.tool - The CLI tool to use (e.g., 'claude')
 * @param {string} options.workingDirectory - Working directory path
 * @param {string} [options.prompt] - Prompt for the agent
 * @param {string} [options.systemPrompt] - System prompt for the agent
 * @param {string} [options.isolation] - Isolation mode: 'none', 'screen', 'docker'
 * @param {string} [options.screenName] - Screen session name (for screen isolation)
 * @param {string} [options.containerName] - Container name (for docker isolation)
 * @param {boolean} [options.detached] - Run in detached mode
 * @returns {string} The command string
 */
// Строит команду для выполнения агента.
// Комбинирует базовую команду инструмента с обёрткой изоляции.
export function buildAgentCommand(options) {
  const {
    tool,
    workingDirectory,
    prompt,
    systemPrompt,
    isolation = 'none',
    screenName,
    containerName,
    detached = false,
  } = options;

  // Строим базовую команду инструмента
  let baseCommand = buildToolCommand(tool, workingDirectory, prompt, systemPrompt);

  // Оборачиваем в изоляцию, если требуется
  if (isolation === 'screen') {
    baseCommand = buildScreenCommand(baseCommand, screenName, detached);
  } else if (isolation === 'docker') {
    baseCommand = buildDockerCommand(baseCommand, containerName, workingDirectory, detached);
  }

  return baseCommand;
}

/**
 * Build the base tool command
 * @param {string} tool - Tool name
 * @param {string} workingDirectory - Working directory
 * @param {string} [prompt] - Prompt
 * @param {string} [systemPrompt] - System prompt
 * @returns {string} Base command
 */
// Строит базовую команду инструмента с аргументами промпта.
// Обрабатывает смену директории и экранирование специальных символов.
function buildToolCommand(tool, workingDirectory, prompt, systemPrompt) {
  let toolCommand = tool;

  // Добавляем опцию --prompt, если указан промпт
  if (prompt) {
    toolCommand += ` --prompt "${escapeQuotes(prompt)}"`;
  }

  // Добавляем опцию --system-prompt, если указан системный промпт
  if (systemPrompt) {
    toolCommand += ` --system-prompt "${escapeQuotes(systemPrompt)}"`;
  }

  // Оборачиваем в bash -c для корректной обработки cd && command
  // Экранируем для использования внутри двойных кавычек bash -c
  const command = `bash -c "cd ${escapeForBashC(workingDirectory)} && ${escapeForBashC(toolCommand)}"`;

  return command;
}

/**
 * Build screen isolation command
 * @param {string} baseCommand - Base command to wrap
 * @param {string} [screenName] - Screen session name
 * @param {boolean} detached - Detached mode
 * @returns {string} Screen command
 */
// Строит команду для изоляции через GNU Screen.
// Screen позволяет запускать команды в отдельных терминальных сессиях,
// которые могут продолжать работать после отключения от них.
function buildScreenCommand(baseCommand, screenName, detached) {
  const sessionName = screenName || `agent-${Date.now()}`;

  if (detached) {
    // Запускаем отсоединённую screen сессию (-dmS флаги)
    return `screen -dmS "${sessionName}" bash -c '${escapeQuotes(baseCommand)}'`;
  } else {
    // Запускаем присоединённую screen сессию (пользователь видит вывод)
    return `screen -S "${sessionName}" bash -c '${escapeQuotes(baseCommand)}'`;
  }
}

/**
 * Build docker isolation command
 * @param {string} baseCommand - Base command to wrap
 * @param {string} [containerName] - Container name
 * @param {string} workingDirectory - Working directory to mount
 * @param {boolean} detached - Detached mode
 * @returns {string} Docker command
 */
// Строит команду для изоляции через Docker контейнер.
// Монтирует рабочую директорию в контейнер и устанавливает её как рабочую.
// Использует образ node:18-slim для совместимости с Node.js инструментами.
function buildDockerCommand(baseCommand, containerName, workingDirectory, detached) {
  const name = containerName || `agent-${Date.now()}`;

  let dockerCommand = 'docker run';

  if (detached) {
    // Фоновый режим (-d)
    dockerCommand += ' -d';
  } else {
    // Интерактивный режим с псевдо-TTY (-it)
    dockerCommand += ' -it';
  }

  dockerCommand += ` --name "${name}"`;                              // Имя контейнера
  dockerCommand += ` -v "${workingDirectory}:${workingDirectory}"`;  // Монтируем директорию
  dockerCommand += ` -w "${workingDirectory}"`;                      // Устанавливаем рабочую директорию
  dockerCommand += ` node:18-slim`;                                  // Базовый образ Node.js
  dockerCommand += ` bash -c '${escapeQuotes(baseCommand)}'`;        // Команда для выполнения

  return dockerCommand;
}

/**
 * Build stop command for screen sessions
 * @param {string} screenName - Screen session name
 * @returns {string} Stop command
 */
// Строит команду для остановки screen сессии.
// Отправляет команду quit в указанную сессию, завершая её.
export function buildScreenStopCommand(screenName) {
  return `screen -S "${screenName}" -X quit`;
}

/**
 * Build stop command for docker containers
 * @param {string} containerName - Container name
 * @returns {string} Stop command
 */
// Строит команду для остановки и удаления docker контейнера.
// Сначала останавливает контейнер, затем удаляет его для очистки ресурсов.
export function buildDockerStopCommand(containerName) {
  return `docker stop "${containerName}" && docker rm "${containerName}"`;
}

/**
 * Escape quotes in strings for shell commands
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
// Экранирует одинарные кавычки для использования в одинарных кавычках shell.
// Использует конструкцию '\'' для правильного экранирования в bash.
// Например: "it's" -> "it'\''s"
function escapeQuotes(str) {
  return str.replace(/'/g, "'\\''");
}

/**
 * Escape strings for use inside bash -c "..."
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
// Экранирует строки для использования внутри bash -c "...".
// Экранирует специальные символы shell: \ " $ `
// Последовательность важна: сначала обратные слэши, затем остальные символы.
function escapeForBashC(str) {
  // Экранируем обратные слэши первыми, затем двойные кавычки, доллары и обратные кавычки
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
}
