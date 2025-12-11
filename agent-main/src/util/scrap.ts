// Файл для временного кода и экспериментов (scrap - черновик)
// Содержит вспомогательные константы и функции для тестирования

// Строковая константа-заглушка
export const foo: string = "42"
// Числовая константа-заглушка
export const bar: number = 123

// Пустая функция-заглушка для демонстрации
// Выводит сообщение в консоль
export function dummyFunction(): void {
  console.log("This is a dummy function")
}

// Вспомогательная функция, возвращающая случайное булево значение
// Возвращает true примерно в 50% случаев
export function randomHelper(): boolean {
  return Math.random() > 0.5
}
