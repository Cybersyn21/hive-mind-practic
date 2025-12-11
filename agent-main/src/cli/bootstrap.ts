import { InstanceBootstrap } from "../project/bootstrap"
import { Instance } from "../project/instance"

// Функция инициализации для CLI команд
// Создает инстанс проекта, выполняет callback и обеспечивает корректную очистку ресурсов
export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  return Instance.provide({
    directory, // Рабочая директория проекта
    init: InstanceBootstrap, // Функция инициализации инстанса
    fn: async () => {
      try {
        const result = await cb()
        return result
      } finally {
        // Гарантируем очистку ресурсов инстанса даже при ошибках
        await Instance.dispose()
      }
    },
  })
}
