import { Ripgrep } from "../file/ripgrep"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { Config } from "../config/config"

import { Instance } from "../project/instance"
import path from "path"
import os from "os"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_ANTHROPIC_WITHOUT_TODO from "./prompt/qwen.txt"
import PROMPT_POLARIS from "./prompt/polaris.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_ANTHROPIC_SPOOF from "./prompt/anthropic_spoof.txt"
import PROMPT_SUMMARIZE from "./prompt/summarize.txt"
import PROMPT_TITLE from "./prompt/title.txt"
import PROMPT_CODEX from "./prompt/codex.txt"
import PROMPT_GROK_CODE from "./prompt/grok-code.txt"

// Пространство имен для управления системными промптами
// Отвечает за выбор и комбинирование промптов для разных моделей и провайдеров
export namespace SystemPrompt {
  // Возвращает заголовочный промпт в зависимости от провайдера
  // Используется для специфических инструкций для разных провайдеров
  export function header(providerID: string) {
    if (providerID.includes("anthropic")) return [PROMPT_ANTHROPIC_SPOOF.trim()]
    return []
  }

  // Выбирает основной системный промпт в зависимости от модели
  // Разные модели получают разные промпты для оптимальной производительности
  export function provider(modelID: string) {
    if (modelID.includes("gpt-5")) return [PROMPT_CODEX]
    if (modelID.includes("gpt-") || modelID.includes("o1") || modelID.includes("o3")) return [PROMPT_BEAST]
    if (modelID.includes("gemini-")) return [PROMPT_GEMINI]
    if (modelID.includes("claude")) return [PROMPT_ANTHROPIC]
    if (modelID.includes("polaris-alpha")) return [PROMPT_POLARIS]
    if (modelID.includes("grok-code")) return [PROMPT_GROK_CODE]
    return [PROMPT_ANTHROPIC_WITHOUT_TODO]
  }

  // Формирует информацию об окружении: директория, VCS, платформа, дерево файлов
  // Эта информация передается модели для контекста о проекте
  export async function environment() {
    const project = Instance.project
    return [
      [
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${Instance.directory}`,
        `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
        `  Platform: ${process.platform}`,
        `  Today's date: ${new Date().toDateString()}`,
        `</env>`,
        `<files>`,
        `  ${
          project.vcs === "git"
            ? await Ripgrep.tree({
                cwd: Instance.directory,
                limit: 200,
              })
            : ""
        }`,
        `</files>`,
      ].join("\n"),
    ]
  }

  // Имена файлов с локальными инструкциями для поиска в проекте
  const LOCAL_RULE_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    "CONTEXT.md", // deprecated
  ]
  // Пути к глобальным файлам инструкций в домашней директории
  const GLOBAL_RULE_FILES = [
    path.join(Global.Path.config, "AGENTS.md"),
    path.join(os.homedir(), ".claude", "CLAUDE.md"),
  ]

  // Собирает пользовательские инструкции из локальных и глобальных файлов конфигурации
  // Позволяет пользователю задавать специфические инструкции для своих проектов
  export async function custom() {
    const config = await Config.get()
    const paths = new Set<string>()

    // Ищет локальные файлы инструкций в проекте
    for (const localRuleFile of LOCAL_RULE_FILES) {
      const matches = await Filesystem.findUp(localRuleFile, Instance.directory, Instance.worktree)
      if (matches.length > 0) {
        matches.forEach((path) => paths.add(path))
        break
      }
    }

    // Ищет глобальные файлы инструкций в домашней директории
    for (const globalRuleFile of GLOBAL_RULE_FILES) {
      if (await Bun.file(globalRuleFile).exists()) {
        paths.add(globalRuleFile)
        break
      }
    }

    // Обрабатывает дополнительные пути инструкций из конфигурации
    if (config.instructions) {
      for (let instruction of config.instructions) {
        if (instruction.startsWith("~/")) {
          instruction = path.join(os.homedir(), instruction.slice(2))
        }
        let matches: string[] = []
        if (path.isAbsolute(instruction)) {
          matches = await Array.fromAsync(
            new Bun.Glob(path.basename(instruction)).scan({
              cwd: path.dirname(instruction),
              absolute: true,
              onlyFiles: true,
            }),
          ).catch(() => [])
        } else {
          matches = await Filesystem.globUp(instruction, Instance.directory, Instance.worktree).catch(() => [])
        }
        matches.forEach((path) => paths.add(path))
      }
    }

    // Читает содержимое всех найденных файлов инструкций
    const found = Array.from(paths).map((p) =>
      Bun.file(p)
        .text()
        .catch(() => "")
        .then((x) => "Instructions from: " + p + "\n" + x),
    )
    return Promise.all(found).then((result) => result.filter(Boolean))
  }

  // Возвращает системный промпт для суммаризации беседы
  // Используется для сжатия длинных потоков общения в краткий формат
  export function summarize(providerID: string) {
    switch (providerID) {
      case "anthropic":
        return [PROMPT_ANTHROPIC_SPOOF.trim(), PROMPT_SUMMARIZE]
      default:
        return [PROMPT_SUMMARIZE]
    }
  }

  // Возвращает системный промпт для генерации названия сессии
  // Используется для создания краткого описания сессии для интерфейса
  export function title(providerID: string) {
    switch (providerID) {
      case "anthropic":
        return [PROMPT_ANTHROPIC_SPOOF.trim(), PROMPT_TITLE]
      default:
        return [PROMPT_TITLE]
    }
  }
}
