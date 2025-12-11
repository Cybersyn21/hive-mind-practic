#!/usr/bin/env node
// GitHub batch operations using GraphQL
// Батчевые операции GitHub с использованием GraphQL

// Check if use is already defined (when imported from solve.mjs)
// If not, fetch it (when running standalone)
// Проверяем, определен ли use (когда импортируется из solve.mjs)
// Если нет, загружаем его (при автономном запуске)
if (typeof globalThis.use === 'undefined') {
  globalThis.use = (await eval(await (await fetch('https://unpkg.com/use-m/use.js')).text())).use;
}

// Import dependencies
// Импортируем зависимости
import { log, cleanErrorMessage } from './lib.mjs';
import { githubLimits, timeouts } from './config.lib.mjs';

/**
 * Batch fetch pull request information for multiple issues using GraphQL
 * Батчевая загрузка информации о pull request для нескольких issues с использованием GraphQL
 *
 * @param {string} owner - Repository owner / Владелец репозитория
 * @param {string} repo - Repository name / Имя репозитория
 * @param {Array<number>} issueNumbers - Array of issue numbers to check / Массив номеров issues для проверки
 * @returns {Promise<Object>} Object mapping issue numbers to their linked PRs / Объект, сопоставляющий номера issues с их связанными PR
 */
