// Команды CLI для управления агентами (создание и список)
// Предоставляет интерактивный интерфейс для создания новых агентов и просмотра доступных агентов

import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Global } from "../../global"
import { Agent } from "../../agent/agent"
import path from "path"
import matter from "gray-matter"
import { Instance } from "../../project/instance"
import { EOL } from "os"

// Команда "agent create" - создаёт новый агент через интерактивный диалог
const AgentCreateCommand = cmd({
  command: "create",
  describe: "create a new agent",
  async handler() {
    // Создание экземпляра проекта с текущей директорией
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Create agent")
        const project = Instance.project

        // Выбор области для сохранения агента: локально в проект или глобально в конфигурацию пользователя
        let scope: "global" | "project" = "global"
        if (project.vcs === "git") {
          const scopeResult = await prompts.select({
            message: "Location",
            options: [
              {
                label: "Current project",
                value: "project" as const,
                hint: Instance.worktree,
              },
              {
                label: "Global",
                value: "global" as const,
                hint: Global.Path.config,
              },
            ],
          })
          if (prompts.isCancel(scopeResult)) throw new UI.CancelledError()
          scope = scopeResult
        }

        // Получение описания агента от пользователя (что должен делать агент)
        const query = await prompts.text({
          message: "Description",
          placeholder: "What should this agent do?",
          validate: (x) => (x && x.length > 0 ? undefined : "Required"),
        })
        if (prompts.isCancel(query)) throw new UI.CancelledError()

        // Генерация конфигурации агента с помощью LLM на основе описания
        const spinner = prompts.spinner()

        spinner.start("Generating agent configuration...")
        const generated = await Agent.generate({ description: query }).catch((error) => {
          spinner.stop(`LLM failed to generate agent: ${error.message}`, 1)
          throw new UI.CancelledError()
        })
        spinner.stop(`Agent ${generated.identifier} generated`)

        // Список всех доступных инструментов, которые можно включить для агента
        const availableTools = [
          "bash",
          "read",
          "write",
          "edit",
          "list",
          "glob",
          "grep",
          "webfetch",
          "task",
          "todowrite",
          "todoread",
        ]

        // Выбор инструментов для агента из всех доступных (по умолчанию выбраны все)
        const selectedTools = await prompts.multiselect({
          message: "Select tools to enable",
          options: availableTools.map((tool) => ({
            label: tool,
            value: tool,
          })),
          initialValues: availableTools,
        })
        if (prompts.isCancel(selectedTools)) throw new UI.CancelledError()

        // Выбор режима работы агента:
        // - "all" - может работать и как основной, и как субагент
        // - "primary" - только основной агент
        // - "subagent" - только может быть вспомогательным агентом
        const modeResult = await prompts.select({
          message: "Agent mode",
          options: [
            {
              label: "All",
              value: "all" as const,
              hint: "Can function in both primary and subagent roles",
            },
            {
              label: "Primary",
              value: "primary" as const,
              hint: "Acts as a primary/main agent",
            },
            {
              label: "Subagent",
              value: "subagent" as const,
              hint: "Can be used as a subagent by other agents",
            },
          ],
          initialValue: "all",
        })
        if (prompts.isCancel(modeResult)) throw new UI.CancelledError()

        // Создание объекта с отключёнными инструментами (те, которые не выбраны пользователем)
        const tools: Record<string, boolean> = {}
        for (const tool of availableTools) {
          if (!selectedTools.includes(tool)) {
            tools[tool] = false
          }
        }

        // Формирование YAML фронт-материи (метаданные) для файла markdown агента
        const frontmatter: any = {
          description: generated.whenToUse,
          mode: modeResult,
        }
        // Добавление инструментов в фронтматер только если есть отключённые инструменты
        if (Object.keys(tools).length > 0) {
          frontmatter.tools = tools
        }

        // Создание содержимого markdown файла с YAML фронт-материей и системным промптом
        const content = matter.stringify(generated.systemPrompt, frontmatter)
        // Определение пути сохранения агента: глобально или в проект
        const filePath = path.join(
          scope === "global" ? Global.Path.config : path.join(Instance.worktree, ".opencode"),
          `agent`,
          `${generated.identifier}.md`,
        )

        // Сохранение файла агента в файловую систему
        await Bun.write(filePath, content)

        // Вывод сообщения об успешном создании агента
        prompts.log.success(`Agent created: ${filePath}`)
        prompts.outro("Done")
      },
    })
  },
})

// Команда "agent list" - выводит список всех доступных агентов
const AgentListCommand = cmd({
  command: "list",
  describe: "list all available agents",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        // Получение списка всех доступных агентов (встроенные и определённые пользователем)
        const agents = await Agent.list()
        // Сортировка агентов: встроенные первыми, затем по алфавиту
        const sortedAgents = agents.sort((a, b) => {
          if (a.builtIn !== b.builtIn) {
            return a.builtIn ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })

        // Вывод каждого агента с его режимом работы
        for (const agent of sortedAgents) {
          process.stdout.write(`${agent.name} (${agent.mode})${EOL}`)
        }
      },
    })
  },
})

// Главная команда "agent" - точка входа для всех подкоманд управления агентами
export const AgentCommand = cmd({
  command: "agent",
  describe: "manage agents",
  // Регистрация подкоманд "create" и "list", требование выбрать одну из них
  builder: (yargs) => yargs.command(AgentCreateCommand).command(AgentListCommand).demandCommand(),
  async handler() {},
})
