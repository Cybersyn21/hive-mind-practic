// Функция для получения данных о моделях из models.dev API
// Сначала проверяет наличие локального файла (для разработки),
// затем загружает с удаленного API
export async function data() {
  // Проверяем переменную окружения для локальной версии API
  const path = Bun.env.MODELS_DEV_API_JSON
  if (path) {
    const file = Bun.file(path)
    if (await file.exists()) {
      return await file.text()
    }
  }
  // Загружаем данные с удаленного API models.dev
  const json = await fetch("https://models.dev/api.json").then((x) => x.text())
  return json
}
