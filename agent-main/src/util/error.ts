import z from "zod"

// Базовый класс для типизированных ошибок с Zod валидацией
// Позволяет создавать именованные ошибки с типом данных и схемой валидации
export abstract class NamedError extends Error {
  // Возвращает Zod схему для валидации ошибки
  abstract schema(): z.core.$ZodType
  // Конвертирует ошибку в объект с названием и данными
  abstract toObject(): { name: string; data: any }

  // Фабрика для создания новых типов ошибок с типобезопасностью
  // Генерирует класс ошибки с валидацией данных по схеме
  static create<Name extends string, Data extends z.core.$ZodType>(name: Name, data: Data) {
    // Zod схема для валидации структуры ошибки
    const schema = z
      .object({
        name: z.literal(name),
        data,
      })
      .meta({
        ref: name,
      })

    // Динамически создаваемый класс ошибки
    const result = class extends NamedError {
      // Статическая ссылка на Zod схему для внешней валидации
      public static readonly Schema = schema

      // Имя ошибки
      public override readonly name = name as Name

      // Конструктор принимает типизированные данные ошибки
      constructor(
        public readonly data: z.input<Data>,
        options?: ErrorOptions,
      ) {
        super(name, options)
        this.name = name
      }

      // Проверяет является ли значение экземпляром этого типа ошибки
      static isInstance(input: any): input is InstanceType<typeof result> {
        return typeof input === "object" && "name" in input && input.name === name
      }

      // Возвращает Zod схему этого типа ошибки
      schema() {
        return schema
      }

      // Сериализует ошибку в объект для передачи/логирования
      toObject() {
        return {
          name: name,
          data: this.data,
        }
      }
    }
    // Устанавливает правильное имя класса для отладки
    Object.defineProperty(result, "name", { value: name })
    return result
  }

  // Ошибка-заглушка для неизвестных ошибок, которые не соответствуют специфичным типам
  public static readonly Unknown = NamedError.create(
    "UnknownError",
    z.object({
      message: z.string(),
    }),
  )
}
