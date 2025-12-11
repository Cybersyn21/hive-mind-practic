import { Log } from "../util/log"
import { Context } from "../util/context"
import { Project } from "./project"
import { State } from "./state"
import { iife } from "../util/iife"

// Интерфейс контекста инстанции, содержит информацию о текущем проекте
interface Context {
  directory: string
  worktree: string
  project: Project.Info
}

// Создаем контекст для управления состоянием инстанции
const context = Context.create<Context>("instance")

// Кэш для хранения инстанций по директориям, избегает повторного создания
const cache = new Map<string, Promise<Context>>()

// Менеджер инстанций проекта - управляет жизненным циклом и контекстом
export const Instance = {
  // Основной метод для получения инстанции с поддержкой инициализации и выполнения функций
  async provide<R>(input: { directory: string; init?: () => Promise<any>; fn: () => R }): Promise<R> {
    // Проверяем, есть ли уже созданная инстанция для этой директории
    let existing = cache.get(input.directory)
    if (!existing) {
      Log.Default.info("creating instance", { directory: input.directory })
      // Создаем новую инстанцию, если её еще нет
      // iife (immediately invoked function expression) для выполнения асинхронного кода
      existing = iife(async () => {
        const project = await Project.fromDirectory(input.directory)
        const ctx = {
          directory: input.directory,
          worktree: project.worktree,
          project,
        }
        // Предоставляем контекст для инициализации
        await context.provide(ctx, async () => {
          await input.init?.()
        })
        return ctx
      })
      cache.set(input.directory, existing)
    }
    // Получаем сохраненную инстанцию из кэша и выполняем переданную функцию в контексте
    const ctx = await existing
    return context.provide(ctx, async () => {
      return input.fn()
    })
  },

  // Получить текущую директорию из контекста
  get directory() {
    return context.use().directory
  },

  // Получить рабочую директорию (worktree) из контекста
  get worktree() {
    return context.use().worktree
  },

  // Получить информацию о проекте из контекста
  get project() {
    return context.use().project
  },

  // Создать состояние (state) для текущей инстанции с поддержкой инициализации и очистки
  state<S>(init: () => S, dispose?: (state: Awaited<S>) => Promise<void>): () => S {
    return State.create(() => Instance.directory, init, dispose)
  },

  // Очистить текущую инстанцию и связанные с ней состояния
  async dispose() {
    Log.Default.info("disposing instance", { directory: Instance.directory })
    await State.dispose(Instance.directory)
  },

  // Очистить все созданные инстанции и кэш
  async disposeAll() {
    Log.Default.info("disposing all instances")
    // Проходим по всем инстанциям в кэше и очищаем их
    for (const [_key, value] of cache) {
      const awaited = await value.catch(() => {})
      if (awaited) {
        await context.provide(await value, async () => {
          await Instance.dispose()
        })
      }
    }
    // Полностью очищаем кэш
    cache.clear()
  },
}
