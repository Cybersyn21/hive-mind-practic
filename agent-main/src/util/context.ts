import { AsyncLocalStorage } from "async_hooks"

// Пространство имен для создания и управления асинхронными локальными контекстами
// Позволяет передавать данные через цепочку асинхронных вызовов без явной передачи параметров
export namespace Context {
  // Ошибка выбрасываемая когда контекст не найден при попытке использования
  export class NotFound extends Error {
    constructor(public override readonly name: string) {
      super(`No context found for ${name}`)
    }
  }

  // Создает новый асинхронный локальный контекст с заданным именем
  // name - имя контекста для отладки и сообщений об ошибках
  // Возвращает объект с методами use() и provide()
  export function create<T>(name: string) {
    const storage = new AsyncLocalStorage<T>()
    return {
      // Получает текущее значение из контекста
      // Выбрасывает ошибку NotFound если контекст не был предоставлен
      use() {
        const result = storage.getStore()
        if (!result) {
          throw new NotFound(name)
        }
        return result
      },
      // Предоставляет значение контекста для выполнения функции
      // value - значение которое будет доступно в контексте
      // fn - функция которая будет выполнена с доступом к контексту
      provide<R>(value: T, fn: () => R) {
        return storage.run(value, fn)
      },
    }
  }
}
