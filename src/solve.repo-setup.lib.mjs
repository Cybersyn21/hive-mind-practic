/**
 * Модуль настройки репозитория для solve.mjs
 * Обрабатывает клонирование репозитория, создание форков и настройку удаленных репозиториев
 */

// Главная функция настройки и клонирования репозитория
// Выполняет полный цикл: настройка форка -> клонирование -> настройка remotes -> аутентификация
export async function setupRepositoryAndClone({
  argv,
  owner,
  repo,
  forkOwner,
  tempDir,
  isContinueMode,
  issueUrl,
  log,
  $
}) {
  // Настраиваем репозиторий и обрабатываем форкинг (создание форка если нужно)
  const { repoToClone, forkedRepo, upstreamRemote, prForkOwner } = await setupRepository(argv, owner, repo, forkOwner, issueUrl);

  // Клонируем репозиторий и настраиваем удаленные репозитории (remotes)
  await cloneRepository(repoToClone, tempDir, argv, owner, repo);
  // Настраиваем upstream remote и синхронизируем форк с оригинальным репозиторием при необходимости
  await setupUpstreamAndSync(tempDir, forkedRepo, upstreamRemote, owner, repo, argv);
  // Настраиваем pr-fork remote если продолжаем работу с чужим форк-PR с флагом --fork
  const prForkRemote = await setupPrForkRemote(tempDir, argv, prForkOwner, repo, isContinueMode, owner);

  // Настраиваем git аутентификацию через GitHub CLI (gh)
  const authSetupResult = await $({ cwd: tempDir })`gh auth setup-git 2>&1`;
  if (authSetupResult.code !== 0) {
    await log('Note: gh auth setup-git had issues, continuing anyway\n');
  }

  return { repoToClone, forkedRepo, upstreamRemote, prForkRemote, prForkOwner };
}

// Вспомогательная функция: настройка репозитория (создание форка, проверка прав доступа)
async function setupRepository(argv, owner, repo, forkOwner, issueUrl) {
  const repository = await import('./solve.repository.lib.mjs');
  const { setupRepository: setupRepoFn } = repository;
  return await setupRepoFn(argv, owner, repo, forkOwner, issueUrl);
}

// Вспомогательная функция: клонирование репозитория в временную директорию
async function cloneRepository(repoToClone, tempDir, argv, owner, repo) {
  const repository = await import('./solve.repository.lib.mjs');
  const { cloneRepository: cloneRepoFn } = repository;
  return await cloneRepoFn(repoToClone, tempDir, argv, owner, repo);
}

// Вспомогательная функция: настройка upstream remote и синхронизация форка
async function setupUpstreamAndSync(tempDir, forkedRepo, upstreamRemote, owner, repo, argv) {
  const repository = await import('./solve.repository.lib.mjs');
  const { setupUpstreamAndSync: setupUpstreamFn } = repository;
  return await setupUpstreamFn(tempDir, forkedRepo, upstreamRemote, owner, repo, argv);
}

// Вспомогательная функция: настройка pr-fork remote для продолжения работы с форк-PR
async function setupPrForkRemote(tempDir, argv, prForkOwner, repo, isContinueMode, owner) {
  const repository = await import('./solve.repository.lib.mjs');
  const { setupPrForkRemote: setupPrForkFn } = repository;
  return await setupPrForkFn(tempDir, argv, prForkOwner, repo, isContinueMode, owner);
}

// Проверяет дефолтную ветку и статус репозитория
// Убеждается что мы находимся на главной ветке и рабочая директория чиста
export async function verifyDefaultBranchAndStatus({
  tempDir,
  log,
  formatAligned,
  $
}) {
  // Проверяем что мы на дефолтной ветке и получаем её имя
  const defaultBranchResult = await $({ cwd: tempDir })`git branch --show-current`;

  if (defaultBranchResult.code !== 0) {
    await log('Error: Failed to get current branch');
    await log(defaultBranchResult.stderr ? defaultBranchResult.stderr.toString() : 'Unknown error');
    throw new Error('Failed to get current branch');
  }

  const defaultBranch = defaultBranchResult.stdout.toString().trim();
  if (!defaultBranch) {
    // Дефолтная ветка не обнаружена - выводим детальную диагностическую информацию
    await log('');
    await log(`${formatAligned('❌', 'DEFAULT BRANCH DETECTION FAILED', '')}`, { level: 'error' });
    await log('');
    await log('  🔍 What happened:');
    await log('     Unable to determine the repository\'s default branch.');
    await log('');
    await log('  💡 This might mean:');
    await log('     • Repository is empty (no commits)');
    await log('     • Unusual repository configuration');
    await log('     • Git command issues');
    await log('');
    await log('  🔧 How to fix:');
    await log('     1. Check repository status');
    await log(`     2. Verify locally: cd ${tempDir} && git branch`);
    await log(`     3. Check remote: cd ${tempDir} && git branch -r`);
    await log('');
    throw new Error('Default branch detection failed');
  }
  await log(`\n${formatAligned('📌', 'Default branch:', defaultBranch)}`);

  // Убеждаемся что мы на чистой дефолтной ветке (нет незакоммиченных изменений)
  const statusResult = await $({ cwd: tempDir })`git status --porcelain`;
  if (statusResult.code !== 0) {
    await log('Error: Failed to check git status');
    await log(statusResult.stderr ? statusResult.stderr.toString() : 'Unknown error');
    throw new Error('Failed to check git status');
  }

  // Примечание: пустой вывод означает чистую рабочую директорию
  const statusOutput = statusResult.stdout.toString().trim();
  if (statusOutput) {
    // Обнаружены незакоммиченные изменения после клонирования - это ошибка
    await log('Error: Repository has uncommitted changes after clone');
    await log(`Status output: ${statusOutput}`);
    throw new Error('Repository has uncommitted changes after clone');
  }

  return defaultBranch;
}