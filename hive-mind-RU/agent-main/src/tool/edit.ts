// the approaches in this edit tool are sourced from
// https://github.com/cline/cline/blob/main/evals/diff-edits/diff-apply/diff-06-23-25.ts
// https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/utils/editCorrector.ts
// https://github.com/cline/cline/blob/main/evals/diff-edits/diff-apply/diff-06-26-25.ts

// Инструмент Edit позволяет заменять текст в файлах с использованием различных стратегий поиска
// для обеспечения гибкого и надежного редактирования. Включает поддержку множественных
// замен, нормализацию пробелов, работу с отступами и другие продвинутые возможности.

import z from "zod"
import * as path from "path"
import { Tool } from "./tool"
import { createTwoFilesPatch, diffLines } from "diff"
import DESCRIPTION from "./edit.txt"
import { File } from "../file"
import { Bus } from "../bus"
import { FileTime } from "../file/time"
import { Instance } from "../project/instance"
import { Snapshot } from "../snapshot"

// Нормализует окончания строк, преобразуя все CRLF (\r\n) в LF (\n)
// для обеспечения консистентности при работе с файлами из разных ОС
function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n")
}

// Основной инструмент редактирования файлов с поддержкой:
// - Простой замены текста (SimpleReplacer)
// - Замены с учетом отступов (LineTrimmedReplacer, BlockAnchorReplacer)
// - Гибкой замены с нормализацией пробелов и экранирования
// - Множественной замены через replaceAll параметр
export const EditTool = Tool.define("edit", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z.string().describe("The text to replace it with (must be different from oldString)"),
    replaceAll: z.boolean().optional().describe("Replace all occurrences of oldString (default false)"),
  }),
  async execute(params, ctx) {
    if (!params.filePath) {
      throw new Error("filePath is required")
    }

    if (params.oldString === params.newString) {
      throw new Error("oldString and newString must be different")
    }

    // No restrictions - unrestricted file editing
    const filePath = path.isAbsolute(params.filePath) ? params.filePath : path.join(Instance.directory, params.filePath)

    let diff = ""
    let contentOld = ""
    let contentNew = ""
    await (async () => {
      if (params.oldString === "") {
        contentNew = params.newString
        diff = trimDiff(createTwoFilesPatch(filePath, filePath, contentOld, contentNew))
        await Bun.write(filePath, params.newString)
        await Bus.publish(File.Event.Edited, {
          file: filePath,
        })
        return
      }

      const file = Bun.file(filePath)
      const stats = await file.stat().catch(() => {})
      if (!stats) throw new Error(`File ${filePath} not found`)
      if (stats.isDirectory()) throw new Error(`Path is a directory, not a file: ${filePath}`)
      await FileTime.assert(ctx.sessionID, filePath)
      contentOld = await file.text()
      contentNew = replace(contentOld, params.oldString, params.newString, params.replaceAll)

      diff = trimDiff(
        createTwoFilesPatch(filePath, filePath, normalizeLineEndings(contentOld), normalizeLineEndings(contentNew)),
      )

      await file.write(contentNew)
      await Bus.publish(File.Event.Edited, {
        file: filePath,
      })
      contentNew = await file.text()
      diff = trimDiff(
        createTwoFilesPatch(filePath, filePath, normalizeLineEndings(contentOld), normalizeLineEndings(contentNew)),
      )
    })()

    FileTime.read(ctx.sessionID, filePath)

    let output = ""
    const diagnostics = {}

    const filediff: Snapshot.FileDiff = {
      file: filePath,
      before: contentOld,
      after: contentNew,
      additions: 0,
      deletions: 0,
    }
    for (const change of diffLines(contentOld, contentNew)) {
      if (change.added) filediff.additions += change.count || 0
      if (change.removed) filediff.deletions += change.count || 0
    }

    return {
      metadata: {
        diagnostics,
        diff,
        filediff,
      },
      title: `${path.relative(Instance.worktree, filePath)}`,
      output,
    }
  },
})

// Тип функции-заменителя (Replacer), которая генерирует возможные варианты замены текста
// Используется для реализации различных стратегий поиска и замены
export type Replacer = (content: string, find: string) => Generator<string, void, unknown>

// Пороги подобия для определения наиболее подходящего блока при наличии нескольких кандидатов
// SINGLE_CANDIDATE_SIMILARITY_THRESHOLD - порог для одного кандидата (более мягкий)
// MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD - порог при наличии нескольких кандидатов (более строгий)
const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD = 0.0
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD = 0.3

