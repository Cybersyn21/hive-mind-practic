import { isDeepEqual } from "remeda"

// Пространство имён для работы с клавиатурными привязками (keybindings)
// Предоставляет парсинг, сравнение и форматирование комбинаций клавиш
export namespace Keybind {
  // Структура, описывающая информацию о клавиатурной комбинации
  // ctrl: зажата ли клавиша Ctrl
  // meta: зажата ли клавиша Alt/Meta/Option
  // shift: зажата ли клавиша Shift
  // leader: используется ли leader-клавиша (как в Vim)
  // name: имя основной клавиши в комбинации
  export type Info = {
    ctrl: boolean
    meta: boolean
    shift: boolean
    leader: boolean
    name: string
  }

  // Сравнивает две клавиатурные комбинации на полное совпадение
  // Использует глубокое сравнение всех полей структуры
  export function match(a: Info, b: Info): boolean {
    return isDeepEqual(a, b)
  }

  // Преобразует информацию о клавиатурной комбинации в читаемую строку
  // Например: {ctrl: true, shift: true, name: "a"} -> "ctrl+shift+a"
  export function toString(info: Info): string {
    const parts: string[] = []

    // Добавляем модификаторы в порядке: ctrl, alt, shift
    if (info.ctrl) parts.push("ctrl")
    if (info.meta) parts.push("alt")
    if (info.shift) parts.push("shift")
    if (info.name) {
      // Специальная обработка клавиши delete -> del для краткости
      if (info.name === "delete") parts.push("del")
      else parts.push(info.name)
    }

    // Объединяем части через "+"
    let result = parts.join("+")

    // Если используется leader-клавиша, добавляем её в начало
    if (info.leader) {
      result = result ? `<leader> ${result}` : `<leader>`
    }

    return result
  }

  // Парсит строку с клавиатурной комбинацией в структурированный формат
  // Поддерживает несколько комбинаций, разделённых запятыми
  // Примеры: "ctrl+a", "ctrl+shift+p", "<leader> g d"
  export function parse(key: string): Info[] {
    // "none" означает отсутствие привязки
    if (key === "none") return []

    // Разделяем по запятым для поддержки множественных комбинаций
    return key.split(",").map((combo) => {
      // Нормализуем синтаксис <leader> в leader+
      const normalized = combo.replace(/<leader>/g, "leader+")
      // Разбиваем на части по "+" и приводим к нижнему регистру
      const parts = normalized.toLowerCase().split("+")
      const info: Info = {
        ctrl: false,
        meta: false,
        shift: false,
        leader: false,
        name: "",
      }

      // Обрабатываем каждую часть комбинации
      for (const part of parts) {
        switch (part) {
          case "ctrl":
            info.ctrl = true
            break
          case "alt":
          case "meta":
          case "option":
            // Все эти варианты обозначают одну и ту же клавишу-модификатор
            info.meta = true
            break
          case "shift":
            info.shift = true
            break
          case "leader":
            info.leader = true
            break
          case "esc":
            // Нормализуем "esc" в полное название "escape"
            info.name = "escape"
            break
          default:
            // Всё остальное - это имя основной клавиши
            info.name = part
            break
        }
      }

      return info
    })
  }
}
