#!/usr/bin/env node
// Библиотека функций для работы с Agent (@link-assistant/agent)
// Agent - это инструмент CLI для взаимодействия с AI моделями через OpenCode API

// Проверяем, определён ли use в глобальной области (когда импортируется из solve.mjs)
// Если нет, загружаем его (для автономного запуска)
if (typeof globalThis.use === 'undefined') {
  globalThis.use = (await eval(await (await fetch('https://unpkg.com/use-m/use.js')).text())).use;
}

const { $ } = await use('command-stream');
const fs = (await use('fs')).promises;
const path = (await use('path')).default;
const os = (await use('os')).default;

// Импортируем функцию логирования из общей библиотеки
import { log } from './lib.mjs';
import { reportError } from './sentry.lib.mjs';
import { timeouts } from './config.lib.mjs';
import { detectUsageLimit, formatUsageLimitMessage } from './usage-limit.lib.mjs';

// Импортируем функции расчета стоимости из claude.lib.mjs
// Переиспользуем fetchModelInfo для получения данных о ценах из API models.dev
const claudeLib = await import('./claude.lib.mjs');
const { fetchModelInfo } = claudeLib;

/**
 * Парсинг JSON-вывода agent для извлечения информации об использовании токенов из событий step_finish
 * Agent выводит NDJSON (newline-delimited JSON) с событиями step_finish, содержащими данные о токенах
 * @param {string} output - Сырой вывод stdout из команды agent
 * @returns {Object} Агрегированные данные об использовании токенов и стоимости
 */
export const parseAgentTokenUsage = (output) => {
  const usage = {
    inputTokens: 0,       // Входные токены (промпт)
    outputTokens: 0,      // Выходные токены (ответ AI)
    reasoningTokens: 0,   // Токены рассуждений (для моделей с расширенным мышлением)
    cacheReadTokens: 0,   // Токены, прочитанные из кэша
    cacheWriteTokens: 0,  // Токены, записанные в кэш
    totalCost: 0,         // Общая стоимость
    stepCount: 0          // Количество шагов выполнения
  };

  // Пытаемся распарсить каждую строку как JSON (agent выводит формат NDJSON)
  const lines = output.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || !trimmedLine.startsWith('{')) continue;

    try {
      const parsed = JSON.parse(trimmedLine);

      // Ищем события step_finish, которые содержат информацию об использовании токенов
      if (parsed.type === 'step_finish' && parsed.part?.tokens) {
        const tokens = parsed.part.tokens;
        usage.stepCount++;

        // Суммируем количество токенов
        if (tokens.input) usage.inputTokens += tokens.input;
        if (tokens.output) usage.outputTokens += tokens.output;
        if (tokens.reasoning) usage.reasoningTokens += tokens.reasoning;

        // Обрабатываем токены кэша (могут быть в разных форматах)
        if (tokens.cache) {
          if (tokens.cache.read) usage.cacheReadTokens += tokens.cache.read;
          if (tokens.cache.write) usage.cacheWriteTokens += tokens.cache.write;
        }

        // Добавляем стоимость из step_finish (обычно 0 для бесплатных моделей вроде grok-code)
        if (parsed.part.cost !== undefined) {
          usage.totalCost += parsed.part.cost;
        }
      }
    } catch {
      // Пропускаем строки, которые не являются валидным JSON
      continue;
    }
  }

  return usage;
};

/**
 * Расчет стоимости использования инструмента agent с помощью API models.dev
 * @param {string} modelId - ID модели (например, 'opencode/grok-code')
 * @param {Object} tokenUsage - Данные об использовании токенов из parseAgentTokenUsage
 * @returns {Object} Информация о ценообразовании
 */