/**
 * Реализация алгоритма расстояния Левенштейна
 * Вычисляет минимальное количество одноэлементных правок (вставки, удаления, замены)
 * необходимых для преобразования одной строки в другую
 */
function levenshtein(a: string, b: string): number {
  // Обработка пустых строк - расстояние равно длине непустой строки
  if (a === "" || b === "") {
    return Math.max(a.length, b.length)
  }
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[a.length][b.length]
}

// SimpleReplacer - самая простая стратегия: возвращает ровно то, что ищется
// Используется как первый вариант для точного совпадения
export const SimpleReplacer: Replacer = function* (_content, find) {
  yield find
}

// LineTrimmedReplacer - ищет блоки кода игнорируя ведущие/замыкающие пробелы на каждой строке
// Полезен при несовпадении отступов между искомым и имеющимся текстом
export const LineTrimmedReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n")
  const searchLines = find.split("\n")

  // Удаляем пустую последнюю строку если она есть
  if (searchLines[searchLines.length - 1] === "") {
    searchLines.pop()
  }

  // Перебираем все возможные позиции начала блока
  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true

    // Проверяем совпадение всех строк блока с обрезанным текстом
    for (let j = 0; j < searchLines.length; j++) {
      const originalTrimmed = originalLines[i + j].trim()
      const searchTrimmed = searchLines[j].trim()

      if (originalTrimmed !== searchTrimmed) {
        matches = false
        break
      }
    }

    if (matches) {
      // Вычисляем начальный индекс найденного блока в содержимом файла
      let matchStartIndex = 0
      for (let k = 0; k < i; k++) {
        matchStartIndex += originalLines[k].length + 1
      }

      // Вычисляем конечный индекс найденного блока
      let matchEndIndex = matchStartIndex
      for (let k = 0; k < searchLines.length; k++) {
        matchEndIndex += originalLines[i + k].length
        if (k < searchLines.length - 1) {
          matchEndIndex += 1 // Добавляем символ новой строки кроме последней строки
        }
      }

      // Возвращаем найденный блок с сохранением оригинального форматирования
      yield content.substring(matchStartIndex, matchEndIndex)
    }
  }
}

