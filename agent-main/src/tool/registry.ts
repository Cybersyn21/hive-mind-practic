// Импорт всех доступных инструментов
import { BashTool } from "./bash"
import { EditTool } from "./edit"
import { GlobTool } from "./glob"
import { GrepTool } from "./grep"
import { ListTool } from "./ls"
import { BatchTool } from "./batch"
import { ReadTool } from "./read"
import { TaskTool } from "./task"
import { TodoWriteTool, TodoReadTool } from "./todo"
import { WebFetchTool } from "./webfetch"
import { WriteTool } from "./write"
import { InvalidTool } from "./invalid"
import type { Agent } from "../agent/agent"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { Config } from "../config/config"
import { WebSearchTool } from "./websearch"
import { CodeSearchTool } from "./codesearch"
import { Flag } from "../flag/flag"

// Реестр инструментов - центральный репозиторий для управления всеми доступными инструментами
export namespace ToolRegistry {
  // Состояние для хранения пользовательских инструментов
  export const state = Instance.state(async () => {
    const custom = [] as Tool.Info[]
    return { custom }
  })

  // Регистрация нового пользовательского инструмента или обновление существующего
  export async function register(tool: Tool.Info) {
    const { custom } = await state()
    // Ищем инструмент с тем же идентификатором
    const idx = custom.findIndex((t) => t.id === tool.id)
    if (idx >= 0) {
      // Если существует, заменяем его
      custom.splice(idx, 1, tool)
      return
    }
    // Если нет, добавляем новый инструмент
    custom.push(tool)
  }

  // Получить список всех инструментов (встроенных и пользовательских)
  async function all(): Promise<Tool.Info[]> {
    const custom = await state().then((x) => x.custom)
    const config = await Config.get()

    // Возвращаем список встроенных инструментов и добавляем пользовательские
    return [
      InvalidTool,
      BashTool,
      ReadTool,
      GlobTool,
      GrepTool,
      ListTool,
      EditTool,
      WriteTool,
      TaskTool,
      WebFetchTool,
      WebSearchTool,
      CodeSearchTool,
      BatchTool,
      TodoWriteTool,
      TodoReadTool,
      ...custom,
    ]
  }

  // Получить идентификаторы всех доступных инструментов
  export async function ids() {
    return all().then((x) => x.map((t) => t.id))
  }

  // Получить информацию об инструментах (инициализированные данные)
  export async function tools(_providerID: string, _modelID: string) {
    const tools = await all()
    // Инициализируем каждый инструмент и собираем информацию о нём
    const result = await Promise.all(
      tools.map(async (t) => ({
        id: t.id,
        ...(await t.init()),
      })),
    )
    return result
  }

  // Получить запись о доступности инструментов для конкретного агента
  // Возвращает пустой объект так как все инструменты включены по умолчанию
  export async function enabled(
    _providerID: string,
    _modelID: string,
    agent: Agent.Info,
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {}

    // Система разрешений удалена - все инструменты включены по умолчанию

    return result
  }
}
