// Асинхронная очередь - позволяет одновременно добавлять элементы и получать их асинхронно
// Реализует интерфейс AsyncIterable для использования в for await...of
export class AsyncQueue<T> implements AsyncIterable<T> {
  // Буфер для хранения элементов, если нет ожидающих потребителей
  private queue: T[] = []
  // Массив функций разрешения (resolve) от Promise'ов ожидающих потребителей
  private resolvers: ((value: T) => void)[] = []

  // Добавляет элемент в очередь
  // Если есть ожидающий потребитель, немедленно разрешает его Promise
  // Иначе добавляет элемент в буфер очереди
  push(item: T) {
    const resolve = this.resolvers.shift()
    if (resolve) resolve(item)
    else this.queue.push(item)
  }

  // Получает следующий элемент из очереди
  // Если в буфере есть элементы, возвращает первый из них немедленно
  // Иначе возвращает Promise, который будет разрешен при следующем push()
  async next(): Promise<T> {
    if (this.queue.length > 0) return this.queue.shift()!
    return new Promise((resolve) => this.resolvers.push(resolve))
  }

  // Реализует асинхронный итератор для использования в for await...of
  // Бесконечно выдает элементы из очереди по мере их добавления
  async *[Symbol.asyncIterator]() {
    while (true) yield await this.next()
  }
}
