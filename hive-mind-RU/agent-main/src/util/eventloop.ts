import { Log } from "./log"

// Пространство имен для работы с циклом событий Node.js
export namespace EventLoop {
  // Ожидает пока цикл событий не станет пустым (все асинхронные операции завершены)
  // Используется для корректного завершения приложения или тестирования
  // Возвращает Promise который разрешается когда нет активных handles и requests
  export async function wait() {
    return new Promise<void>((resolve) => {
      const check = () => {
        // Получаем список всех активных handles (таймеры, сокеты) и requests (асинхронные операции)
        const active = [...(process as any)._getActiveHandles(), ...(process as any)._getActiveRequests()]
        Log.Default.info("eventloop", {
          active,
        })
        // Проверяем что нет активных handles и requests
        if ((process as any)._getActiveHandles().length === 0 && (process as any)._getActiveRequests().length === 0) {
          // Цикл событий пуст, завершаем ожидание
          resolve()
        } else {
          // Есть активные операции, проверяем снова на следующей итерации
          setImmediate(check)
        }
      }
      check()
    })
  }
}
