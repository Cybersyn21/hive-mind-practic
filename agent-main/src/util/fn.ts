import { z } from "zod"

// Создает функцию с автоматической валидацией входных параметров через Zod схему
// schema - Zod схема для валидации входных данных
// cb - функция обработчик которая будет вызвана с валидированными данными
// Возвращает обернутую функцию с дополнительными свойствами force и schema
export function fn<T extends z.ZodType, Result>(schema: T, cb: (input: z.infer<T>) => Result) {
  // Основная функция с автоматической валидацией
  const result = (input: z.infer<T>) => {
    // Парсим и валидируем входные данные согласно схеме
    const parsed = schema.parse(input)
    return cb(parsed)
  }
  // Метод для пропуска валидации (использовать с осторожностью)
  result.force = (input: z.infer<T>) => cb(input)
  // Сохраняем схему для возможности её использования извне
  result.schema = schema
  return result
}
