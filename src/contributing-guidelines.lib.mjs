#!/usr/bin/env node

/**
 * Модуль обнаружения и получения руководств по внесению вклада (Contributing Guidelines)
 * Обрабатывает поиск и загрузку руководств по контрибуции из репозиториев
 * Используется для автоматического включения требований CI/CD в инструкции для AI
 */

if (typeof globalThis.use === 'undefined') {
  globalThis.use = (await eval(await (await fetch('https://unpkg.com/use-m/use.js')).text())).use;
}

const { $ } = await use('command-stream');

/**
 * Распространенные пути где могут находиться руководства по внесению вклада
 * Проверяются в порядке приоритета
 */
const CONTRIBUTING_PATHS = [
  'CONTRIBUTING.md',
  'CONTRIBUTING',
  'docs/CONTRIBUTING.md',
  'docs/contributing.md',
  '.github/CONTRIBUTING.md',
  'CONTRIBUTE.md',
  'docs/contribute.md'
];

/**
 * Распространенные паттерны URL документации
 * Используются для поиска ссылок на документацию в README
 */
const DOCS_PATTERNS = [
  'readthedocs.io',
  'github.io',
  '/docs/',
  '/documentation/'
];

/**
 * Обнаруживает руководства по внесению вклада в репозитории
 * Ищет CONTRIBUTING файлы в стандартных местах и извлекает их содержимое
 * @param {string} owner - Владелец репозитория
 * @param {string} repo - Название репозитория
 * @returns {Promise<Object>} Объект с информацией о руководствах {found: boolean, path: string, url: string, content: string}
 */
export async function detectContributingGuidelines(owner, repo) {
  const result = {
    found: false,
    path: null,
    url: null,
    content: null,
    docsUrl: null
  };

  // Try to find CONTRIBUTING file in the repo
  for (const path of CONTRIBUTING_PATHS) {
    try {
      const checkResult = await $`gh api repos/${owner}/${repo}/contents/${path} 2>/dev/null`.raw().trim();
      if (checkResult.exitCode === 0 && checkResult.text) {
        result.found = true;
        result.path = path;
        result.url = `https://github.com/${owner}/${repo}/blob/main/${path}`;

        // Try to get the content from the response
        try {
          const data = JSON.parse(checkResult.text);
          if (data.content) {
            // Decode base64 content
            result.content = Buffer.from(data.content, 'base64').toString('utf-8');
          }
        } catch {
          // Content parse failed, but we know the file exists
        }

        break;
      }
    } catch {
      // File doesn't exist, try next path
    }
  }

  // Try to find docs URL in README
  if (!result.found) {
    try {
      const readme = await $`gh api repos/${owner}/${repo}/readme 2>/dev/null`.raw().trim();
      if (readme.exitCode === 0 && readme.text) {
        const readmeData = JSON.parse(readme.text);
        const readmeContent = Buffer.from(readmeData.content, 'base64').toString('utf-8');

        // Look for contributing documentation URL
        const contributingMatch = readmeContent.match(/https?:\/\/[^\s)]+contributing[^\s)]*/gi);
        if (contributingMatch && contributingMatch[0]) {
          result.found = true;
          result.docsUrl = contributingMatch[0];
        }

        // Look for general docs URL that might contain contributing info
        if (!result.found) {
          for (const pattern of DOCS_PATTERNS) {
            const docsMatch = readmeContent.match(new RegExp(`https?:\\/\\/[^\\s\\)]*${pattern}[^\\s\\)]*`, 'gi'));
            if (docsMatch && docsMatch[0]) {
              result.found = true;
              result.docsUrl = docsMatch[0];
              // Try to construct a contributing URL from the docs URL
              const baseUrl = docsMatch[0].replace(/\/$/, '');
              result.url = `${baseUrl}/contributing.html`;
              break;
            }
          }
        }
      }
    } catch {
      // README fetch failed
    }
  }

  return result;
}

/**
 * Извлекает требования CI/CD из руководств по внесению вклада
 * Парсит текст руководства для поиска упоминаний линтеров, тестов и стилей кода
 * @param {string} content - Содержимое руководства по внесению вклада
 * @returns {Object} Извлеченные требования {linters: [], testCommands: [], styleGuide: []}
 */
