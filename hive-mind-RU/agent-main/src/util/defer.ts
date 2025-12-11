// Создает объект с отложенным выполнением функции очистки
// Используется с новым синтаксисом `using` в TypeScript для автоматического освобождения ресурсов
// fn - функция очистки которая будет вызвана при выходе из области видимости
// Возвращает объект с Symbol.dispose или Symbol.asyncDispose в зависимости от типа функции
export function defer<T extends () => void | Promise<void>>(
  fn: T,
): T extends () => Promise<void> ? { [Symbol.asyncDispose]: () => Promise<void> } : { [Symbol.dispose]: () => void } {
  return {
    // Синхронный метод очистки для использования с `using`
    [Symbol.dispose]() {
      fn()
    },
    // Асинхронный метод очистки для использования с `await using`
    [Symbol.asyncDispose]() {
      return Promise.resolve(fn())
    },
  } as any
}
