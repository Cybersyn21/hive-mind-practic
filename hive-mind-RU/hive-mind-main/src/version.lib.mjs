#!/usr/bin/env node

// Модуль для определения версии приложения
// Module for determining application version

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getGitVersion } from './git.lib.mjs';

// Проверка, запущено ли приложение как скрипт (не установленный пакет)
// Check if application is running as script (not installed package)
function isRunningAsScript() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const gitDir = join(__dirname, '..', '.git');
  // Если есть .git директория, значит запущено как скрипт из репозитория
  return existsSync(gitDir);
}

// Получение версии приложения
// Get application version
export async function getVersion() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packagePath = join(__dirname, '..', 'package.json');

  try {
    // Читаем версию из package.json
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version;

    // Если запущено как скрипт, формируем версию на основе git
    // (например, 1.0.0.abc123 для неотмеченных коммитов)
    if (isRunningAsScript()) {
      const version = await getGitVersion(execSync, currentVersion);
      return version;
    }

    // Если установлено как пакет, возвращаем версию из package.json
    return currentVersion;
  } catch {
    // В случае ошибки возвращаем 'unknown'
    return 'unknown';
  }
}

// Экспортируем как default объект
export default { getVersion };