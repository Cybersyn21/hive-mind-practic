#!/usr/bin/env node

/**
 * Скрипт для загрузки source maps в Sentry для каждого релиза
 * Должен запускаться в CI/CD после публикации новой версии
 * Source maps позволяют Sentry показывать читаемые стеки ошибок вместо минифицированного кода
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Читаем package.json для получения версии и имени проекта
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const projectName = 'hive-mind';
const orgName = 'deepassistant';

console.log(`📦 Uploading source maps for ${packageJson.name}@${version}`);

// Проверяем, запущен ли скрипт в CI окружении
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Получаем токен аутентификации Sentry из переменных окружения
const authToken = process.env.SENTRY_AUTH_TOKEN;

if (!authToken) {
  if (isCI) {
    console.error('❌ SENTRY_AUTH_TOKEN is required in CI environment');
    process.exit(1);
  } else {
    console.log('⚠️  SENTRY_AUTH_TOKEN not set, skipping source map upload');
    process.exit(0);
  }
}

try {
  // Проверяем, установлен ли Sentry CLI
  try {
    execSync('npx @sentry/cli --version', { stdio: 'ignore' });
  } catch {
    console.log('📥 Installing @sentry/cli...');
    execSync('npm install -g @sentry/cli', { stdio: 'inherit' });
  }

  // Создаем релиз в Sentry
  // Релиз связывает source maps с конкретной версией приложения
  console.log(`🔄 Creating release ${version} in Sentry...`);
  execSync(
    `npx @sentry/cli releases new ${version} --org ${orgName} --project ${projectName}`,
    {
      stdio: 'inherit',
      env: { ...process.env, SENTRY_AUTH_TOKEN: authToken }
    }
  );

  // Загружаем source maps для всех .mjs файлов
  console.log('📤 Uploading source maps...');

  // Загружаем исходные файлы из директории src
  if (existsSync(join(rootDir, 'src'))) {
    execSync(
      `npx @sentry/cli releases files ${version} upload-sourcemaps ./src --org ${orgName} --project ${projectName} --url-prefix '~/src'`,
      {
        stdio: 'inherit',
        cwd: rootDir,
        env: { ...process.env, SENTRY_AUTH_TOKEN: authToken }
      }
    );
  }

  // Загружаем тестовые файлы (полезно для отладки ошибок в тестах)
  if (existsSync(join(rootDir, 'tests'))) {
    execSync(
      `npx @sentry/cli releases files ${version} upload-sourcemaps ./tests --org ${orgName} --project ${projectName} --url-prefix '~/tests'`,
      {
        stdio: 'inherit',
        cwd: rootDir,
        env: { ...process.env, SENTRY_AUTH_TOKEN: authToken }
      }
    );
  }

  // Финализируем релиз (помечаем как готовый)
  console.log('✅ Finalizing release...');
  execSync(
    `npx @sentry/cli releases finalize ${version} --org ${orgName} --project ${projectName}`,
    {
      stdio: 'inherit',
      env: { ...process.env, SENTRY_AUTH_TOKEN: authToken }
    }
  );

  // Привязываем коммиты к релизу (если находимся в git-репозитории)
  // Это позволяет Sentry отображать связь между ошибками и коммитами
  try {
    const gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    execSync(
      `npx @sentry/cli releases set-commits ${version} --auto --org ${orgName} --project ${projectName}`,
      {
        stdio: 'inherit',
        env: { ...process.env, SENTRY_AUTH_TOKEN: authToken }
      }
    );
    console.log(`📝 Associated commits with release ${version}`);
  } catch (err) {
    console.log('⚠️  Could not associate commits (not a git repository or no commits)');
  }

  console.log(`✅ Successfully uploaded source maps for version ${version}`);
} catch (error) {
  console.error('❌ Failed to upload source maps:', error.message);
  if (isCI) {
    process.exit(1);
  }
}