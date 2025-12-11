import { $ } from "bun"
import path from "path"
import fs from "fs/promises"
import { Log } from "../util/log"
import { Global } from "../global"
import z from "zod"
import { Config } from "../config/config"
import { Instance } from "../project/instance"

// Пространство имен для управления снимками (snapshots) состояния файловой системы
// Использует Git для отслеживания изменений и возможности отката к предыдущим состояниям
export namespace Snapshot {
  const log = Log.create({ service: "snapshot" })

  // Создает снимок текущего состояния рабочего дерева
  // Возвращает хеш Git дерева который можно использовать для отката или сравнения
  export async function track() {
    // Проверяем что проект использует git
    if (Instance.project.vcs !== "git") return
    const cfg = await Config.get()
    // Проверяем что функция snapshot не отключена в конфигурации
    if (cfg.snapshot === false) return
    const git = gitdir()
    // Инициализируем git репозиторий для снимков если он еще не существует
    if (await fs.mkdir(git, { recursive: true })) {
      await $`git init`
        .env({
          ...process.env,
          GIT_DIR: git,
          GIT_WORK_TREE: Instance.worktree,
        })
        .quiet()
        .nothrow()
      // Настраиваем git чтобы не конвертировать окончания строк на Windows
      // Configure git to not convert line endings on Windows
      await $`git --git-dir ${git} config core.autocrlf false`.quiet().nothrow()
      log.info("initialized")
    }
    // Добавляем все файлы в индекс
    await $`git --git-dir ${git} --work-tree ${Instance.worktree} add .`.quiet().cwd(Instance.directory).nothrow()
    // Создаем дерево объектов и получаем его хеш
    const hash = await $`git --git-dir ${git} --work-tree ${Instance.worktree} write-tree`
      .quiet()
      .cwd(Instance.directory)
      .nothrow()
      .text()
    log.info("tracking", { hash, cwd: Instance.directory, git })
    return hash.trim()
  }

  // Схема описывающая патч - набор файлов изменённых относительно снимка
  export const Patch = z.object({
    hash: z.string(), // Хеш снимка
    files: z.string().array(), // Массив путей к измененным файлам
  })
  export type Patch = z.infer<typeof Patch>

  // Создает патч показывающий какие файлы изменились относительно указанного снимка
  // hash - хеш снимка для сравнения с текущим состоянием
  // Возвращает объект с хешем и списком измененных файлов
  export async function patch(hash: string): Promise<Patch> {
    const git = gitdir()
    // Добавляем текущие изменения в индекс
    await $`git --git-dir ${git} --work-tree ${Instance.worktree} add .`.quiet().cwd(Instance.directory).nothrow()
    // Получаем список файлов которые отличаются от снимка
    const result =
      await $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} diff --name-only ${hash} -- .`
        .quiet()
        .cwd(Instance.directory)
        .nothrow()

    // Если git diff не удался, возвращаем пустой патч
    // If git diff fails, return empty patch
    if (result.exitCode !== 0) {
      log.warn("failed to get diff", { hash, exitCode: result.exitCode })
      return { hash, files: [] }
    }

    const files = result.text()
    return {
      hash,
      // Преобразуем список файлов в массив абсолютных путей
      files: files
        .trim()
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => path.join(Instance.worktree, x)),
    }
  }

  // Восстанавливает рабочее дерево до состояния указанного снимка
  // snapshot - хеш снимка для восстановления
  export async function restore(snapshot: string) {
    log.info("restore", { commit: snapshot })
    const git = gitdir()
    // Читаем дерево из снимка и принудительно извлекаем все файлы
    const result =
      await $`git --git-dir ${git} --work-tree ${Instance.worktree} read-tree ${snapshot} && git --git-dir ${git} --work-tree ${Instance.worktree} checkout-index -a -f`
        .quiet()
        .cwd(Instance.worktree)
        .nothrow()

    if (result.exitCode !== 0) {
      log.error("failed to restore snapshot", {
        snapshot,
        exitCode: result.exitCode,
        stderr: result.stderr.toString(),
        stdout: result.stdout.toString(),
      })
    }
  }

  // Откатывает изменения применяя патчи в обратном порядке
  // patches - массив патчей содержащих файлы для отката
  export async function revert(patches: Patch[]) {
    const files = new Set<string>()
    const git = gitdir()
    // Проходим по всем патчам и откатываем изменения в файлах
    for (const item of patches) {
      for (const file of item.files) {
        // Пропускаем уже обработанные файлы
        if (files.has(file)) continue
        log.info("reverting", { file, hash: item.hash })
        // Пытаемся восстановить файл из снимка
        const result = await $`git --git-dir ${git} --work-tree ${Instance.worktree} checkout ${item.hash} -- ${file}`
          .quiet()
          .cwd(Instance.worktree)
          .nothrow()
        if (result.exitCode !== 0) {
          // Если checkout не удался, проверяем существовал ли файл в снимке
          const relativePath = path.relative(Instance.worktree, file)
          const checkTree =
            await $`git --git-dir ${git} --work-tree ${Instance.worktree} ls-tree ${item.hash} -- ${relativePath}`
              .quiet()
              .cwd(Instance.worktree)
              .nothrow()
          if (checkTree.exitCode === 0 && checkTree.text().trim()) {
            // Файл существовал в снимке но checkout не удался, оставляем как есть
            log.info("file existed in snapshot but checkout failed, keeping", {
              file,
            })
          } else {
            // Файл не существовал в снимке, удаляем его
            log.info("file did not exist in snapshot, deleting", { file })
            await fs.unlink(file).catch(() => {})
          }
        }
        files.add(file)
      }
    }
  }

  // Вычисляет текстовое различие (diff) между снимком и текущим состоянием
  // hash - хеш снимка для сравнения
  // Возвращает строку с diff в формате Git
  export async function diff(hash: string) {
    const git = gitdir()
    await $`git --git-dir ${git} --work-tree ${Instance.worktree} add .`.quiet().cwd(Instance.directory).nothrow()
    const result =
      await $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} diff ${hash} -- .`
        .quiet()
        .cwd(Instance.worktree)
        .nothrow()

