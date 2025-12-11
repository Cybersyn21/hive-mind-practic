import { Log } from "../util/log"
import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { lazy } from "../util/lazy"
import { Lock } from "../util/lock"
import { $ } from "bun"
import { NamedError } from "../util/error"
import z from "zod"

export namespace Storage {
  const log = Log.create({ service: "storage" })

  // Тип миграции - функция для обновления структуры хранилища
  type Migration = (dir: string) => Promise<void>

  // Ошибка, выбрасываемая когда запрошенный ресурс не найден в хранилище
  export const NotFoundError = NamedError.create(
    "NotFoundError",
    z.object({
      message: z.string(),
    }),
  )

  // Массив миграций для обновления структуры хранилища при развитии приложения
  const MIGRATIONS: Migration[] = [
    // Миграция 1: Переструктурирование проектов, сессий, сообщений и их частей
    // Переводит данные из старой структуры на основе директорий в новую структуру на основе ID
    async (dir) => {
      const project = path.resolve(dir, "../project")
      if (!fs.exists(project)) return
      // Проходим по каждой директории проекта
      for await (const projectDir of new Bun.Glob("*").scan({
        cwd: project,
        onlyFiles: false,
      })) {
        log.info(`migrating project ${projectDir}`)
        let projectID = projectDir
        const fullProjectDir = path.join(project, projectDir)
        let worktree = "/"

        if (projectID !== "global") {
          // Извлекаем информацию о рабочей директории из файлов сообщений
          for await (const msgFile of new Bun.Glob("storage/session/message/*/*.json").scan({
            cwd: path.join(project, projectDir),
            absolute: true,
          })) {
            const json = await Bun.file(msgFile).json()
            worktree = json.path?.root
            if (worktree) break
          }
          if (!worktree) continue
          if (!(await fs.exists(worktree))) continue

          // Получаем ID проекта из первого коммита Git репозитория
          const [id] = await $`git rev-list --max-parents=0 --all`
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
          if (!id) continue
          projectID = id

          // Записываем информацию о проекте с новым ID
          await Bun.write(
            path.join(dir, "project", projectID + ".json"),
            JSON.stringify({
              id,
              vcs: "git",
              worktree,
              time: {
                created: Date.now(),
                initialized: Date.now(),
              },
            }),
          )

          // Миграция сессий и их сообщений в новую структуру
          log.info(`migrating sessions for project ${projectID}`)
          for await (const sessionFile of new Bun.Glob("storage/session/info/*.json").scan({
            cwd: fullProjectDir,
            absolute: true,
          })) {
            const dest = path.join(dir, "session", projectID, path.basename(sessionFile))
            log.info("copying", {
              sessionFile,
              dest,
            })
            const session = await Bun.file(sessionFile).json()
            await Bun.write(dest, JSON.stringify(session))

            // Миграция сообщений для каждой сессии
            log.info(`migrating messages for session ${session.id}`)
            for await (const msgFile of new Bun.Glob(`storage/session/message/${session.id}/*.json`).scan({
              cwd: fullProjectDir,
              absolute: true,
            })) {
              const dest = path.join(dir, "message", session.id, path.basename(msgFile))
              log.info("copying", {
                msgFile,
                dest,
              })
              const message = await Bun.file(msgFile).json()
              await Bun.write(dest, JSON.stringify(message))

              // Миграция частей сообщений (parts)
              log.info(`migrating parts for message ${message.id}`)
              for await (const partFile of new Bun.Glob(`storage/session/part/${session.id}/${message.id}/*.json`).scan(
                {
                  cwd: fullProjectDir,
                  absolute: true,
                },
              )) {
                const dest = path.join(dir, "part", message.id, path.basename(partFile))
                const part = await Bun.file(partFile).json()
                log.info("copying", {
                  partFile,
                  dest,
                })
                await Bun.write(dest, JSON.stringify(part))
              }
            }
          }
        }
      }
    },
    // Миграция 2: Извлечение и оптимизация данных о различиях (diffs) из сессий
    // Разделяет данные о различиях в отдельный файл для более эффективного доступа
    async (dir) => {
      for await (const item of new Bun.Glob("session/*/*.json").scan({
        cwd: dir,
        absolute: true,
      })) {
        const session = await Bun.file(item).json()
        if (!session.projectID) continue
        if (!session.summary?.diffs) continue
        const { diffs } = session.summary

        // Записываем различия в отдельный файл
        await Bun.file(path.join(dir, "session_diff", session.id + ".json")).write(JSON.stringify(diffs))

        // Обновляем сессию с агрегированными статистиками вместо полных дифов
        await Bun.file(path.join(dir, "session", session.projectID, session.id + ".json")).write(
          JSON.stringify({
            ...session,
            summary: {
              additions: diffs.reduce((sum: any, x: any) => sum + x.additions, 0),
              deletions: diffs.reduce((sum: any, x: any) => sum + x.deletions, 0),
            },
          }),
        )
      }
    },
  ]

