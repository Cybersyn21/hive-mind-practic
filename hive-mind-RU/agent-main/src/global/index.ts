import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"
import path from "path"
import os from "os"

// Имя приложения для использования в директориях XDG
const app = "opencode"

// Формируем пути к директориям согласно стандарту XDG Base Directory
const data = path.join(xdgData!, app)
const cache = path.join(xdgCache!, app)
const config = path.join(xdgConfig!, app)
const state = path.join(xdgState!, app)

// Глобальные пути к директориям приложения
// Использует стандарт XDG Base Directory для размещения файлов приложения
export namespace Global {
  export const Path = {
    home: os.homedir(), // Домашняя директория пользователя
    data, // Директория для данных приложения (~/.local/share/opencode)
    bin: path.join(data, "bin"), // Директория для исполняемых файлов
    log: path.join(data, "log"), // Директория для логов
    cache, // Директория для кэша (~/.cache/opencode)
    config, // Директория для конфигурации (~/.config/opencode)
    state, // Директория для состояния (~/.local/state/opencode)
  } as const
}

// Создаем все необходимые директории при инициализации модуля
await Promise.all([
  fs.mkdir(Global.Path.data, { recursive: true }),
  fs.mkdir(Global.Path.config, { recursive: true }),
  fs.mkdir(Global.Path.state, { recursive: true }),
  fs.mkdir(Global.Path.log, { recursive: true }),
  fs.mkdir(Global.Path.bin, { recursive: true }),
])

// Версия кэша - увеличивается при изменении формата кэша
// При изменении версии весь кэш очищается
const CACHE_VERSION = "9"

// Читаем текущую версию кэша
const version = await Bun.file(path.join(Global.Path.cache, "version"))
  .text()
  .catch(() => "0")

// Если версия кэша устарела, очищаем весь кэш
if (version !== CACHE_VERSION) {
  try {
    const contents = await fs.readdir(Global.Path.cache)
    // Удаляем все файлы и директории из кэша
    await Promise.all(
      contents.map((item) =>
        fs.rm(path.join(Global.Path.cache, item), {
          recursive: true,
          force: true,
        }),
      ),
    )
  } catch (e) {}
  // Записываем новую версию кэша
  await Bun.file(path.join(Global.Path.cache, "version")).write(CACHE_VERSION)
}
