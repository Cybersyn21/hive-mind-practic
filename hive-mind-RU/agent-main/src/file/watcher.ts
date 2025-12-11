import z from "zod"
import { Bus } from "../bus"
import { Flag } from "../flag/flag"
import { Instance } from "../project/instance"
import { Log } from "../util/log"
import { FileIgnore } from "./ignore"
import { Config } from "../config/config"
// @ts-ignore
import { createWrapper } from "@parcel/watcher/wrapper"
import { lazy } from "../util/lazy"

// Пространство имен для отслеживания изменений файлов в реальном времени
// Использует библиотеку @parcel/watcher для мониторинга файловой системы
export namespace FileWatcher {
  const log = Log.create({ service: "file.watcher" })

  // События, публикуемые при изменении файлов
  export const Event = {
    // Событие обновления файла (добавление, изменение или удаление)
    Updated: Bus.event(
      "file.watcher.updated",
      z.object({
        file: z.string(), // Путь к измененному файлу
        event: z.union([z.literal("add"), z.literal("change"), z.literal("unlink")]), // Тип события
      }),
    ),
  }

  // Ленивая загрузка нативного модуля watcher для текущей платформы
  // Позволяет избежать загрузки модуля, если он не используется
  const watcher = lazy(() => {
    const binding = require(
      `@parcel/watcher-${process.platform}-${process.arch}${process.platform === "linux" ? "-glibc" : ""}`,
    )
    return createWrapper(binding) as typeof import("@parcel/watcher")
  })

  // Состояние watcher'а с логикой инициализации и очистки
  const state = Instance.state(
    async () => {
      // Watcher работает только в git-репозиториях
      if (Instance.project.vcs !== "git") return {}
      log.info("init")
      const cfg = await Config.get()

      // Определяем бэкенд для отслеживания файлов в зависимости от платформы
      const backend = (() => {
        if (process.platform === "win32") return "windows" // Windows API
        if (process.platform === "darwin") return "fs-events" // macOS FSEvents
        if (process.platform === "linux") return "inotify" // Linux inotify
      })()

      if (!backend) {
        log.error("watcher backend not supported", { platform: process.platform })
        return {}
      }

      log.info("watcher backend", { platform: process.platform, backend })

      // Подписываемся на изменения в директории проекта
      const sub = await watcher().subscribe(
        Instance.directory,
        (err, evts) => {
          if (err) return
          // Обрабатываем каждое событие изменения файла
          for (const evt of evts) {
            log.info("event", evt)
            // Конвертируем события parcel/watcher в наш формат и публикуем в шину событий
            if (evt.type === "create") Bus.publish(Event.Updated, { file: evt.path, event: "add" })
            if (evt.type === "update") Bus.publish(Event.Updated, { file: evt.path, event: "change" })
            if (evt.type === "delete") Bus.publish(Event.Updated, { file: evt.path, event: "unlink" })
          }
        },
        {
          // Игнорируем файлы из стандартного списка и пользовательской конфигурации
          ignore: [...FileIgnore.PATTERNS, ...(cfg.watcher?.ignore ?? [])],
          backend,
        },
      )
      return { sub }
    },
    // Функция очистки: отписываемся от событий при остановке
    async (state) => {
      if (!state.sub) return
      await state.sub?.unsubscribe()
    },
  )

  // Инициализирует file watcher, если включен экспериментальный флаг
  export function init() {
    if (!Flag.OPENCODE_EXPERIMENTAL_WATCHER) return
    state()
  }
}
