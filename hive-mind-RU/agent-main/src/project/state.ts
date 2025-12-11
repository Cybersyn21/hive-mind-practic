import { Log } from "../util/log"

// Пространство имен для управления состоянием проектов
// Обеспечивает создание, хранение и очистку состояния с поддержкой dispose
export namespace State {
  // Запись состояния с опциональной функцией очистки
  interface Entry {
    state: any // Хранимое состояние
    dispose?: (state: any) => Promise<void> // Функция очистки ресурсов
  }

  const log = Log.create({ service: "state" })
  // Карта состояний: ключ проекта -> Map функций инициализации -> запись состояния
  const recordsByKey = new Map<string, Map<any, Entry>>()

  // Создает функцию доступа к состоянию с ленивой инициализацией
  // root() - функция получения ключа (обычно ID проекта)
  // init() - функция инициализации состояния
  // dispose() - опциональная функция очистки при удалении состояния
  export function create<S>(root: () => string, init: () => S, dispose?: (state: Awaited<S>) => Promise<void>) {
    return () => {
      const key = root()
      // Получаем или создаем карту состояний для данного ключа
      let entries = recordsByKey.get(key)
      if (!entries) {
        entries = new Map<string, Entry>()
        recordsByKey.set(key, entries)
      }
      // Проверяем, есть ли уже инициализированное состояние
      const exists = entries.get(init)
      if (exists) return exists.state as S
      // Инициализируем новое состояние
      const state = init()
      entries.set(init, {
        state,
        dispose,
      })
      return state
    }
  }

  // Очищает все состояния для заданного ключа
  // Вызывает функции dispose для всех записей и удаляет их
  export async function dispose(key: string) {
    const entries = recordsByKey.get(key)
    if (!entries) return

    log.info("waiting for state disposal to complete", { key })

    let disposalFinished = false

    // Таймер предупреждения о долгой очистке (10 секунд)
    setTimeout(() => {
      if (!disposalFinished) {
        log.warn(
          "state disposal is taking an unusually long time - if it does not complete in a reasonable time, please report this as a bug",
          { key },
        )
      }
    }, 10000).unref()

    // Собираем все задачи очистки
    const tasks: Promise<void>[] = []
    for (const entry of entries.values()) {
      if (!entry.dispose) continue

      const task = Promise.resolve(entry.state)
        .then((state) => entry.dispose!(state))
        .catch((error) => {
          log.error("Error while disposing state:", { error, key })
        })

      tasks.push(task)
    }
    // Ждем завершения всех задач очистки
    await Promise.all(tasks)
    recordsByKey.delete(key)
    disposalFinished = true
    log.info("state disposal completed", { key })
  }
}