export const calculateAgentPricing = async (modelId, tokenUsage) => {
  // Извлекаем имя модели из формата провайдер/модель
  // например, 'opencode/grok-code' -> 'grok-code'
  const modelName = modelId.includes('/') ? modelId.split('/').pop() : modelId;

  try {
    // Получаем информацию о модели из API models.dev
    const modelInfo = await fetchModelInfo(modelName);

    if (modelInfo && modelInfo.cost) {
      const cost = modelInfo.cost;

      // Рассчитываем стоимость на основе использования токенов
      // Цены указаны за 1 миллион токенов, поэтому делим на 1,000,000
      const inputCost = (tokenUsage.inputTokens * (cost.input || 0)) / 1_000_000;
      const outputCost = (tokenUsage.outputTokens * (cost.output || 0)) / 1_000_000;
      const cacheReadCost = (tokenUsage.cacheReadTokens * (cost.cache_read || 0)) / 1_000_000;
      const cacheWriteCost = (tokenUsage.cacheWriteTokens * (cost.cache_write || 0)) / 1_000_000;

      const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;

      return {
        modelId,
        modelName: modelInfo.name || modelName,
        provider: modelInfo.provider || 'OpenCode Zen',
        pricing: {
          inputPerMillion: cost.input || 0,
          outputPerMillion: cost.output || 0,
          cacheReadPerMillion: cost.cache_read || 0,
          cacheWritePerMillion: cost.cache_write || 0
        },
        tokenUsage,
        breakdown: {
          input: inputCost,
          output: outputCost,
          cacheRead: cacheReadCost,
          cacheWrite: cacheWriteCost
        },
        totalCostUSD: totalCost,
        isFreeModel: cost.input === 0 && cost.output === 0
      };
    }

    // Model not found in API, return what we have
    return {
      modelId,
      modelName,
      provider: 'Unknown',
      tokenUsage,
      totalCostUSD: null,
      error: 'Model not found in models.dev API'
    };
  } catch (error) {
    // Error fetching pricing, return with error info
    return {
      modelId,
      modelName,
      tokenUsage,
      totalCostUSD: null,
      error: error.message
    };
  }
};

// Маппинг моделей для преобразования псевдонимов в полные ID моделей для Agent
// Agent использует JSON-интерфейс и модели OpenCode
export const mapModelToId = (model) => {
  const modelMap = {
    'grok': 'opencode/grok-code',
    'grok-code': 'opencode/grok-code',
    'grok-code-fast-1': 'opencode/grok-code',
    'big-pickle': 'opencode/big-pickle',
    'gpt-5-nano': 'openai/gpt-5-nano',
    'sonnet': 'anthropic/claude-3-5-sonnet',
    'haiku': 'anthropic/claude-3-5-haiku',
    'opus': 'anthropic/claude-3-opus',
    'gemini-3-pro': 'google/gemini-3-pro',
  };

  // Возвращаем маппированный ID модели, если это псевдоним, иначе возвращаем как есть
  return modelMap[model] || model;
};

// Функция для валидации подключения к Agent
export const validateAgentConnection = async (model = 'grok-code-fast-1') => {
  // Маппим псевдоним модели в полный ID
  const mappedModel = mapModelToId(model);

  // Конфигурация повторных попыток
  const maxRetries = 3;
  let retryCount = 0;

  const attemptValidation = async () => {
    try {
      if (retryCount === 0) {
        await log('🔍 Validating Agent connection...');
      } else {
        await log(`🔄 Retry attempt ${retryCount}/${maxRetries} for Agent validation...`);
      }

      // Check if Agent CLI is installed and get version
      try {
        const versionResult = await $`timeout ${Math.floor(timeouts.opencodeCli / 1000)} agent --version`;
        if (versionResult.code === 0) {
          const version = versionResult.stdout?.toString().trim();
          if (retryCount === 0) {
            await log(`📦 Agent CLI version: ${version}`);
          }
        }
      } catch (versionError) {
        if (retryCount === 0) {
          await log(`⚠️  Agent CLI version check failed (${versionError.code}), proceeding with connection test...`);
        }
      }

      // Test basic Agent functionality with a simple "hi" message
      // Agent uses the same JSON interface as OpenCode
      const testResult = await $`printf "hi" | timeout ${Math.floor(timeouts.opencodeCli / 1000)} agent --model ${mappedModel}`;

      if (testResult.code !== 0) {
        const stderr = testResult.stderr?.toString() || '';

        if (stderr.includes('auth') || stderr.includes('login')) {
          await log('❌ Agent authentication failed', { level: 'error' });
          await log('   💡 Note: Agent uses OpenCode models. For premium models, you may need: opencode auth', { level: 'error' });
          return false;
        }

        await log(`❌ Agent validation failed with exit code ${testResult.code}`, { level: 'error' });
        if (stderr) await log(`   Error: ${stderr.trim()}`, { level: 'error' });
        return false;
      }

      // Success
      await log('✅ Agent connection validated successfully');
      return true;
    } catch (error) {
      await log(`❌ Failed to validate Agent connection: ${error.message}`, { level: 'error' });
      await log('   💡 Make sure @link-assistant/agent is installed globally: bun install -g @link-assistant/agent', { level: 'error' });
      return false;
    }
  };

  // Start the validation
  return await attemptValidation();
};

