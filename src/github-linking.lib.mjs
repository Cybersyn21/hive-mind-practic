#!/usr/bin/env node

/**
 * GitHub Issue Linking Detection Library
 * Библиотека определения связывания GitHub Issues
 *
 * This module provides utilities to detect GitHub's reserved keywords for linking
 * pull requests to issues according to GitHub's official documentation:
 * https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue
 *
 * Этот модуль предоставляет утилиты для определения зарезервированных ключевых слов GitHub
 * для связывания pull request с issues согласно официальной документации GitHub.
 *
 * Valid linking keywords (case-insensitive) / Допустимые ключевые слова (без учета регистра):
 * - close, closes, closed
 * - fix, fixes, fixed
 * - resolve, resolves, resolved
 *
 * Valid formats / Допустимые форматы:
 * - KEYWORD #ISSUE-NUMBER
 * - KEYWORD OWNER/REPO#ISSUE-NUMBER
 * - KEYWORD https://github.com/OWNER/REPO/issues/ISSUE-NUMBER
 */

/**
 * Get all valid GitHub linking keywords
 * Получение всех допустимых ключевых слов связывания GitHub
 *
 * @returns {string[]} Array of valid linking keywords / Массив допустимых ключевых слов
 */
export function getGitHubLinkingKeywords() {
  return [
    'close', 'closes', 'closed',
    'fix', 'fixes', 'fixed',
    'resolve', 'resolves', 'resolved'
  ];
}

/**
 * Check if PR body contains a valid GitHub linking keyword for the given issue
 * Проверка, содержит ли тело PR допустимое ключевое слово связывания для данного issue
 *
 * @param {string} prBody - The pull request body text / Текст тела pull request
 * @param {string|number} issueNumber - The issue number to check for / Номер issue для проверки
 * @param {string} [owner] - Repository owner (for cross-repo references) / Владелец репозитория (для кросс-репо ссылок)
 * @param {string} [repo] - Repository name (for cross-repo references) / Имя репозитория (для кросс-репо ссылок)
 * @returns {boolean} True if a valid linking keyword is found / True если найдено допустимое ключевое слово
 */
export function hasGitHubLinkingKeyword(prBody, issueNumber, owner = null, repo = null) {
  if (!prBody || !issueNumber) {
    return false;
  }

  const keywords = getGitHubLinkingKeywords();
  const issueNumStr = issueNumber.toString();

  // Build regex patterns for each valid format:
  // Строим regex паттерны для каждого допустимого формата:
  // 1. KEYWORD #123
  // 2. KEYWORD owner/repo#123
  // 3. KEYWORD https://github.com/owner/repo/issues/123

  for (const keyword of keywords) {
    // Pattern 1: KEYWORD #123
    // Must have word boundary before keyword and # immediately before number
    // Паттерн 1: должна быть граница слова перед ключевым словом и # сразу перед номером
    const pattern1 = new RegExp(
      `\\b${keyword}\\s+#${issueNumStr}\\b`,
      'i'
    );

    if (pattern1.test(prBody)) {
      return true;
    }

    // Pattern 2: KEYWORD owner/repo#123 (for cross-repo or fork references)
    // Паттерн 2: для кросс-репо или fork ссылок
    if (owner && repo) {
      const pattern2 = new RegExp(
        `\\b${keyword}\\s+${owner}/${repo}#${issueNumStr}\\b`,
        'i'
      );

      if (pattern2.test(prBody)) {
        return true;
      }
    }

    // Pattern 3: KEYWORD https://github.com/owner/repo/issues/123
    // Паттерн 3: полный URL формат
    if (owner && repo) {
      const pattern3 = new RegExp(
        `\\b${keyword}\\s+https://github\\.com/${owner}/${repo}/issues/${issueNumStr}\\b`,
        'i'
      );

      if (pattern3.test(prBody)) {
        return true;
      }
    }

    // Pattern 4: Also check for any URL format (generic)
    // Паттерн 4: проверка любого URL формата (общий)
    const pattern4 = new RegExp(
      `\\b${keyword}\\s+https://github\\.com/[^/]+/[^/]+/issues/${issueNumStr}\\b`,
      'i'
    );

    if (pattern4.test(prBody)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract issue number from PR body using GitHub linking keywords
 * This is used to find which issue a PR is linked to
 * Извлечение номера issue из тела PR используя ключевые слова GitHub
 * Используется для определения, с каким issue связан PR
 *
 * @param {string} prBody - The pull request body text / Текст тела pull request
 * @returns {string|null} The issue number if found, null otherwise / Номер issue если найден, иначе null
 */
export function extractLinkedIssueNumber(prBody) {
  if (!prBody) {
    return null;
  }

  const keywords = getGitHubLinkingKeywords();

  for (const keyword of keywords) {
    // Try to match: KEYWORD #123
    // Пытаемся найти: KEYWORD #123
    const pattern1 = new RegExp(
      `\\b${keyword}\\s+#(\\d+)\\b`,
      'i'
    );
    const match1 = prBody.match(pattern1);
    if (match1) {
      return match1[1];
    }

    // Try to match: KEYWORD owner/repo#123
    // Пытаемся найти: KEYWORD owner/repo#123
    const pattern2 = new RegExp(
      `\\b${keyword}\\s+[^/\\s]+/[^/\\s]+#(\\d+)\\b`,
      'i'
    );
    const match2 = prBody.match(pattern2);
    if (match2) {
      return match2[1];
    }

    // Try to match: KEYWORD https://github.com/owner/repo/issues/123
    // Пытаемся найти: KEYWORD https://github.com/owner/repo/issues/123
    const pattern3 = new RegExp(
      `\\b${keyword}\\s+https://github\\.com/[^/]+/[^/]+/issues/(\\d+)\\b`,
      'i'
    );
    const match3 = prBody.match(pattern3);
    if (match3) {
      return match3[1];
    }
  }

  return null;
}
