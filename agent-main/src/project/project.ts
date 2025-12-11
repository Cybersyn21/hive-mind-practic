import z from "zod"
import { Filesystem } from "../util/filesystem"
import path from "path"
import { $ } from "bun"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"
import { Flag } from "../flag/flag"

export namespace Project {
  const log = Log.create({ service: "project" })

  // Определение типа информации о проекте через Zod схему
  // Содержит уникальный идентификатор проекта, рабочую директорию и метаданные времени
  export const Info = z
    .object({
      id: z.string(),
      worktree: z.string(),
      vcs: z.literal("git").optional(),
      time: z.object({
        created: z.number(),
        initialized: z.number().optional(),
      }),
    })
    .meta({
      ref: "Project",
    })
  export type Info = z.infer<typeof Info>

  // Получает информацию о проекте из указанной директории
  // Пытается найти Git репозиторий, если не найден - создает глобальный проект
  export async function fromDirectory(directory: string) {
    log.info("fromDirectory", { directory })
    // Поиск директории .git в цепи директорий вверх от начальной точки
    const matches = Filesystem.up({ targets: [".git"], start: directory })
    const git = await matches.next().then((x) => x.value)
    await matches.return()

    // Если Git репозиторий не найден - создаем глобальный проект
    if (!git) {
      const project: Info = {
        id: "global",
        worktree: "/",
        vcs: "none", // No VCS
        time: {
          created: Date.now(),
        },
      }
      await Storage.write<Info>(["project", "global"], project)
      return project
    }

    let worktree = path.dirname(git)
    const timer = log.time("git.rev-parse")

    // Попытка прочитать ID проекта из файла opencode
    let id = await Bun.file(path.join(git, "opencode"))
      .text()
      .then((x) => x.trim())
      .catch(() => {})

    // Если ID не найден в файле, получаем ID из первого (корневого) коммита Git
    if (!id) {
      const roots = await $`git rev-list --max-parents=0 --all`
        .quiet()
        .nothrow()
        .cwd(worktree)
        .text()
        .then((x) =>
          x
            .split("\n")
            .filter(Boolean)
            .map((x) => x.trim())
            .toSorted(),
        )
      id = roots[0]
      // Сохраняем полученный ID в файл для будущих обращений
      if (id) Bun.file(path.join(git, "opencode")).write(id)
    }
    timer.stop()

    // Если ID по-прежнему не получен - создаем глобальный проект
    if (!id) {
      const project: Info = {
        id: "global",
        worktree: "/",
        time: {
          created: Date.now(),
        },
      }
      await Storage.write<Info>(["project", "global"], project)
      return project
    }

    // Получаем абсолютный путь к корню Git репозитория
    worktree = await $`git rev-parse --path-format=absolute --show-toplevel`
      .quiet()
      .nothrow()
      .cwd(worktree)
      .text()
      .then((x) => x.trim())

    // Создаем объект проекта с полной информацией
    const project: Info = {
      id,
      worktree,
      vcs: "git",
      time: {
        created: Date.now(),
      },
    }
    await Storage.write<Info>(["project", id], project)
    return project
  }

  // Обновляет время инициализации проекта
  export async function setInitialized(projectID: string) {
    await Storage.update<Info>(["project", projectID], (draft) => {
      draft.time.initialized = Date.now()
    })
  }

  // Получает список всех сохраненных проектов из хранилища
  export async function list() {
    const keys = await Storage.list(["project"])
    return await Promise.all(keys.map((x) => Storage.read<Info>(x)))
  }
}
