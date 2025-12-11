import z from "zod"
import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import { NamedError } from "../util/error"
import { readableStreamToText } from "bun"

// Модуль для работы с процессами Bun (установка пакетов, запуск команд)
export namespace BunProc {
  const log = Log.create({ service: "bun" })

  // Запустить Bun команду с переданными аргументами
  // Возвращает результат выполнения или выбрасывает ошибку при ненулевом коде выхода
  export async function run(cmd: string[], options?: Bun.SpawnOptions.OptionsObject<any, any, any>) {
    log.info("running", {
      cmd: [which(), ...cmd],
      ...options,
    })
    // Запускаем процесс Bun с перенаправлением потоков вывода
    const result = Bun.spawn([which(), ...cmd], {
      ...options,
      stdout: "pipe", // Перехватываем stdout для логирования
      stderr: "pipe", // Перехватываем stderr для обработки ошибок
      env: {
        ...process.env,
        ...options?.env,
        BUN_BE_BUN: "1", // Флаг для внутренних операций Bun
      },
    })
    const code = await result.exited
    // Преобразуем потоки в текст, если они не являются дескрипторами файлов
    const stdout = result.stdout
      ? typeof result.stdout === "number"
        ? result.stdout
        : await readableStreamToText(result.stdout)
      : undefined
    const stderr = result.stderr
      ? typeof result.stderr === "number"
        ? result.stderr
        : await readableStreamToText(result.stderr)
      : undefined
    log.info("done", {
      code,
      stdout,
      stderr,
    })
    if (code !== 0) {
      throw new Error(`Command failed with exit code ${result.exitCode}`)
    }
    return result
  }

  // Получить путь к исполняемому файлу Bun
  // Возвращает текущий execPath процесса
  export function which() {
    return process.execPath
  }

  // Ошибка при неудачной установке пакета
  export const InstallFailedError = NamedError.create(
    "BunInstallFailedError",
    z.object({
      pkg: z.string(), // Имя пакета
      version: z.string(), // Версия пакета
    }),
  )

  // Установить npm пакет используя Bun
  // Устанавливает пакет в кеш-директорию и возвращает путь к node_modules пакета
  // Если пакет уже установлен с нужной версией, пропускает установку
  export async function install(pkg: string, version = "latest") {
    const mod = path.join(Global.Path.cache, "node_modules", pkg)
    const pkgjson = Bun.file(path.join(Global.Path.cache, "package.json"))
    // Читаем или создаем package.json в кеше
    const parsed = await pkgjson.json().catch(async () => {
      const result = { dependencies: {} }
      await Bun.write(pkgjson.name!, JSON.stringify(result, null, 2))
      return result
    })
    // Проверяем, уже ли установлена нужная версия
    if (parsed.dependencies[pkg] === version) return mod

    // Формируем аргументы команды для bun add
    const args = ["add", "--force", "--exact", "--cwd", Global.Path.cache, pkg + "@" + version]

    // Позволяем Bun самостоятельно определить registry:
    // - Если существует .npmrc файл, Bun использует его автоматически
    // - Если нет .npmrc, Bun использует https://registry.npmjs.org по умолчанию
    // - Нет необходимости передавать флаг --registry
    log.info("installing package using Bun's default registry resolution", {
      pkg,
      version,
    })

    // Запускаем установку пакета
    await BunProc.run(args, {
      cwd: Global.Path.cache,
    }).catch((e) => {
      throw new InstallFailedError(
        { pkg, version },
        {
          cause: e,
        },
      )
    })
    // Обновляем package.json с новой зависимостью
    parsed.dependencies[pkg] = version
    await Bun.write(pkgjson.name!, JSON.stringify(parsed, null, 2))
    return mod
  }
}