// Function to handle Agent runtime switching (if applicable)
export const handleAgentRuntimeSwitch = async () => {
  // Agent is run via Bun as a CLI tool, runtime switching may not be applicable
  // This function can be used for any runtime-specific configurations if needed
  await log('ℹ️  Agent runtime handling not required for this operation');
};

// Main function to execute Agent with prompts and settings
export const executeAgent = async (params) => {
  const {
    issueUrl,
    issueNumber,
    prNumber,
    prUrl,
    branchName,
    tempDir,
    isContinueMode,
    mergeStateStatus,
    forkedRepo,
    feedbackLines,
    forkActionsUrl,
    owner,
    repo,
    argv,
    log,
    formatAligned,
    getResourceSnapshot,
    agentPath = 'agent',
    $
  } = params;

  // Import prompt building functions from agent.prompts.lib.mjs
  const { buildUserPrompt, buildSystemPrompt } = await import('./agent.prompts.lib.mjs');

  // Build the user prompt
  const prompt = buildUserPrompt({
    issueUrl,
    issueNumber,
    prNumber,
    prUrl,
    branchName,
    tempDir,
    isContinueMode,
    mergeStateStatus,
    forkedRepo,
    feedbackLines,
    forkActionsUrl,
    owner,
    repo,
    argv
  });

  // Build the system prompt
  const systemPrompt = buildSystemPrompt({
    owner,
    repo,
    issueNumber,
    prNumber,
    branchName,
    tempDir,
    isContinueMode,
    forkedRepo,
    argv
  });

  // Log prompt details in verbose mode
  if (argv.verbose) {
    await log('\n📝 Final prompt structure:', { verbose: true });
    await log(`   Characters: ${prompt.length}`, { verbose: true });
    await log(`   System prompt characters: ${systemPrompt.length}`, { verbose: true });
    if (feedbackLines && feedbackLines.length > 0) {
      await log('   Feedback info: Included', { verbose: true });
    }

    if (argv.dryRun) {
      await log('\n📋 User prompt content:', { verbose: true });
      await log('---BEGIN USER PROMPT---', { verbose: true });
      await log(prompt, { verbose: true });
      await log('---END USER PROMPT---', { verbose: true });
      await log('\n📋 System prompt content:', { verbose: true });
      await log('---BEGIN SYSTEM PROMPT---', { verbose: true });
      await log(systemPrompt, { verbose: true });
      await log('---END SYSTEM PROMPT---', { verbose: true });
    }
  }

  // Execute the Agent command
  return await executeAgentCommand({
    tempDir,
    branchName,
    prompt,
    systemPrompt,
    argv,
    log,
    formatAligned,
    getResourceSnapshot,
    forkedRepo,
    feedbackLines,
    agentPath,
    $
  });
};

