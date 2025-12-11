import { exists } from "fs/promises"
import { dirname, join, relative } from "path"

export namespace Filesystem {
  // Проверяет, перекрываются ли два пути - то есть содержит ли один из них другой
  // Возвращает true если пути имеют общую часть (один содержит другой)
  export function overlaps(a: string, b: string) {
    const relA = relative(a, b)
    const relB = relative(b, a)
    return !relA || !relA.startsWith("..") || !relB || !relB.startsWith("..")
  }

  // Проверяет, содержит ли путь parent путь child
  // Возвращает true если child находится внутри parent
  export function contains(parent: string, child: string) {
    return !relative(parent, child).startsWith("..")
  }

  // Ищет файл или папку target, начиная от start и двигаясь вверх по дереву директорий
  // Возвращает массив всех найденных путей (до stop или корня)
  // Полезно для поиска конфигурационных файлов
  export async function findUp(target: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      const search = join(current, target)
      if (await exists(search)) result.push(search)
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  // Асинхронный генератор, ищет несколько целей одновременно, двигаясь вверх по дереву
  // Выдает найденные пути по одному (first match wins)
  // Эффективнее чем несколько вызовов findUp
  export async function* up(options: { targets: string[]; start: string; stop?: string }) {
    const { targets, start, stop } = options
    let current = start
    while (true) {
      for (const target of targets) {
        const search = join(current, target)
        if (await exists(search)) yield search
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }

  // Ищет файлы по glob pattern, начиная от start и двигаясь вверх по дереву директорий
  // Собирает все совпадения из всех директорий в один массив
  // Обрабатывает ошибки паттернов gracefully
  export async function globUp(pattern: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      try {
        const glob = new Bun.Glob(pattern)
        for await (const match of glob.scan({
          cwd: current,
          absolute: true,
          onlyFiles: true,
          followSymlinks: true,
          dot: true,
        })) {
          result.push(match)
        }
      } catch {
        // Пропускаем недействительные glob паттерны
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }
}
