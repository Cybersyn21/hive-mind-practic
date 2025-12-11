import z from "zod"
import type { ZodType } from "zod"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { GlobalBus } from "./global"

// Модуль шины событий для pub/sub паттерна внутри приложения
// Обеспечивает type-safe передачу событий между компонентами
export namespace Bus {
  const log = Log.create({ service: "bus" })
  type Subscription = (event: any) => void

  // Состояние подписок специфичное для каждого инстанса проекта
  const state = Instance.state(() => {
    const subscriptions = new Map<any, Subscription[]>() // Карта типов событий к массивам обработчиков

    return {
      subscriptions,
    }
  })

  export type EventDefinition = ReturnType<typeof event>

  // Глобальный реестр определений событий для валидации
  const registry = new Map<string, EventDefinition>()

  // Создать определение события с типом и схемой валидации свойств
  // Регистрирует событие в глобальном реестре для последующей валидации
  export function event<Type extends string, Properties extends ZodType>(type: Type, properties: Properties) {
    const result = {
      type,
      properties,
    }
    registry.set(type, result)
    return result
  }

  // Сгенерировать Zod схему для всех зарегистрированных событий
  // Используется для валидации и type inference полезных нагрузок событий
  export function payloads() {
    return z
      .discriminatedUnion(
        "type",
        registry
          .entries()
          .map(([type, def]) => {
            return z
              .object({
                type: z.literal(type),
                properties: def.properties,
              })
              .meta({
                ref: "Event" + "." + def.type,
              })
          })
          .toArray() as any,
      )
      .meta({
        ref: "Event",
      })
  }

  // Опубликовать событие для всех подписчиков
  // Вызывает обработчики как для конкретного типа события, так и для wildcard подписчиков (*)
  // Также отправляет событие в глобальную шину для кросс-инстансной коммуникации
  export async function publish<Definition extends EventDefinition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ) {
    const payload = {
      type: def.type,
      properties,
    }
    log.info("publishing", {
      type: def.type,
    })
    const pending = []
    // Вызываем обработчики для конкретного типа события и wildcard (*) подписчиков
    for (const key of [def.type, "*"]) {
      const match = state().subscriptions.get(key)
      for (const sub of match ?? []) {
        pending.push(sub(payload))
      }
    }
    // Отправляем событие в глобальную шину для других инстансов
    GlobalBus.emit("event", {
      directory: Instance.directory,
      payload,
    })
    return Promise.all(pending)
  }

  // Подписаться на конкретный тип события
  // Возвращает функцию отписки для удаления обработчика
  export function subscribe<Definition extends EventDefinition>(
    def: Definition,
    callback: (event: { type: Definition["type"]; properties: z.infer<Definition["properties"]> }) => void,
  ) {
    return raw(def.type, callback)
  }

  // Подписаться на событие с автоматической отпиской после первого выполнения
  // Callback должен вернуть "done" для отписки
  export function once<Definition extends EventDefinition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"]
      properties: z.infer<Definition["properties"]>
    }) => "done" | undefined,
  ) {
    const unsub = subscribe(def, (event) => {
      if (callback(event)) unsub()
    })
  }

  // Подписаться на все события (wildcard подписка)
  // Полезно для логирования или отладки
  export function subscribeAll(callback: (event: any) => void) {
    return raw("*", callback)
  }

  // Внутренняя функция для подписки на события
  // Управляет картой подписок и возвращает функцию отписки
  function raw(type: string, callback: (event: any) => void) {
    log.info("subscribing", { type })
    const subscriptions = state().subscriptions
    let match = subscriptions.get(type) ?? []
    match.push(callback)
    subscriptions.set(type, match)

    // Возвращаем функцию отписки
    return () => {
      log.info("unsubscribing", { type })
      const match = subscriptions.get(type)
      if (!match) return
      const index = match.indexOf(callback)
      if (index === -1) return
      match.splice(index, 1)
    }
  }
}
