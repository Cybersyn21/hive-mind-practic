/**
 * Утилиты обработки ошибок для solve.mjs
 * Централизует логику обработки различных типов ошибок, прикрепления логов и закрытия PR
 */

// Импортируем обработчик безопасного выхода
import { safeExit } from './exit-handler.lib.mjs';

// Импортируем интеграцию Sentry для отчетов об ошибках
import { reportError } from './sentry.lib.mjs';

// Импортируем создатель GitHub issues для автоматического репортинга ошибок
import { handleErrorWithIssueCreation } from './github-issue-creator.lib.mjs';

/**
 * Обрабатывает прикрепление логов и закрытие PR при сбое
 * Вызывается при различных типах ошибок для единообразной обработки
 */
export const handleFailure = async (options) => {
  const {
    error,
    errorType,
    shouldAttachLogs,
    argv,
    global,
    owner,
    repo,
    log,
    getLogFile,
    attachLogToGitHub,
    cleanErrorMessage,
    sanitizeLogContent,
    $
  } = options;

  // Offer to create GitHub issue for the error
  try {
    await handleErrorWithIssueCreation({
      error,
      errorType,
      logFile: getLogFile(),
      context: {
        owner: global.owner || owner,
        repo: global.repo || repo,
        prNumber: global.createdPR?.number,
        errorType
      },
      skipPrompt: !process.stdin.isTTY || argv.noIssueCreation
    });
  } catch (issueError) {
    reportError(issueError, {
      context: 'automatic_issue_creation',
      operation: 'handle_error_with_issue_creation'
    });
    await log(`⚠️  Could not create issue: ${issueError.message}`, { level: 'warning' });
  }

  // If --attach-logs is enabled, try to attach failure logs
  if (shouldAttachLogs && getLogFile() && global.createdPR && global.createdPR.number) {
    await log('\n📄 Attempting to attach failure logs...');
    try {
      const logUploadSuccess = await attachLogToGitHub({
        logFile: getLogFile(),
        targetType: 'pr',
        targetNumber: global.createdPR.number,
        owner: global.owner || owner,
        repo: global.repo || repo,
        $,
        log,
        sanitizeLogContent,
        verbose: argv.verbose,
        errorMessage: cleanErrorMessage(error)
      });
      if (logUploadSuccess) {
        await log('📎 Failure log attached to Pull Request');
      }
    } catch (attachError) {
      reportError(attachError, {
        context: 'attach_failure_log',
        prNumber: global.createdPR?.number,
        errorType,
        operation: 'attach_log_to_pr'
      });
      await log(`⚠️  Could not attach failure log: ${attachError.message}`, { level: 'warning' });
    }
  }

  // If --auto-close-pull-request-on-fail is enabled, close the PR
  if (argv.autoClosePullRequestOnFail && global.createdPR && global.createdPR.number) {
    await log('\n🔒 Auto-closing pull request due to failure...');
    try {
      const closeMessage = errorType === 'uncaughtException'
        ? 'Auto-closed due to uncaught exception. Logs have been attached for debugging.'
        : errorType === 'unhandledRejection'
        ? 'Auto-closed due to unhandled rejection. Logs have been attached for debugging.'
        : 'Auto-closed due to execution failure. Logs have been attached for debugging.';

      const result = await $`gh pr close ${global.createdPR.number} --repo ${global.owner || owner}/${global.repo || repo} --comment ${closeMessage}`;
      if (result.exitCode === 0) {
        await log('✅ Pull request closed successfully');
      }
    } catch (closeError) {
      reportError(closeError, {
        context: 'close_pr_on_failure',
        prNumber: global.createdPR?.number,
        owner,
        repo,
        operation: 'close_pull_request'
      });
      await log(`⚠️  Could not close pull request: ${closeError.message}`, { level: 'warning' });
    }
  }
};

/**
 * Создает обработчик неперехваченных исключений
 * Используется для глобальной обработки uncaughtException событий
 */
export const createUncaughtExceptionHandler = (options) => {
  const {
    log,
    cleanErrorMessage,
    absoluteLogPath,
    shouldAttachLogs,
    argv,
    global,
    owner,
    repo,
    getLogFile,
    attachLogToGitHub,
    sanitizeLogContent,
    $
  } = options;

  return async (error) => {
    await log(`\n❌ Uncaught Exception: ${cleanErrorMessage(error)}`, { level: 'error' });
    await log(`   📁 Full log file: ${absoluteLogPath}`, { level: 'error' });

    await handleFailure({
      error,
      errorType: 'uncaughtException',
      shouldAttachLogs,
      argv,
      global,
      owner,
      repo,
      log,
      getLogFile,
      attachLogToGitHub,
      cleanErrorMessage,
      sanitizeLogContent,
      $
    });

    await safeExit(1, 'Error occurred');
  };
};

/**
 * Creates an unhandled rejection handler
 */
export const createUnhandledRejectionHandler = (options) => {
  const {
    log,
    cleanErrorMessage,
    absoluteLogPath,
    shouldAttachLogs,
    argv,
    global,
    owner,
    repo,
    getLogFile,
    attachLogToGitHub,
    sanitizeLogContent,
    $
  } = options;

  return async (reason) => {
    await log(`\n❌ Unhandled Rejection: ${cleanErrorMessage(reason)}`, { level: 'error' });
    await log(`   📁 Full log file: ${absoluteLogPath}`, { level: 'error' });

    await handleFailure({
      error: reason,
      errorType: 'unhandledRejection',
      shouldAttachLogs,
      argv,
      global,
      owner,
      repo,
      log,
      getLogFile,
      attachLogToGitHub,
      cleanErrorMessage,
      sanitizeLogContent,
      $
    });

    await safeExit(1, 'Error occurred');
  };
};

/**
 * Handles execution errors in the main catch block
 */
export const handleMainExecutionError = async (options) => {
  const {
    error,
    log,
    cleanErrorMessage,
    absoluteLogPath,
    shouldAttachLogs,
    argv,
    global,
    owner,
    repo,
    getLogFile,
    attachLogToGitHub,
    sanitizeLogContent,
    $
  } = options;

  // Special handling for authentication errors
  if (error.isAuthError) {
    await log('\n❌ AUTHENTICATION ERROR', { level: 'error' });
    await log('', { level: 'error' });
    await log('   The AI tool authentication has failed.', { level: 'error' });
    await log('   This error cannot be resolved by retrying.', { level: 'error' });
    await log('', { level: 'error' });
    await log(`   Error: ${cleanErrorMessage(error)}`, { level: 'error' });
    await log('', { level: 'error' });
    await log(`   📁 Full log file: ${absoluteLogPath}`, { level: 'error' });

    // Don't try to attach logs or create issues for auth errors
    await safeExit(1, 'Authentication error');
    return;
  }

  await log('Error executing command:', cleanErrorMessage(error));
  await log(`Stack trace: ${error.stack}`, { verbose: true });
  await log(`   📁 Full log file: ${absoluteLogPath}`, { level: 'error' });

  await handleFailure({
    error,
    errorType: 'execution',
    shouldAttachLogs,
    argv,
    global,
    owner,
    repo,
    log,
    getLogFile,
    attachLogToGitHub,
    cleanErrorMessage,
    sanitizeLogContent,
    $
  });

  await safeExit(1, 'Error occurred');
};