export function extractCIRequirements(content) {
  const requirements = {
    linters: [],
    testCommands: [],
    styleGuide: [],
    preCommitChecks: []
  };

  if (!content) return requirements;

  const lowerContent = content.toLowerCase();

  // Detect linters
  if (lowerContent.includes('ruff')) {
    requirements.linters.push({ name: 'ruff', command: 'ruff check .' });
  }
  if (lowerContent.includes('eslint')) {
    requirements.linters.push({ name: 'eslint', command: 'npm run lint' });
  }
  if (lowerContent.includes('pylint')) {
    requirements.linters.push({ name: 'pylint', command: 'pylint .' });
  }
  if (lowerContent.includes('flake8')) {
    requirements.linters.push({ name: 'flake8', command: 'flake8 .' });
  }
  if (lowerContent.includes('mypy')) {
    requirements.linters.push({ name: 'mypy', command: 'mypy .' });
  }

  // Detect test commands
  if (lowerContent.includes('pytest')) {
    requirements.testCommands.push({ name: 'pytest', command: 'pytest' });
  }
  if (lowerContent.includes('nox')) {
    requirements.testCommands.push({ name: 'nox', command: 'nox' });
  }
  if (lowerContent.includes('npm test')) {
    requirements.testCommands.push({ name: 'npm test', command: 'npm test' });
  }
  if (lowerContent.includes('cargo test')) {
    requirements.testCommands.push({ name: 'cargo test', command: 'cargo test' });
  }

  // Extract line length requirements
  const lineLengthMatch = content.match(/(\d+)\s+character[s]?\s+line\s+limit/i);
  if (lineLengthMatch) {
    requirements.styleGuide.push(`Maximum line length: ${lineLengthMatch[1]} characters`);
  }

  // Extract pre-commit requirements
  if (lowerContent.includes('pre-commit')) {
    requirements.preCommitChecks.push('pre-commit hooks are required');
  }

  return requirements;
}

/**
 * Build contributing guidelines section for CLAUDE.md
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<string>} Formatted contributing guidelines section
 */
export async function buildContributingSection(owner, repo) {
  const guidelines = await detectContributingGuidelines(owner, repo);

  if (!guidelines.found) {
    return '';
  }

  const lines = [];
  lines.push('');
  lines.push('## Contributing Guidelines');

  if (guidelines.url) {
    lines.push(`📋 Contributing Guide: ${guidelines.url}`);
  }

  if (guidelines.docsUrl) {
    lines.push(`📚 Documentation: ${guidelines.docsUrl}`);
  }

  // Extract and display CI requirements
  if (guidelines.content) {
    const requirements = extractCIRequirements(guidelines.content);

    if (requirements.linters.length > 0 || requirements.testCommands.length > 0) {
      lines.push('');
      lines.push('### Required Checks Before Committing:');

      if (requirements.linters.length > 0) {
        lines.push('');
        lines.push('**Linting:**');
        requirements.linters.forEach(linter => {
          lines.push(`- \`${linter.command}\``);
        });
      }

      if (requirements.testCommands.length > 0) {
        lines.push('');
        lines.push('**Testing:**');
        requirements.testCommands.forEach(test => {
          lines.push(`- \`${test.command}\``);
        });
      }

      if (requirements.styleGuide.length > 0) {
        lines.push('');
        lines.push('**Style Guide:**');
        requirements.styleGuide.forEach(rule => {
          lines.push(`- ${rule}`);
        });
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Check for workflow approval requirements in GitHub Actions
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} Workflow status info
 */
export async function checkWorkflowApprovalStatus(owner, repo) {
  try {
    // Get workflow runs for the PR
    const runsResult = await $`gh run list --repo ${owner}/${repo} --json databaseId,status,conclusion,event --limit 5`.trim();

    if (runsResult.exitCode !== 0) {
      return { hasApprovalRequired: false, runs: [] };
    }

    const runs = JSON.parse(runsResult.text);
    const approvalRequiredRuns = runs.filter(run => run.conclusion === 'action_required');

    return {
      hasApprovalRequired: approvalRequiredRuns.length > 0,
      runs: approvalRequiredRuns,
      totalRuns: runs.length
    };
  } catch (err) {
    return { hasApprovalRequired: false, runs: [], error: err.message };
  }
}