export const executeAgentCommand = async (params) => {
  const {
    tempDir,
    branchName,
    prompt,
    systemPrompt,
    argv,
    log,
    formatAligned,
    getResourceSnapshot,
    forkedRepo,
    feedbackLines,
    agentPath,
    $
  } = params;

  // Retry configuration
  const maxRetries = 3;
  let retryCount = 0;

  const executeWithRetry = async () => {
    // Execute agent command from the cloned repository directory
    if (retryCount === 0) {
      await log(`\n${formatAligned('🤖', 'Executing Agent:', argv.model.toUpperCase())}`);
    } else {
      await log(`\n${formatAligned('🔄', 'Retry attempt:', `${retryCount}/${maxRetries}`)}`);
    }

    if (argv.verbose) {
      await log(`   Model: ${argv.model}`, { verbose: true });
      await log(`   Working directory: ${tempDir}`, { verbose: true });
      await log(`   Branch: ${branchName}`, { verbose: true });
      await log(`   Prompt length: ${prompt.length} chars`, { verbose: true });
      await log(`   System prompt length: ${systemPrompt.length} chars`, { verbose: true });
      if (feedbackLines && feedbackLines.length > 0) {
        await log(`   Feedback info included: Yes (${feedbackLines.length} lines)`, { verbose: true });
      } else {
        await log('   Feedback info included: No', { verbose: true });
      }
    }

    // Take resource snapshot before execution
    const resourcesBefore = await getResourceSnapshot();
    await log('📈 System resources before execution:', { verbose: true });
    await log(`   Memory: ${resourcesBefore.memory.split('\n')[1]}`, { verbose: true });
    await log(`   Load: ${resourcesBefore.load}`, { verbose: true });

    // Build Agent command
    let execCommand;

    // Map model alias to full ID
    const mappedModel = mapModelToId(argv.model);

    // Build agent command arguments
    let agentArgs = `--model ${mappedModel}`;

    // Agent supports stdin in both plain text and JSON format
    // We'll combine system and user prompts into a single message
    const combinedPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    // Write the combined prompt to a file for piping
    // Use OS temporary directory instead of repository workspace to avoid polluting the repo
    const promptFile = path.join(os.tmpdir(), `agent_prompt_${Date.now()}_${process.pid}.txt`);
    await fs.writeFile(promptFile, combinedPrompt);

    // Build the full command - pipe the prompt file to agent
    const fullCommand = `(cd "${tempDir}" && cat "${promptFile}" | ${agentPath} ${agentArgs})`;

    await log(`\n${formatAligned('📝', 'Raw command:', '')}`);
    await log(`${fullCommand}`);
    await log('');

    try {
      // Pipe the prompt file to agent via stdin
      execCommand = $({
        cwd: tempDir,
        mirror: false
      })`cat ${promptFile} | ${agentPath} --model ${mappedModel}`;

      await log(`${formatAligned('📋', 'Command details:', '')}`);
      await log(formatAligned('📂', 'Working directory:', tempDir, 2));
      await log(formatAligned('🌿', 'Branch:', branchName, 2));
      await log(formatAligned('🤖', 'Model:', `Agent ${argv.model.toUpperCase()}`, 2));
      if (argv.fork && forkedRepo) {
        await log(formatAligned('🍴', 'Fork:', forkedRepo, 2));
      }

      await log(`\n${formatAligned('▶️', 'Streaming output:', '')}\n`);

      let exitCode = 0;
      let sessionId = null;
      let limitReached = false;
      let limitResetTime = null;
      let lastMessage = '';
      let fullOutput = ''; // Collect all output for pricing calculation and error detection

      for await (const chunk of execCommand.stream()) {
        if (chunk.type === 'stdout') {
          const output = chunk.data.toString();
          await log(output);
          lastMessage = output;
          fullOutput += output; // Collect for both pricing calculation and error detection
        }

        if (chunk.type === 'stderr') {
          const errorOutput = chunk.data.toString();
          if (errorOutput) {
            await log(errorOutput, { stream: 'stderr' });
          }
        } else if (chunk.type === 'exit') {
          exitCode = chunk.code;
        }
      }

      // Simplified error detection for agent tool
      // Issue #886: Trust exit code - agent now properly returns code 1 on errors with JSON error response
      // Don't scan output for error patterns as this causes false positives during normal operation
      // (e.g., AI executing bash commands that produce "Permission denied" warnings but succeed)
      //
      // Error detection is now based on:
      // 1. Non-zero exit code (agent returns 1 on errors)
      // 2. Explicit JSON error messages from agent (type: "error")
      // 3. Usage limit detection (handled separately)
      const detectAgentErrors = (stdoutOutput) => {
        const lines = stdoutOutput.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const msg = JSON.parse(line);

            // Check for explicit error message types from agent
            if (msg.type === 'error' || msg.type === 'step_error') {
              return { detected: true, type: 'AgentError', match: msg.message || line.substring(0, 100) };
            }
          } catch {
            // Not JSON - ignore for error detection
            continue;
          }
        }

        return { detected: false };
      };

      // Only check for JSON error messages, not pattern matching in output
      const outputError = detectAgentErrors(fullOutput);

      if (exitCode !== 0 || outputError.detected) {
        // Build JSON error structure for consistent error reporting
        const errorInfo = {
          type: 'error',
          exitCode,
          errorDetectedInOutput: outputError.detected,
          errorType: outputError.detected ? outputError.type : (exitCode !== 0 ? 'NonZeroExitCode' : null),
          errorMatch: outputError.detected ? outputError.match : null,
          message: null,
          sessionId,
          limitReached: false,
          limitResetTime: null
        };

        // Check for usage limit errors first (more specific)
        const limitInfo = detectUsageLimit(lastMessage);
        if (limitInfo.isUsageLimit) {
          limitReached = true;
          limitResetTime = limitInfo.resetTime;
          errorInfo.limitReached = true;
          errorInfo.limitResetTime = limitResetTime;
          errorInfo.errorType = 'UsageLimit';

          // Format and display user-friendly message
          const messageLines = formatUsageLimitMessage({
            tool: 'Agent',
            resetTime: limitInfo.resetTime,
            sessionId,
            resumeCommand: sessionId ? `${process.argv[0]} ${process.argv[1]} ${argv.url} --resume ${sessionId}` : null
          });

          for (const line of messageLines) {
            await log(line, { level: 'warning' });
          }
        } else if (outputError.detected) {
          // Explicit JSON error message from agent
          errorInfo.message = `Agent reported error: ${outputError.match}`;
          await log(`\n\n❌ ${errorInfo.message}`, { level: 'error' });
        } else {
          errorInfo.message = `Agent command failed with exit code ${exitCode}`;
          await log(`\n\n❌ ${errorInfo.message}`, { level: 'error' });
        }

        // Log error as JSON for structured output (since agent expects JSON input/output)
        await log('\n📋 Error details (JSON):', { level: 'error' });
        await log(JSON.stringify(errorInfo, null, 2), { level: 'error' });

        const resourcesAfter = await getResourceSnapshot();
        await log('\n📈 System resources after execution:', { verbose: true });
        await log(`   Memory: ${resourcesAfter.memory.split('\n')[1]}`, { verbose: true });
        await log(`   Load: ${resourcesAfter.load}`, { verbose: true });

        // Parse token usage even on failure (partial work may have been done)
        const tokenUsage = parseAgentTokenUsage(fullOutput);
        const pricingInfo = await calculateAgentPricing(mappedModel, tokenUsage);

        return {
          success: false,
          sessionId,
          limitReached,
          limitResetTime,
          errorInfo,  // Include structured error information
          tokenUsage,
          pricingInfo,
          publicPricingEstimate: pricingInfo.totalCostUSD
        };
      }

      await log('\n\n✅ Agent command completed');

      // Parse token usage from collected output
      const tokenUsage = parseAgentTokenUsage(fullOutput);
      const pricingInfo = await calculateAgentPricing(mappedModel, tokenUsage);

      // Log pricing information
      if (tokenUsage.stepCount > 0) {
        await log('\n💰 Token Usage Summary:');
        await log(`   📊 ${pricingInfo.modelName || mappedModel}:`);
        await log(`      Input tokens: ${tokenUsage.inputTokens.toLocaleString()}`);
        await log(`      Output tokens: ${tokenUsage.outputTokens.toLocaleString()}`);
        if (tokenUsage.reasoningTokens > 0) {
          await log(`      Reasoning tokens: ${tokenUsage.reasoningTokens.toLocaleString()}`);
        }
        if (tokenUsage.cacheReadTokens > 0 || tokenUsage.cacheWriteTokens > 0) {
          await log(`      Cache read: ${tokenUsage.cacheReadTokens.toLocaleString()}`);
          await log(`      Cache write: ${tokenUsage.cacheWriteTokens.toLocaleString()}`);
        }

        if (pricingInfo.totalCostUSD !== null) {
          if (pricingInfo.isFreeModel) {
            await log('      Cost: $0.00 (Free model)');
          } else {
            await log(`      Cost: $${pricingInfo.totalCostUSD.toFixed(6)}`);
          }
          await log(`      Provider: ${pricingInfo.provider || 'OpenCode Zen'}`);
        } else {
          await log('      Cost: Not available (could not fetch pricing)');
        }
      }

      return {
        success: true,
        sessionId,
        limitReached,
        limitResetTime,
        tokenUsage,
        pricingInfo,
        publicPricingEstimate: pricingInfo.totalCostUSD
      };
    } catch (error) {
      reportError(error, {
        context: 'execute_agent',
        command: params.command,
        agentPath: params.agentPath,
        operation: 'run_agent_command'
      });

      await log(`\n\n❌ Error executing Agent command: ${error.message}`, { level: 'error' });
      return {
        success: false,
        sessionId: null,
        limitReached: false,
        limitResetTime: null,
        tokenUsage: null,
        pricingInfo: null,
        publicPricingEstimate: null
      };
    }
  };

  // Start the execution with retry logic
  return await executeWithRetry();
};

