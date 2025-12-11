// Пространство имён для локализации и форматирования текста
// Содержит утилиты для работы с регистром, числами, датами и строками
export namespace Locale {
  // Преобразует строку в формат заголовка (каждое слово с заглавной буквы)
  // Например: "hello world" -> "Hello World"
  export function titlecase(str: string) {
    // Находим первую букву каждого слова и преобразуем её в верхний регистр
    return str.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  // Форматирует временную метку (timestamp) в локализованное время
  // Принимает число миллисекунд с начала эпохи Unix
  export function time(input: number) {
    const date = new Date(input)
    // Возвращает строку времени в формате локали пользователя
    return date.toLocaleTimeString()
  }

  // Форматирует большие числа с использованием суффиксов K (тысячи) и M (миллионы)
  // Например: 1500 -> "1.5K", 2000000 -> "2.0M"
  export function number(num: number): string {
    if (num >= 1000000) {
      // Миллионы: делим на 1000000 и добавляем суффикс "M"
      return (num / 1000000).toFixed(1) + "M"
    } else if (num >= 1000) {
      // Тысячи: делим на 1000 и добавляем суффикс "K"
      return (num / 1000).toFixed(1) + "K"
    }
    // Числа меньше 1000 возвращаем как есть
    return num.toString()
  }

  // Обрезает строку до указанной длины, добавляя многоточие в конце
  // Например: truncate("Hello World", 8) -> "Hello W…"
  export function truncate(str: string, len: number): string {
    if (str.length <= len) return str
    // Оставляем len-1 символов, чтобы было место для многоточия
    return str.slice(0, len - 1) + "…"
  }

  // Обрезает строку посередине, сохраняя начало и конец
  // Полезно для отображения длинных путей файлов
  // Например: "very_long_filename.txt" -> "very_lon…ename.txt"
  export function truncateMiddle(str: string, maxLength: number = 35): string {
    if (str.length <= maxLength) return str

    const ellipsis = "…"
    // Вычисляем, сколько символов оставить в начале (округляем вверх)
    const keepStart = Math.ceil((maxLength - ellipsis.length) / 2)
    // Вычисляем, сколько символов оставить в конце (округляем вниз)
    const keepEnd = Math.floor((maxLength - ellipsis.length) / 2)

    // Склеиваем начало, многоточие и конец строки
    return str.slice(0, keepStart) + ellipsis + str.slice(-keepEnd)
  }

  // Форматирует строку с учётом множественного числа
  // Шаблон должен содержать "{}" для подстановки числа
  // Например: pluralize(1, "{} file", "{} files") -> "1 file"
  //           pluralize(5, "{} file", "{} files") -> "5 files"
  export function pluralize(count: number, singular: string, plural: string): string {
    // Выбираем шаблон в зависимости от числа
    const template = count === 1 ? singular : plural
    // Заменяем {} на фактическое значение count
    return template.replace("{}", count.toString())
  }
}