    if (result.exitCode !== 0) {
      log.warn("failed to get diff", {
        hash,
        exitCode: result.exitCode,
        stderr: result.stderr.toString(),
        stdout: result.stdout.toString(),
      })
      return ""
    }

    return result.text().trim()
  }

  // Схема описывающая детальное различие для одного файла
  export const FileDiff = z
    .object({
      file: z.string(), // Путь к файлу
      before: z.string(), // Содержимое до изменений
      after: z.string(), // Содержимое после изменений
      additions: z.number(), // Количество добавленных строк
      deletions: z.number(), // Количество удаленных строк
    })
    .meta({
      ref: "FileDiff",
    })
  export type FileDiff = z.infer<typeof FileDiff>

  // Вычисляет полное различие между двумя снимками включая содержимое файлов
  // from - хеш начального снимка
  // to - хеш конечного снимка
  // Возвращает массив детальных различий для каждого измененного файла
  export async function diffFull(from: string, to: string): Promise<FileDiff[]> {
    const git = gitdir()
    const result: FileDiff[] = []
    // Получаем статистику изменений для каждого файла
    for await (const line of $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} diff --no-renames --numstat ${from} ${to} -- .`
      .quiet()
      .cwd(Instance.directory)
      .nothrow()
      .lines()) {
      if (!line) continue
      const [additions, deletions, file] = line.split("\t")
      // Бинарные файлы помечаются как "-" в статистике
      const isBinaryFile = additions === "-" && deletions === "-"
      // Получаем содержимое файла до изменений (пропускаем для бинарных файлов)
      const before = isBinaryFile
        ? ""
        : await $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} show ${from}:${file}`
            .quiet()
            .nothrow()
            .text()
      // Получаем содержимое файла после изменений (пропускаем для бинарных файлов)
      const after = isBinaryFile
        ? ""
        : await $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} show ${to}:${file}`
            .quiet()
            .nothrow()
            .text()
      result.push({
        file,
        before,
        after,
        additions: parseInt(additions),
        deletions: parseInt(deletions),
      })
    }
    return result
  }

  // Возвращает путь к директории Git репозитория для снимков
  function gitdir() {
    const project = Instance.project
    return path.join(Global.Path.data, "snapshot", project.id)
  }
}