// BlockAnchorReplacer - ищет блоки по якорям (первая и последняя строка)
// Использует алгоритм Левенштейна для определения наиболее подходящего блока
// при наличии нескольких кандидатов с похожими якорями
export const BlockAnchorReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n")
  const searchLines = find.split("\n")

  // Требуется минимум 3 строки для использования блочного якорного подхода
  if (searchLines.length < 3) {
    return
  }

  // Удаляем пустую последнюю строку если она есть
  if (searchLines[searchLines.length - 1] === "") {
    searchLines.pop()
  }

  // Сохраняем якоря - первую и последнюю строки для поиска блока
  const firstLineSearch = searchLines[0].trim()
  const lastLineSearch = searchLines[searchLines.length - 1].trim()
  const searchBlockSize = searchLines.length

  // Собираем все позиции-кандидаты где совпадают оба якоря
  const candidates: Array<{ startLine: number; endLine: number }> = []
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== firstLineSearch) {
      continue
    }

    // Look for the matching last line after this first line
    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === lastLineSearch) {
        candidates.push({ startLine: i, endLine: j })
        break // Only match the first occurrence of the last line
      }
    }
  }

  // Return immediately if no candidates
  if (candidates.length === 0) {
    return
  }

  // Обработка сценария с одним кандидатом (используем более мягкий порог)
  if (candidates.length === 1) {
    const { startLine, endLine } = candidates[0]
    const actualBlockSize = endLine - startLine + 1

    // Вычисляем подобие блоков используя расстояние Левенштейна
    let similarity = 0
    // Проверяем только средние строки, исключая якоры
    let linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)

    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim()
        const searchLine = searchLines[j].trim()
        const maxLen = Math.max(originalLine.length, searchLine.length)
        if (maxLen === 0) {
          continue
        }
        const distance = levenshtein(originalLine, searchLine)
        similarity += (1 - distance / maxLen) / linesToCheck

        // Exit early when threshold is reached
        if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
          break
        }
      }
    } else {
      // Нет средних строк для сравнения, принимаем блок на основе якорей
      similarity = 1.0
    }

    // Проверяем достигнут ли порог подобия
    if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
      // Вычисляем индексы найденного блока
      let matchStartIndex = 0
      for (let k = 0; k < startLine; k++) {
        matchStartIndex += originalLines[k].length + 1
      }
      let matchEndIndex = matchStartIndex
      for (let k = startLine; k <= endLine; k++) {
        matchEndIndex += originalLines[k].length
        if (k < endLine) {
          matchEndIndex += 1 // Добавляем символ новой строки кроме последней
        }
      }
      yield content.substring(matchStartIndex, matchEndIndex)
    }
    return
  }

  // Вычисляем подобие для каждого кандидата и выбираем лучший
  let bestMatch: { startLine: number; endLine: number } | null = null
  let maxSimilarity = -1

  // Перебираем всех кандидатов и находим наиболее подходящий
  for (const candidate of candidates) {
    const { startLine, endLine } = candidate
    const actualBlockSize = endLine - startLine + 1

    // Вычисляем средний показатель подобия средних строк
    let similarity = 0
    // Проверяем только средние строки, исключая якоры
    let linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)

    if (linesToCheck > 0) {
      // Суммируем подобие для каждой средней строки
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim()
        const searchLine = searchLines[j].trim()
        const maxLen = Math.max(originalLine.length, searchLine.length)
        if (maxLen === 0) {
          continue
        }
        const distance = levenshtein(originalLine, searchLine)
        similarity += 1 - distance / maxLen
      }
      // Вычисляем среднее подобие
      similarity /= linesToCheck
    } else {
      // Нет средних строк для сравнения, принимаем блок на основе якорей
      similarity = 1.0
    }

    // Запоминаем кандидата с максимальным подобием
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity
      bestMatch = candidate
    }
  }

  // Проверяем прошел ли лучший кандидат строгий порог
  if (maxSimilarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD && bestMatch) {
    const { startLine, endLine } = bestMatch
    // Вычисляем индексы найденного блока
    let matchStartIndex = 0
    for (let k = 0; k < startLine; k++) {
      matchStartIndex += originalLines[k].length + 1
    }
    let matchEndIndex = matchStartIndex
    for (let k = startLine; k <= endLine; k++) {
      matchEndIndex += originalLines[k].length
      if (k < endLine) {
        matchEndIndex += 1
      }
    }
    yield content.substring(matchStartIndex, matchEndIndex)
  }
}

// WhitespaceNormalizedReplacer - нормализует все пробелы (множественные пробелы -> один)
// Полезен когда форматирование отличается по количеству пробелов
export const WhitespaceNormalizedReplacer: Replacer = function* (content, find) {
  // Функция нормализации: заменяет множественные пробелы на один и обрезает края
  const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim()
  const normalizedFind = normalizeWhitespace(find)

  // Обработка совпадений на одной строке
  const lines = content.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (normalizeWhitespace(line) === normalizedFind) {
      yield line
    } else {
      // Only check for substring matches if the full line doesn't match
      const normalizedLine = normalizeWhitespace(line)
      if (normalizedLine.includes(normalizedFind)) {
        // Find the actual substring in the original line that matches
        const words = find.trim().split(/\s+/)
        if (words.length > 0) {
          const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+")
          try {
            const regex = new RegExp(pattern)
            const match = line.match(regex)
            if (match) {
              yield match[0]
            }
          } catch (e) {
            // Invalid regex pattern, skip
          }
        }
      }
    }
  }

  // Обработка многострочных совпадений
  const findLines = find.split("\n")
  if (findLines.length > 1) {
    // Проверяем все возможные блоки нужного размера
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length)
      if (normalizeWhitespace(block.join("\n")) === normalizedFind) {
        yield block.join("\n")
      }
    }
  }
}

// IndentationFlexibleReplacer - удаляет общий отступ из всех строк перед сравнением
// Позволяет находить блоки независимо от уровня отступа
export const IndentationFlexibleReplacer: Replacer = function* (content, find) {
  // Вспомогательная функция для удаления общего минимального отступа из текста
  const removeIndentation = (text: string) => {
    const lines = text.split("\n")
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
    // Если нет непустых строк, возвращаем исходный текст
    if (nonEmptyLines.length === 0) return text

    // Находим минимальный отступ среди всех непустых строк
    const minIndent = Math.min(
      ...nonEmptyLines.map((line) => {
        const match = line.match(/^(\s*)/)
        return match ? match[1].length : 0
      }),
    )

    // Удаляем минимальный отступ из всех строк, сохраняя пустые строки
    return lines.map((line) => (line.trim().length === 0 ? line : line.slice(minIndent))).join("\n")
  }

  // Нормализуем искомый текст удалением отступов
  const normalizedFind = removeIndentation(find)
  const contentLines = content.split("\n")
  const findLines = find.split("\n")

  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const block = contentLines.slice(i, i + findLines.length).join("\n")
    if (removeIndentation(block) === normalizedFind) {
      yield block
    }
  }
}