export const checkForUncommittedChanges = async (tempDir, owner, repo, branchName, $, log, autoCommit = false, autoRestartEnabled = true) => {
  // Similar to OpenCode version, check for uncommitted changes
  await log('\n🔍 Checking for uncommitted changes...');
  try {
    const gitStatusResult = await $({ cwd: tempDir })`git status --porcelain 2>&1`;

    if (gitStatusResult.code === 0) {
      const statusOutput = gitStatusResult.stdout.toString().trim();

      if (statusOutput) {
        await log('📝 Found uncommitted changes');
        await log('Changes:');
        for (const line of statusOutput.split('\n')) {
          await log(`   ${line}`);
        }

        if (autoCommit) {
          await log('💾 Auto-committing changes (--auto-commit-uncommitted-changes is enabled)...');

          const addResult = await $({ cwd: tempDir })`git add -A`;
          if (addResult.code === 0) {
            const commitMessage = 'Auto-commit: Changes made by Agent during problem-solving session';
            const commitResult = await $({ cwd: tempDir })`git commit -m ${commitMessage}`;

            if (commitResult.code === 0) {
              await log('✅ Changes committed successfully');

              const pushResult = await $({ cwd: tempDir })`git push origin ${branchName}`;

              if (pushResult.code === 0) {
                await log('✅ Changes pushed successfully');
              } else {
                await log(`⚠️ Warning: Could not push changes: ${pushResult.stderr?.toString().trim()}`, { level: 'warning' });
              }
            } else {
              await log(`⚠️ Warning: Could not commit changes: ${commitResult.stderr?.toString().trim()}`, { level: 'warning' });
            }
          } else {
            await log(`⚠️ Warning: Could not stage changes: ${addResult.stderr?.toString().trim()}`, { level: 'warning' });
          }
          return false;
        } else if (autoRestartEnabled) {
          await log('');
          await log('⚠️  IMPORTANT: Uncommitted changes detected!');
          await log('   Agent made changes that were not committed.');
          await log('');
          await log('🔄 AUTO-RESTART: Restarting Agent to handle uncommitted changes...');
          await log('   Agent will review the changes and decide what to commit.');
          await log('');
          return true;
        } else {
          await log('');
          await log('⚠️  Uncommitted changes detected but auto-restart is disabled.');
          await log('   Use --auto-restart-on-uncommitted-changes to enable or commit manually.');
          await log('');
          return false;
        }
      } else {
        await log('✅ No uncommitted changes found');
        return false;
      }
    } else {
      await log(`⚠️ Warning: Could not check git status: ${gitStatusResult.stderr?.toString().trim()}`, { level: 'warning' });
      return false;
    }
  } catch (gitError) {
    reportError(gitError, {
      context: 'check_uncommitted_changes_agent',
      tempDir,
      operation: 'git_status_check'
    });
    await log(`⚠️ Warning: Error checking for uncommitted changes: ${gitError.message}`, { level: 'warning' });
    return false;
  }
};

// Export all functions as default object too
export default {
  validateAgentConnection,
  handleAgentRuntimeSwitch,
  executeAgent,
  executeAgentCommand,
  checkForUncommittedChanges,
  parseAgentTokenUsage,
  calculateAgentPricing
};