export async function batchCheckPullRequestsForIssues(owner, repo, issueNumbers) {
  try {
    if (!issueNumbers || issueNumbers.length === 0) {
      return {};
    }

    await log(`   🔍 Batch checking PRs for ${issueNumbers.length} issues using GraphQL...`, { verbose: true });

    // GraphQL has complexity limits, so batch in groups of 50
    // GraphQL имеет ограничения по сложности запросов, поэтому группируем по 50
    const BATCH_SIZE = 50;
    const results = {};

    // Обрабатываем issues партиями для соблюдения лимитов API
    for (let i = 0; i < issueNumbers.length; i += BATCH_SIZE) {
      const batch = issueNumbers.slice(i, i + BATCH_SIZE);

      // Build GraphQL query for this batch
      // Строим GraphQL запрос для этой партии
      const query = `
        query GetPullRequestsForIssues {
          repository(owner: "${owner}", name: "${repo}") {
            ${batch.map(num => `
            issue${num}: issue(number: ${num}) {
              number
              title
              state
              timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
                nodes {
                  ... on CrossReferencedEvent {
                    source {
                      ... on PullRequest {
                        number
                        title
                        state
                        isDraft
                        url
                      }
                    }
                  }
                }
              }
            }`).join('\n')}
          }
        }
      `;

      try {
        // Add small delay between batches to respect rate limits
        // Добавляем небольшую задержку между партиями для соблюдения rate limits
        if (i > 0) {
          await log('   ⏰ Waiting 2 seconds before next batch...', { verbose: true });
          await new Promise(resolve => setTimeout(resolve, timeouts.githubRepoDelay));
        }

        // Execute GraphQL query
        // Выполняем GraphQL запрос через GitHub CLI
        const { execSync } = await import('child_process');
        const result = execSync(`gh api graphql -f query='${query}'`, {
          encoding: 'utf8',
          maxBuffer: githubLimits.bufferMaxSize
        });

        const data = JSON.parse(result);

        // Process results for this batch
        // Обрабатываем результаты для этой партии
        for (const issueNum of batch) {
          const issueData = data.data?.repository?.[`issue${issueNum}`];
          if (issueData) {
            const linkedPRs = [];

            // Extract linked PRs from timeline items
            // Извлекаем связанные PR из элементов timeline
            for (const item of issueData.timelineItems?.nodes || []) {
              if (item?.source && item.source.state === 'OPEN' && !item.source.isDraft) {
                linkedPRs.push({
                  number: item.source.number,
                  title: item.source.title,
                  state: item.source.state,
                  url: item.source.url
                });
              }
            }

            results[issueNum] = {
              title: issueData.title,
              state: issueData.state,
              openPRCount: linkedPRs.length,
              linkedPRs: linkedPRs
            };
          } else {
            // Issue not found or error
            results[issueNum] = {
              openPRCount: 0,
              linkedPRs: [],
              error: 'Issue not found'
            };
          }
        }

        await log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(issueNumbers.length / BATCH_SIZE)} processed (${batch.length} issues)`, { verbose: true });

      } catch (batchError) {
        await log(`   ⚠️  GraphQL batch query failed: ${cleanErrorMessage(batchError)}`, { level: 'warning' });

        // Fall back to individual REST API calls for this batch
        // Откатываемся к индивидуальным REST API вызовам для этой партии
        await log('   🔄 Falling back to REST API for batch...', { verbose: true });

        for (const issueNum of batch) {
          try {
            const { execSync } = await import('child_process');
            const cmd = `gh api repos/${owner}/${repo}/issues/${issueNum}/timeline --jq '[.[] | select(.event == "cross-referenced" and .source.issue.pull_request != null and .source.issue.state == "open")] | length'`;

            const output = execSync(cmd, { encoding: 'utf8' }).trim();
            const openPrCount = parseInt(output) || 0;

            results[issueNum] = {
              openPRCount: openPrCount,
              linkedPRs: [] // REST API doesn't give us PR details easily
            };
          } catch (restError) {
            results[issueNum] = {
              openPRCount: 0,
              linkedPRs: [],
              error: cleanErrorMessage(restError)
            };
          }
        }
      }
    }

    // Log summary
    const totalIssues = issueNumbers.length;
    const issuesWithPRs = Object.values(results).filter(r => r.openPRCount > 0).length;
    await log(`   📊 Batch PR check complete: ${issuesWithPRs}/${totalIssues} issues have open PRs`, { verbose: true });

    return results;

  } catch (error) {
    await log(`   ❌ Batch PR check failed: ${cleanErrorMessage(error)}`, { level: 'error' });
    return {};
  }
}

/**
 * Batch check if repositories are archived using GraphQL
 * This is more efficient than checking each repository individually
 * Батчевая проверка, являются ли репозитории архивированными, используя GraphQL
 * Это более эффективно, чем проверка каждого репозитория по отдельности
 *
 * @param {Array<{owner: string, name: string}>} repositories - Array of repository objects with owner and name / Массив объектов репозиториев с owner и name
 * @returns {Promise<Object>} Object mapping "owner/repo" to isArchived boolean / Объект, сопоставляющий "owner/repo" с boolean значением isArchived
 */
export async function batchCheckArchivedRepositories(repositories) {
  try {
    if (!repositories || repositories.length === 0) {
      return {};
    }

    await log(`   🔍 Batch checking archived status for ${repositories.length} repositories...`, { verbose: true });

    // GraphQL has complexity limits, so batch in groups of 50
    // GraphQL имеет ограничения по сложности, поэтому группируем по 50
    const BATCH_SIZE = 50;
    const results = {};

    // Обрабатываем репозитории партиями
    for (let i = 0; i < repositories.length; i += BATCH_SIZE) {
      const batch = repositories.slice(i, i + BATCH_SIZE);

      // Build GraphQL query for this batch
      // Строим GraphQL запрос для этой партии
      const queryFields = batch.map((repo, index) => `
        repo${index}: repository(owner: "${repo.owner}", name: "${repo.name}") {
          nameWithOwner
          isArchived
        }`).join('\n');

      const query = `
        query CheckArchivedStatus {
          ${queryFields}
        }
      `;

      try {
        // Add small delay between batches to respect rate limits
        // Добавляем задержку между партиями для соблюдения rate limits
        if (i > 0) {
          await log('   ⏰ Waiting 2 seconds before next batch...', { verbose: true });
          await new Promise(resolve => setTimeout(resolve, timeouts.githubRepoDelay));
        }

        // Execute GraphQL query
        // Выполняем GraphQL запрос
        const { execSync } = await import('child_process');
        const result = execSync(`gh api graphql -f query='${query}'`, {
          encoding: 'utf8',
          maxBuffer: githubLimits.bufferMaxSize
        });

        const data = JSON.parse(result);

        // Process results for this batch
        // Обрабатываем результаты для этой партии
        batch.forEach((repo, index) => {
          const repoData = data.data?.[`repo${index}`];
          if (repoData) {
            const repoKey = `${repo.owner}/${repo.name}`;
            results[repoKey] = repoData.isArchived;
          }
        });

        await log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(repositories.length / BATCH_SIZE)} processed (${batch.length} repositories)`, { verbose: true });

      } catch (batchError) {
        await log(`   ⚠️  GraphQL batch query failed: ${cleanErrorMessage(batchError)}`, { level: 'warning' });

        // Fall back to individual REST API calls for this batch
        // Откатываемся к индивидуальным REST API вызовам
        await log('   🔄 Falling back to REST API for batch...', { verbose: true });

        for (const repo of batch) {
          try {
            const { execSync } = await import('child_process');
            const cmd = `gh api repos/${repo.owner}/${repo.name} --jq .archived`;

            const output = execSync(cmd, { encoding: 'utf8' }).trim();
            const isArchived = output === 'true';

            const repoKey = `${repo.owner}/${repo.name}`;
            results[repoKey] = isArchived;
          } catch {
            // If we can't check, assume it's not archived (safer to include than exclude)
            // Если не можем проверить, предполагаем что не архивирован (безопаснее включить чем исключить)
            const repoKey = `${repo.owner}/${repo.name}`;
            results[repoKey] = false;
            await log(`   ⚠️  Could not check ${repoKey}, assuming not archived`, { verbose: true });
          }
        }
      }
    }

    // Log summary
    // Логируем итоги
    const archivedCount = Object.values(results).filter(isArchived => isArchived).length;
    await log(`   📊 Batch archived check complete: ${archivedCount}/${repositories.length} repositories are archived`, { verbose: true });

    return results;

  } catch (error) {
    await log(`   ❌ Batch archived check failed: ${cleanErrorMessage(error)}`, { level: 'error' });
    return {};
  }
}

// Export all functions as default object too
// Экспортируем все функции также как default объект
export default {
  batchCheckPullRequestsForIssues,
  batchCheckArchivedRepositories
};
