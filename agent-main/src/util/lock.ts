export namespace Lock {
  // Реализация Read-Write Lock (RWLock) для синхронизации доступа к ресурсам
  // Позволяет множеству читателей или одному писателю одновременно получать доступ
  // Хранит состояние для каждого ключа ресурса

  // Карта состояний блокировок, где каждая блокировка содержит:
  // - readers: количество активных читателей
  // - writer: есть ли активный писатель
  // - waitingReaders/waitingWriters: очереди ожидающих потребителей
  const locks = new Map<
    string,
    {
      readers: number
      writer: boolean
      waitingReaders: (() => void)[]
      waitingWriters: (() => void)[]
    }
  >()

  // Получает или создает блокировку для ключа
  function get(key: string) {
    if (!locks.has(key)) {
      locks.set(key, {
        readers: 0,
        writer: false,
        waitingReaders: [],
        waitingWriters: [],
      })
    }
    return locks.get(key)!
  }

  // Обрабатывает освобождение блокировки и пробуждение ожидающих потребителей
  // Приоритет: писатели > читатели (для предотвращения голодания писателей)
  function process(key: string) {
    const lock = locks.get(key)
    // Если нет активных операций, завершить работу
    if (!lock || lock.writer || lock.readers > 0) return

    // Приоритизировать писателей для предотвращения голодания
    if (lock.waitingWriters.length > 0) {
      const nextWriter = lock.waitingWriters.shift()!
      nextWriter()
      return
    }

    // Пробудить всех ожидающих читателей одновременно (они не конфликтуют)
    while (lock.waitingReaders.length > 0) {
      const nextReader = lock.waitingReaders.shift()!
      nextReader()
    }

    // Удалить пустую блокировку для освобождения памяти
    if (lock.readers === 0 && !lock.writer && lock.waitingReaders.length === 0 && lock.waitingWriters.length === 0) {
      locks.delete(key)
    }
  }

  // Получает блокировку для чтения (read lock)
  // Позволяет множеству читателей получать доступ одновременно
  // Если есть писатель или ожидающие писатели, добавляет читателя в очередь ожидания
  export async function read(key: string): Promise<Disposable> {
    const lock = get(key)

    return new Promise((resolve) => {
      // Если нет активного писателя и нет ожидающих писателей, сразу предоставить доступ
      if (!lock.writer && lock.waitingWriters.length === 0) {
        lock.readers++
        resolve({
          // Disposable символ для использования с using statement
          [Symbol.dispose]: () => {
            lock.readers--
            process(key)
          },
        })
      } else {
        // Иначе добавить читателя в очередь ожидания
        lock.waitingReaders.push(() => {
          lock.readers++
          resolve({
            [Symbol.dispose]: () => {
              lock.readers--
              process(key)
            },
          })
        })
      }
    })
  }

  // Получает блокировку для записи (write lock)
  // Эксклюзивный доступ - только один писатель может быть активным
  // Если есть активный писатель или активные читатели, добавляет писателя в очередь ожидания
  export async function write(key: string): Promise<Disposable> {
    const lock = get(key)

    return new Promise((resolve) => {
      // Если нет активного писателя и нет активных читателей, сразу предоставить доступ
      if (!lock.writer && lock.readers === 0) {
        lock.writer = true
        resolve({
          // Disposable символ для использования с using statement
          [Symbol.dispose]: () => {
            lock.writer = false
            process(key)
          },
        })
      } else {
        // Иначе добавить писателя в очередь ожидания
        lock.waitingWriters.push(() => {
          lock.writer = true
          resolve({
            [Symbol.dispose]: () => {
              lock.writer = false
              process(key)
            },
          })
        })
      }
    })
  }
}
