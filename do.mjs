#!/usr/bin/env node
// Простая обёртка для выполнения промптов через Claude CLI
// Автоматически добавляет флаги для тестирования и форматирования вывода

// Используем use-m для динамической загрузки модулей с кросс-рантайм совместимостью
const { use } = eval(await (await fetch('https://unpkg.com/use-m/use.js')).text());

// Используем command-stream для единообразного поведения команды $ в разных средах выполнения
const { $ } = await use('command-stream');

const yargs = (await use('yargs@latest')).default;

// Настройка парсинга аргументов - промпт передается как позиционный аргумент
const argv = yargs(process.argv.slice(2))
  .usage('Usage: $0 <prompt>')
  .positional('prompt', {
    type: 'string',
    description: 'The prompt to send to Claude'  // Промпт для отправки в Claude
  })
  .demandCommand(1, 'The prompt is required')  // Промпт обязателен
  .help('h')
  .alias('h', 'help')
  .argv;

const prompt = argv._[0];

// Путь к исполняемому файлу Claude CLI (можно переопределить через переменную окружения)
const claudePath = process.env.CLAUDE_PATH || '/Users/konard/.claude/local/claude';

try {
  // Выполняем команду Claude с предустановленными флагами:
  // --output-format stream-json: потоковый вывод в формате JSON
  // --verbose: детальный вывод для отладки
  // --dangerously-skip-permissions: пропуск проверок прав (для автоматизации)
  // --append-system-prompt: добавление системного промпта о необходимости тестирования кода
  // --model sonnet: использование модели Claude Sonnet
  // | jq: форматирование JSON-вывода для читаемости
  const result = await $`${claudePath} -p "${prompt}" --output-format stream-json --verbose --dangerously-skip-permissions --append-system-prompt "Code changes should be tested before finishing the work, preferably with automated tests." --model sonnet | jq`;
  console.log(result.text());
} catch (error) {
  console.error('Error executing command:', error.message);
  process.exit(1);
}