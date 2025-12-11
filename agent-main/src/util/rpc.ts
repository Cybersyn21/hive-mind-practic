// Пространство имён для реализации RPC (Remote Procedure Call) через сообщения
// Используется для взаимодействия с Web Workers через типизированные вызовы методов
export namespace Rpc {
  // Тип, описывающий набор методов RPC
  // Каждый метод принимает произвольный вход и возвращает произвольный результат
  type Definition = {
    [method: string]: (input: any) => any
  }

  // Создаёт слушатель RPC-запросов (серверная сторона)
  // Регистрирует обработчик сообщений, который выполняет вызовы методов
  export function listen(rpc: Definition) {
    onmessage = async (evt) => {
      // Парсим входящее сообщение
      const parsed = JSON.parse(evt.data)
      // Обрабатываем только RPC-запросы
      if (parsed.type === "rpc.request") {
        // Вызываем соответствующий метод с переданными параметрами
        const result = await rpc[parsed.method](parsed.input)
        // Отправляем результат обратно клиенту с тем же ID
        postMessage(JSON.stringify({ type: "rpc.result", result, id: parsed.id }))
      }
    }
  }

  // Создаёт клиент для вызова удалённых методов (клиентская сторона)
  // Возвращает объект с методом call для типизированных вызовов
  export function client<T extends Definition>(target: {
    postMessage: (data: string) => void | null
    onmessage: ((this: Worker, ev: MessageEvent<any>) => any) | null
  }) {
    // Хранилище ожидающих ответа запросов: ID -> функция resolve
    const pending = new Map<number, (result: any) => void>()
    // Счётчик для генерации уникальных ID запросов
    let id = 0
    // Устанавливаем обработчик для получения результатов
    target.onmessage = async (evt) => {
      const parsed = JSON.parse(evt.data)
      // Обрабатываем только результаты RPC
      if (parsed.type === "rpc.result") {
        // Находим соответствующий промис по ID
        const resolve = pending.get(parsed.id)
        if (resolve) {
          // Резолвим промис с результатом
          resolve(parsed.result)
          // Удаляем обработчик из очереди ожидания
          pending.delete(parsed.id)
        }
      }
    }
    // Возвращаем объект клиента с методом call
    return {
      // Типизированный вызов удалённого метода
      // Method - имя метода, input - параметры, возвращает Promise с результатом
      call<Method extends keyof T>(method: Method, input: Parameters<T[Method]>[0]): Promise<ReturnType<T[Method]>> {
        // Генерируем уникальный ID для этого запроса
        const requestId = id++
        return new Promise((resolve) => {
          // Регистрируем обработчик для этого запроса
          pending.set(requestId, resolve)
          // Отправляем запрос серверу
          target.postMessage(JSON.stringify({ type: "rpc.request", method, input, id: requestId }))
        })
      },
    }
  }
}
