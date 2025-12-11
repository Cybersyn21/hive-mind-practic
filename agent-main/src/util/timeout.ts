// Добавляет таймаут к промису
// Если промис не завершится за указанное время, будет выброшена ошибка
// Используется для предотвращения бесконечного ожидания операций
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  // Переменная для хранения идентификатора таймера
  let timeout: NodeJS.Timeout
  // Используем Promise.race для гонки между промисом и таймаутом
  return Promise.race([
    // Обрабатываем успешное завершение исходного промиса
    promise.then((result) => {
      // Отменяем таймаут, если промис завершился вовремя
      clearTimeout(timeout)
      return result
    }),
    // Создаём промис, который реджектится по таймауту
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        // Выбрасываем ошибку с информацией о времени таймаута
        reject(new Error(`Operation timed out after ${ms}ms`))
      }, ms)
    }),
  ])
}
