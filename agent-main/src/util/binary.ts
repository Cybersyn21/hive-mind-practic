// Пространство имен для работы с бинарным поиском и вставкой в отсортированные массивы
// Обеспечивает эффективные операции O(log n) для поиска и O(n) для вставки
export namespace Binary {
  // Выполняет бинарный поиск элемента в отсортированном массиве
  // array - отсортированный массив для поиска
  // id - строковый идентификатор для поиска
  // compare - функция извлекающая идентификатор из элемента массива
  // Возвращает объект с флагом found и индексом элемента (или позицией для вставки)
  export function search<T>(array: T[], id: string, compare: (item: T) => string): { found: boolean; index: number } {
    let left = 0
    let right = array.length - 1

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midId = compare(array[mid])

      if (midId === id) {
        // Элемент найден
        return { found: true, index: mid }
      } else if (midId < id) {
        // Искомый элемент находится в правой половине
        left = mid + 1
      } else {
        // Искомый элемент находится в левой половине
        right = mid - 1
      }
    }

    // Элемент не найден, возвращаем позицию для вставки
    return { found: false, index: left }
  }

  // Вставляет элемент в отсортированный массив с сохранением порядка сортировки
  // array - отсортированный массив куда вставляется элемент
  // item - элемент для вставки
  // compare - функция извлекающая идентификатор из элемента для сравнения
  // Возвращает модифицированный массив с вставленным элементом
  export function insert<T>(array: T[], item: T, compare: (item: T) => string): T[] {
    const id = compare(item)
    let left = 0
    let right = array.length

    // Находим правильную позицию для вставки используя бинарный поиск
    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      const midId = compare(array[mid])

      if (midId < id) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    // Вставляем элемент в найденную позицию
    array.splice(left, 0, item)
    return array
  }
}
