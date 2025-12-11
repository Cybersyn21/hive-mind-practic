import { sortBy, pipe } from "remeda"

// Пространство имён для работы с wildcard-паттернами (шаблонами с подстановочными символами)
// Поддерживает символы * (любая последовательность) и ? (один любой символ)
export namespace Wildcard {
  // Проверяет, соответствует ли строка wildcard-паттерну
  // Поддерживает * (любое количество любых символов) и ? (один любой символ)
  export function match(str: string, pattern: string) {
    // Создаём регулярное выражение из wildcard-паттерна
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Экранируем специальные символы regex
          .replace(/\*/g, ".*") // Заменяем * на .* (любая последовательность)
          .replace(/\?/g, ".") + // Заменяем ? на . (один любой символ)
        "$",
      "s", // Флаг s включает многострочное сопоставление (. совпадает с \n)
    )
    return regex.test(str)
  }

  // Находит значение по паттерну из набора паттернов
  // Если несколько паттернов подходят, возвращается значение последнего подошедшего
  // Паттерны сортируются по длине (короткие первыми), затем лексикографически
  export function all(input: string, patterns: Record<string, any>) {
    // Сортируем паттерны: сначала по длине (короткие первыми), затем алфавитно
    const sorted = pipe(patterns, Object.entries, sortBy([([key]) => key.length, "asc"], [([key]) => key, "asc"]))
    let result = undefined
    // Проходим по всем паттернам и перезаписываем result при каждом совпадении
    for (const [pattern, value] of sorted) {
      if (match(input, pattern)) {
        result = value
        continue
      }
    }
    return result
  }

  // Находит значение по структурированному вводу (голова + хвост)
  // Используется для сопоставления команд с аргументами
  // input.head - основная команда, input.tail - список аргументов
  export function allStructured(input: { head: string; tail: string[] }, patterns: Record<string, any>) {
    // Сортируем паттерны по длине и алфавиту
    const sorted = pipe(patterns, Object.entries, sortBy([([key]) => key.length, "asc"], [([key]) => key, "asc"]))
    let result = undefined
    for (const [pattern, value] of sorted) {
      // Разбиваем паттерн на части (команда + аргументы)
      const parts = pattern.split(/\s+/)
      // Проверяем, соответствует ли голова первой части паттерна
      if (!match(input.head, parts[0])) continue
      // Если паттерн состоит только из команды, или хвост совпадает с остальными частями
      if (parts.length === 1 || matchSequence(input.tail, parts.slice(1))) {
        result = value
        continue
      }
    }
    return result
  }

  // Рекурсивно проверяет, соответствует ли последовательность элементов паттернам
  // Используется для сопоставления аргументов команды с паттернами
  function matchSequence(items: string[], patterns: string[]): boolean {
    // Базовый случай: если паттернов не осталось, совпадение успешно
    if (patterns.length === 0) return true
    const [pattern, ...rest] = patterns
    // Если паттерн - это *, пропускаем его и проверяем остальные
    if (pattern === "*") return matchSequence(items, rest)
    // Пробуем найти позицию, где текущий паттерн совпадает
    for (let i = 0; i < items.length; i++) {
      // Если элемент совпадает и остальная последовательность тоже совпадает
      if (match(items[i], pattern) && matchSequence(items.slice(i + 1), rest)) {
        return true
      }
    }
    return false
  }
}
