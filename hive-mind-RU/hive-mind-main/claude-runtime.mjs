#!/usr/bin/env node
/**
 * Claude Runtime Switcher
 *
 * Experimental tool to switch Claude CLI between Node.js and Bun runtime.
 * This modifies the Claude CLI script's shebang line to use either node or bun.
 *
 * Usage:
 *   ./claude-runtime.mjs --to-bun    # Switch Claude to use Bun
 *   ./claude-runtime.mjs --to-node   # Switch Claude to use Node.js
 *   ./claude-runtime.mjs --status    # Check current runtime
 */

// Инструмент для переключения среды выполнения Claude CLI между Node.js и Bun
// Это экспериментальный скрипт, который модифицирует shebang-строку в исполняемом файле Claude CLI

// Используем use-m для динамического импорта модулей с поддержкой кросс-рантайм совместимости
// use-m позволяет загружать npm-пакеты без предварительной установки, работая как в Node.js, так и в Bun
if (typeof use === 'undefined') {
  globalThis.use = (await eval(await (await fetch('https://unpkg.com/use-m/use.js')).text())).use;
}

// Загружаем библиотеку yargs для парсинга аргументов командной строки
const yargsModule = await use('yargs@17.7.2');
const yargs = yargsModule.default || yargsModule;
const { hideBin } = await use('yargs@17.7.2/helpers');

// Импортируем функции из библиотеки Claude для работы с CLI
const claudeLib = await import('./claude.lib.mjs');
const { handleClaudeRuntimeSwitch } = claudeLib;

// Настройка парсинга аргументов командной строки
// Определяем опции --to-bun, --to-node и --status
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('to-bun', {
    type: 'boolean',
    description: 'Switch Claude CLI to run with Bun instead of Node.js', // Переключить Claude на Bun
    conflicts: ['to-node'] // Конфликтует с --to-node
  })
  .option('to-node', {
    type: 'boolean',
    description: 'Switch Claude CLI to run with Node.js instead of Bun', // Переключить Claude на Node.js
    conflicts: ['to-bun'] // Конфликтует с --to-bun
  })
  .option('status', {
    type: 'boolean',
    description: 'Check current Claude runtime configuration' // Проверить текущую конфигурацию
  })
  .help('h')
  .alias('h', 'help')
  .strict()
  .argv;

// Основная функция выполнения скрипта
async function main() {
  // Преобразуем опции в формат, ожидаемый функцией handleClaudeRuntimeSwitch
  const options = {
    'force-claude-bun-run': argv.toBun,
    'force-claude-nodejs-run': argv.toNode
  };

  if (argv.status) {
    // Проверка текущего статуса среды выполнения Claude
    const { execSync } = await import('child_process');
    const { $ } = await use('command-stream');

    try {
      // Находим расположение исполняемого файла Claude CLI в системе
      const whichResult = await $`which claude`;
      let claudePath = '';
      for await (const chunk of whichResult.stream()) {
        if (chunk.type === 'stdout') {
          claudePath = chunk.data.toString().trim();
        }
      }

      if (!claudePath) {
        console.log('❌ Claude CLI not found in PATH');
        process.exit(1);
      }

      console.log(`📍 Claude CLI location: ${claudePath}`);

      // Читаем shebang-строку (первую строку файла), которая определяет интерпретатор
      // Shebang начинается с #! и указывает, какая программа должна выполнить скрипт
      const fs = (await use('fs')).promises;
      const content = await fs.readFile(claudePath, 'utf8');
      const firstLine = content.split('\n')[0];

      console.log(`📜 Shebang line: ${firstLine}`);

      // Определяем текущую среду выполнения по содержимому shebang
      if (firstLine.includes('bun')) {
        console.log('🚀 Current runtime: Bun');
      } else if (firstLine.includes('node')) {
        console.log('🟢 Current runtime: Node.js');
      } else {
        console.log('❓ Current runtime: Unknown');
      }

      // Проверяем доступность сред выполнения в системе
      try {
        execSync('which bun', { stdio: 'ignore' });
        console.log('✅ Bun is available');
      } catch {
        console.log('❌ Bun is not installed');
      }

      try {
        execSync('which node', { stdio: 'ignore' });
        console.log('✅ Node.js is available');
      } catch {
        console.log('❌ Node.js is not installed');
      }
      
    } catch (error) {
      console.error(`Error checking status: ${error.message}`);
      process.exit(1);
    }

  } else if (argv.toBun || argv.toNode) {
    // Выполнение переключения среды выполнения
    await handleClaudeRuntimeSwitch(options);

    if (argv.toBun) {
      console.log('\n✅ Claude CLI has been switched to Bun runtime');
      console.log('   You can now use Claude with improved performance');
      console.log('   To switch back, run: ./claude-runtime.mjs --to-node');
    } else {
      console.log('\n✅ Claude CLI has been restored to Node.js runtime');
      console.log('   This is the default and most compatible configuration');
      console.log('   To switch to Bun, run: ./claude-runtime.mjs --to-bun');
    }
  } else {
    // Не указано действие - показываем справку
    console.log('Claude Runtime Switcher - Experimental Tool\n');
    console.log('Usage:');
    console.log('  ./claude-runtime.mjs --to-bun    # Switch to Bun runtime');
    console.log('  ./claude-runtime.mjs --to-node   # Switch to Node.js runtime');
    console.log('  ./claude-runtime.mjs --status    # Check current runtime\n');
    console.log('⚠️  WARNING: This is experimental and may break Claude CLI');
    console.log('   Always keep a backup or know how to reinstall Claude');
  }
}

// Запуск основной функции с обработкой ошибок
main().catch(error => {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
});