  // Инициализация хранилища с выполнением необходимых миграций
  // Использует lazy для отложенной инициализации (выполняется только при первом вызове)
  const state = lazy(async () => {
    const dir = path.join(Global.Path.data, "storage")
    // Читаем номер последней выполненной миграции
    const migration = await Bun.file(path.join(dir, "migration"))
      .json()
      .then((x) => parseInt(x))
      .catch(() => 0)
    // Выполняем оставшиеся миграции (начиная с номера migration)
    for (let index = migration; index < MIGRATIONS.length; index++) {
      log.info("running migration", { index })
      const migration = MIGRATIONS[index]
      await migration(dir).catch(() => log.error("failed to run migration", { index }))
      // Обновляем номер последней выполненной миграции
      await Bun.write(path.join(dir, "migration"), (index + 1).toString())
    }
    return {
      dir,
    }
  })

  // Удалить ресурс из хранилища по ключу
  export async function remove(key: string[]) {
    const dir = await state().then((x) => x.dir)
    const target = path.join(dir, ...key) + ".json"
    return withErrorHandling(async () => {
      await fs.unlink(target).catch(() => {})
    })
  }

  // Прочитать ресурс из хранилища по ключу с блокировкой для безопасности
  export async function read<T>(key: string[]) {
    const dir = await state().then((x) => x.dir)
    const target = path.join(dir, ...key) + ".json"
    return withErrorHandling(async () => {
      // using позволяет автоматически освободить блокировку после завершения
      using _ = await Lock.read(target)
      const result = await Bun.file(target).json()
      return result as T
    })
  }

  // Обновить существующий ресурс в хранилище с функцией-трансформатором
  export async function update<T>(key: string[], fn: (draft: T) => void) {
    const dir = await state().then((x) => x.dir)
    const target = path.join(dir, ...key) + ".json"
    return withErrorHandling(async () => {
      // Получаем эксклюзивную блокировку записи
      using _ = await Lock.write(target)
      const content = await Bun.file(target).json()
      // Применяем функцию трансформации к содержимому
      fn(content)
      // Записываем обновленное содержимое с красивым форматированием
      await Bun.write(target, JSON.stringify(content, null, 2))
      return content as T
    })
  }

  // Записать новый ресурс в хранилище по ключу
  export async function write<T>(key: string[], content: T) {
    const dir = await state().then((x) => x.dir)
    const target = path.join(dir, ...key) + ".json"
    return withErrorHandling(async () => {
      // Получаем эксклюзивную блокировку записи
      using _ = await Lock.write(target)
      // Записываем содержимое с красивым форматированием для читаемости
      await Bun.write(target, JSON.stringify(content, null, 2))
    })
  }

  // Обработчик ошибок для всех операций с хранилищем
  // Преобразует системные ошибки в специфические исключения хранилища
  async function withErrorHandling<T>(body: () => Promise<T>) {
    return body().catch((e) => {
      if (!(e instanceof Error)) throw e
      const errnoException = e as NodeJS.ErrnoException
      // Преобразуем ошибку "файл не найден" в специфическую ошибку хранилища
      if (errnoException.code === "ENOENT") {
        throw new NotFoundError({ message: `Resource not found: ${errnoException.path}` })
      }
      throw e
    })
  }

  // Глобальный объект Glob для поиска файлов в хранилище
  const glob = new Bun.Glob("**/*")

  // Получить список всех ресурсов в заданной префиксе (директории)
  // Возвращает массив ключей (путей), отсортированный по алфавиту
  export async function list(prefix: string[]) {
    const dir = await state().then((x) => x.dir)
    try {
      const result = await Array.fromAsync(
        glob.scan({
          cwd: path.join(dir, ...prefix),
          onlyFiles: true,
        }),
      ).then((results) =>
        // Преобразуем пути в ключи, удаляя расширение .json
        results.map((x) => [...prefix, ...x.slice(0, -5).split(path.sep)]),
      )
      result.sort()
      return result
    } catch {
      // Если префикс не существует, возвращаем пустой массив
      return []
    }
  }
}
