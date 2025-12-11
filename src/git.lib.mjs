#!/usr/bin/env node

// Git-related library functions for hive-mind project
// Библиотека Git-функций для проекта hive-mind

// Helper function to check if we're in a git repository
// Вспомогательная функция для проверки, находимся ли мы в git-репозитории
export const isGitRepository = async (execSync) => {
  try {
    // Выполняем git команду для проверки наличия .git директории
    // Подавляем вывод stdout и stderr, чтобы избежать ненужных сообщений
    execSync('git rev-parse --git-dir', {
      encoding: 'utf8',
      stdio: ['pipe', 'ignore', 'ignore']  // Suppress both stdout and stderr / Подавить stdout и stderr
    });
    return true;
  } catch {
    // Если команда завершилась с ошибкой, это не git-репозиторий
    return false;
  }
};

// Helper function to get git tag for current HEAD
// Вспомогательная функция для получения git-тега текущего HEAD
export const getGitTag = async (execSync) => {
  try {
    // Получаем точный тег для текущего HEAD (если он есть)
    // --exact-match гарантирует, что мы получим тег только если HEAD указывает на тегированный коммит
    const gitTag = execSync('git describe --exact-match --tags HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']  // Suppress stderr / Подавить stderr
    }).trim();
    return gitTag;
  } catch {
    // Если текущий коммит не тегирован, возвращаем null
    return null;
  }
};

// Helper function to get latest git tag
// Вспомогательная функция для получения последнего git-тега
export const getLatestGitTag = async (execSync) => {
  try {
    // Получаем последний тег (без сокращенного SHA)
    // Удаляем префикс 'v' если он есть (например, v1.0.0 -> 1.0.0)
    const latestTag = execSync('git describe --tags --abbrev=0', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']  // Suppress stderr / Подавить stderr
    }).trim().replace(/^v/, '');
    return latestTag;
  } catch {
    // Если тегов нет, возвращаем null
    return null;
  }
};

// Helper function to get short commit SHA
// Вспомогательная функция для получения короткого SHA коммита
export const getCommitSha = async (execSync) => {
  try {
    // Получаем короткую версию SHA текущего коммита HEAD
    const commitSha = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']  // Suppress stderr / Подавить stderr
    }).trim();
    return commitSha;
  } catch {
    // Если не можем получить SHA, возвращаем null
    return null;
  }
};

// Helper function to get version string based on git state
// Вспомогательная функция для получения строки версии на основе состояния git
export const getGitVersion = async (execSync, currentVersion) => {
  // First check if we're in a git repository
  // Сначала проверяем, находимся ли мы в git-репозитории
  if (!await isGitRepository(execSync)) {
    return currentVersion;
  }

  // Check if this is a release version (has a git tag)
  // Проверяем, является ли это релизной версией (имеет git-тег)
  const gitTag = await getGitTag(execSync);
  if (gitTag) {
    // It's a tagged release, use the version from package.json
    // Это тегированный релиз, используем версию из package.json
    return currentVersion;
  }

  // Not a tagged release, get the latest tag and commit SHA
  // Не тегированный релиз, получаем последний тег и SHA коммита
  const latestTag = await getLatestGitTag(execSync);
  const commitSha = await getCommitSha(execSync);

  if (latestTag && commitSha) {
    // Формируем версию вида: последний_тег.короткий_sha (например, 1.0.0.abc123)
    return `${latestTag}.${commitSha}`;
  }

  // Fallback to package.json version if git commands fail
  // Возвращаемся к версии из package.json если git команды не сработали
  return currentVersion;
};

// Helper function for async git operations with zx
// Вспомогательная функция для асинхронных git операций с использованием zx
export const getGitVersionAsync = async ($, currentVersion) => {
  // First check if we're in a git repository to avoid "fatal: not a git repository" errors
  // Redirect stderr to /dev/null at shell level to prevent error messages from appearing
  // Сначала проверяем, что мы в git-репозитории, чтобы избежать ошибок "fatal: not a git repository"
  // Перенаправляем stderr в /dev/null на уровне shell, чтобы предотвратить появление сообщений об ошибках
  try {
    const gitCheckResult = await $`git rev-parse --git-dir 2>/dev/null || true`;
    const output = gitCheckResult.stdout.toString().trim();
    if (!output || gitCheckResult.code !== 0) {
      // Not in a git repository, use package.json version
      // Не в git-репозитории, используем версию из package.json
      return currentVersion;
    }
  } catch {
    // Not in a git repository, use package.json version
    // Не в git-репозитории, используем версию из package.json
    return currentVersion;
  }

  // We're in a git repo, proceed with version detection
  // Check if this is a release version (has a git tag)
  // Redirect stderr to /dev/null at shell level to prevent error messages from appearing
  // Мы в git-репозитории, продолжаем определение версии
  // Проверяем, является ли это релизной версией (имеет git-тег)
  // Перенаправляем stderr в /dev/null на уровне shell
  try {
    const gitTagResult = await $`git describe --exact-match --tags HEAD 2>/dev/null || true`;
    if (gitTagResult.code === 0 && gitTagResult.stdout.toString().trim()) {
      // It's a tagged release, use the version from package.json
      // Это тегированный релиз, используем версию из package.json
      return currentVersion;
    }
  } catch {
    // Ignore error - will try next method
    // Игнорируем ошибку - попробуем следующий метод
  }

  // Not a tagged release, get the latest tag and commit SHA
  // Redirect stderr to /dev/null at shell level to prevent error messages from appearing
  // Не тегированный релиз, получаем последний тег и SHA коммита
  // Перенаправляем stderr в /dev/null на уровне shell
  try {
    const latestTagResult = await $`git describe --tags --abbrev=0 2>/dev/null || true`;
    const commitShaResult = await $`git rev-parse --short HEAD 2>/dev/null || true`;

    const latestTag = latestTagResult.stdout.toString().trim().replace(/^v/, '');
    const commitSha = commitShaResult.stdout.toString().trim();

    if (latestTag && commitSha && latestTagResult.code === 0 && commitShaResult.code === 0) {
      // Формируем версию из последнего тега и короткого SHA
      return `${latestTag}.${commitSha}`;
    }
  } catch {
    // Ignore error - will use fallback
    // Игнорируем ошибку - используем fallback
  }

  // Fallback to package.json version if git commands fail
  // Возвращаемся к версии из package.json если git команды не сработали
  return currentVersion;
};

// Export all functions as default as well
// Экспортируем все функции также как default объект
export default {
  isGitRepository,
  getGitTag,
  getLatestGitTag,
  getCommitSha,
  getGitVersion,
  getGitVersionAsync
};