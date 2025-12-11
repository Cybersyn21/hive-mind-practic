// Конфигурация ESLint для проекта agent-commander.
// Определяет правила статического анализа кода, настройки языка и глобальные переменные.
// Использует новый формат flat config (ESLint 9+) вместо устаревшего .eslintrc.
import js from '@eslint/js';

export default [
  // Используем рекомендованный набор правил от ESLint
  js.configs.recommended,
  {
    // Настройки языка JavaScript/ECMAScript
    languageOptions: {
      ecmaVersion: 2022,      // Поддержка синтаксиса ES2022 (top-level await, class fields и т.д.)
      sourceType: 'module',   // Использование ES модулей (import/export)
      // Глобальные переменные, доступные в коде без явного объявления
      globals: {
        console: 'readonly',        // Консоль для вывода логов
        process: 'readonly',        // Node.js глобальный объект процесса
        Buffer: 'readonly',         // Node.js класс для работы с бинарными данными
        __dirname: 'readonly',      // Директория текущего модуля (CommonJS)
        __filename: 'readonly',     // Путь к текущему файлу (CommonJS)
        global: 'readonly',         // Глобальный объект Node.js
        globalThis: 'readonly',     // Универсальный глобальный объект (ES2020)
        fetch: 'readonly',          // Fetch API для HTTP запросов
        Deno: 'readonly',           // Deno runtime глобальный объект (для совместимости)
        AbortController: 'readonly', // API для отмены асинхронных операций
      },
    },
    // Правила линтинга
    rules: {
      // Неиспользуемые переменные - warning, игнорируем переменные начинающиеся с _
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Константные условия - ошибка, но не проверяем в циклах (для while(true) и т.д.)
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
];
