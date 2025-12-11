import z from "zod"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import PROMPT_INITIALIZE from "./template/initialize.txt"
import { Bus } from "../bus"
import { Identifier } from "../id/id"

// Модуль управления командами (предопределенные промпты/задачи)
// Команды позволяют создавать шаблонные промпты для часто используемых задач
export namespace Command {
  // Встроенные дефолтные команды
  export const Default = {
    INIT: "init", // Команда для инициализации AGENTS.md
  } as const

  // События, связанные с командами
  export const Event = {
    // Событие выполнения команды
    Executed: Bus.event(
      "command.executed",
      z.object({
        name: z.string(), // Имя команды
        sessionID: Identifier.schema("session"), // ID сессии
        arguments: z.string(), // Аргументы команды
        messageID: Identifier.schema("message"), // ID сообщения
      }),
    ),
  }

  // Схема информации о команде
  export const Info = z
    .object({
      name: z.string(), // Имя команды
      description: z.string().optional(), // Описание команды
      agent: z.string().optional(), // Агент для выполнения
      model: z.string().optional(), // Модель для использования
      template: z.string(), // Шаблон промпта
      subtask: z.boolean().optional(), // Является ли подзадачей
    })
    .meta({
      ref: "Command",
    })
  export type Info = z.infer<typeof Info>

  // Состояние команд для текущего инстанса проекта
  const state = Instance.state(async () => {
    const cfg = await Config.get()

    const result: Record<string, Info> = {}

    // Загружаем команды из конфигурации
    for (const [name, command] of Object.entries(cfg.command ?? {})) {
      result[name] = {
        name,
        agent: command.agent,
        model: command.model,
        description: command.description,
        template: command.template,
        subtask: command.subtask,
      }
    }

    // Добавляем встроенную команду init если она не переопределена
    if (result[Default.INIT] === undefined) {
      result[Default.INIT] = {
        name: Default.INIT,
        description: "create/update AGENTS.md",
        template: PROMPT_INITIALIZE.replace("${path}", Instance.worktree),
      }
    }

    return result
  })

  // Получить команду по имени
  export async function get(name: string) {
    return state().then((x) => x[name])
  }

  // Получить список всех команд
  export async function list() {
    return state().then((x) => Object.values(x))
  }
}