// EscapeNormalizedReplacer - обрабатывает экранированные символы в поиске
// Полезен когда в строке поиска присутствуют специальные символы с обратным слэшом
export const EscapeNormalizedReplacer: Replacer = function* (content, find) {
  // Функция для преобразования экранированных символов в их реальные представления
  const unescapeString = (str: string): string => {
    // Обрабатываем общие escape-последовательности
    return str.replace(/\\(n|t|r|'|"|`|\\|\n|\$)/g, (match, capturedChar) => {
      switch (capturedChar) {
        case "n":
          return "\n"
        case "t":
          return "\t"
        case "r":
          return "\r"
        case "'":
          return "'"
        case '"':
          return '"'
        case "`":
          return "`"
        case "\\":
          return "\\"
        case "\n":
          return "\n"
        case "$":
          return "$"
        default:
          return match
      }
    })
  }

  // Преобразуем экранированные символы в искомой строке
  const unescapedFind = unescapeString(find)

  // Попытка прямого совпадения с раскодированной строкой
  if (content.includes(unescapedFind)) {
    yield unescapedFind
  }

  // Также ищем экранированные версии в содержимом, которые совпадают с раскодированным поиском
  const lines = content.split("\n")
  const findLines = unescapedFind.split("\n")

  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join("\n")
    const unescapedBlock = unescapeString(block)

    if (unescapedBlock === unescapedFind) {
      yield block
    }
  }
}

// MultiOccurrenceReplacer - находит все точные совпадения строки в содержимом
// Используется в заключение после других стратегий для обработки множественных замен
export const MultiOccurrenceReplacer: Replacer = function* (content, find) {
  // Этот заменитель возвращает все точные совпадения
  // Функция replace может обрабатывать множественные вхождения на основе replaceAll
  let startIndex = 0

  // Ищем все вхождения строки в содержимом
  while (true) {
    const index = content.indexOf(find, startIndex)
    if (index === -1) break

    yield find
    startIndex = index + find.length
  }
}

// TrimmedBoundaryReplacer - ищет текст после обрезания пробелов по краям
// Помогает находить блоки когда вокруг них есть дополнительные пробелы
export const TrimmedBoundaryReplacer: Replacer = function* (content, find) {
  const trimmedFind = find.trim()

  // Если текст уже обрезан, нет смысла это применять
  if (trimmedFind === find) {
    return
  }

  // Пытаемся найти обрезанную версию в содержимом
  if (content.includes(trimmedFind)) {
    yield trimmedFind
  }

  // Также ищем блоки где обрезанное содержимое совпадает
  const lines = content.split("\n")
  const findLines = find.split("\n")

  // Проверяем все возможные блоки нужного размера
  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join("\n")

    if (block.trim() === trimmedFind) {
      yield block
    }
  }
}

// ContextAwareReplacer - ищет блоки на основе контекста (первая и последняя строка)
// и проверяет совпадение содержимого между якорями на основе 50% подобия
export const ContextAwareReplacer: Replacer = function* (content, find) {
  const findLines = find.split("\n")
  // Нужна хотя бы 3 строки для использования контекстного подхода
  if (findLines.length < 3) {
    return
  }

  // Удаляем пустую последнюю строку если она есть
  if (findLines[findLines.length - 1] === "") {
    findLines.pop()
  }

  const contentLines = content.split("\n")

  // Извлекаем первую и последнюю строку как контекстные якоря
  const firstLine = findLines[0].trim()
  const lastLine = findLines[findLines.length - 1].trim()

  // Ищем блоки которые начинаются и заканчиваются с контекстными якорями
  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].trim() !== firstLine) continue

    // Ищем соответствующую последнюю строку
    for (let j = i + 2; j < contentLines.length; j++) {
      if (contentLines[j].trim() === lastLine) {
        // Найден потенциальный контекстный блок
        const blockLines = contentLines.slice(i, j + 1)
        const block = blockLines.join("\n")

        // Проверяем подобие содержимого между якорями
        // Эвристика: минимум 50% непустых строк должны совпадать после обрезания
        if (blockLines.length === findLines.length) {
          // Подсчитываем совпадающие строки между якорями
          let matchingLines = 0
          let totalNonEmptyLines = 0

          // Проверяем все средние строки (исключая якоры)
          for (let k = 1; k < blockLines.length - 1; k++) {
            const blockLine = blockLines[k].trim()
            const findLine = findLines[k].trim()

            // Считаем только непустые строки
            if (blockLine.length > 0 || findLine.length > 0) {
              totalNonEmptyLines++
              if (blockLine === findLine) {
                matchingLines++
              }
            }
          }

          // Принимаем блок если нет строк для проверки или достаточно совпадений (50%+)
          if (totalNonEmptyLines === 0 || matchingLines / totalNonEmptyLines >= 0.5) {
            yield block
            break // Ищем только первое совпадение
          }
        }
        break
      }
    }
  }
}

// Удаляет общий отступ из всех строк разновидности (diff)
// для улучшения читаемости вывода diff и уменьшения его размера
export function trimDiff(diff: string): string {
  const lines = diff.split("\n")
  // Фильтруем строки которые содержат изменения (добавлены, удалены или без изменений)
  const contentLines = lines.filter(
    (line) =>
      (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
      !line.startsWith("---") &&
      !line.startsWith("+++"),
  )

  // Если нет строк содержимого, возвращаем исходный diff
  if (contentLines.length === 0) return diff

  // Находим минимальный отступ среди всех строк изменений
  let min = Infinity
  for (const line of contentLines) {
    const content = line.slice(1) // Удаляем префикс изменения (+/-/пробел)
    if (content.trim().length > 0) {
      const match = content.match(/^(\s*)/)
      if (match) min = Math.min(min, match[1].length)
    }
  }

  // Если нет отступа для удаления, возвращаем исходный diff
  if (min === Infinity || min === 0) return diff

  // Удаляем найденный минимальный отступ из всех строк
  const trimmedLines = lines.map((line) => {
    if (
      (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) &&
      !line.startsWith("---") &&
      !line.startsWith("+++")
    ) {
      const prefix = line[0]
      const content = line.slice(1)
      return prefix + content.slice(min)
    }
    return line
  })

  return trimmedLines.join("\n")
}

// Основная функция замены, применяет различные стратегии поиска в определенном порядке
// Перебирает разные типы заменителей (replacers) для нахождения оптимального совпадения
export function replace(content: string, oldString: string, newString: string, replaceAll = false): string {
  if (oldString === newString) {
    throw new Error("oldString and newString must be different")
  }

  let notFound = true

  // Стратегии применяются в порядке: от простых к сложным
  // Каждая следующая стратегия обработает то, что не нашла предыдущая
  for (const replacer of [
    SimpleReplacer,                      // Точное совпадение
    LineTrimmedReplacer,                 // Совпадение с игнорированием пробелов на краях строк
    BlockAnchorReplacer,                 // Поиск по якорям с проверкой подобия
    WhitespaceNormalizedReplacer,        // Нормализация всех пробелов
    IndentationFlexibleReplacer,         // Гибкая работа с отступами
    EscapeNormalizedReplacer,            // Обработка экранированных символов
    TrimmedBoundaryReplacer,             // Обрезание по краям блока
    ContextAwareReplacer,                // Контекстный поиск на основе якорей
    MultiOccurrenceReplacer,             // Все точные совпадения (резервный вариант)
  ]) {
    // Пытаемся найти совпадение используя текущую стратегию
    for (const search of replacer(content, oldString)) {
      const index = content.indexOf(search)
      if (index === -1) continue
      notFound = false

      // Если указана множественная замена, заменяем все вхождения
      if (replaceAll) {
        return content.replaceAll(search, newString)
      }

      // Проверяем что это единственное совпадение (не множественное)
      const lastIndex = content.lastIndexOf(search)
      if (index !== lastIndex) continue // Пропускаем если есть множественные вхождения

      // Производим замену в найденной позиции
      return content.substring(0, index) + newString + content.substring(index + search.length)
    }
  }

  // Обработка ошибок при невозможности найти текст
  if (notFound) {
    throw new Error("oldString not found in content")
  }
  throw new Error(
    "Found multiple matches for oldString. Provide more surrounding lines in oldString to identify the correct match.",
  )
}
