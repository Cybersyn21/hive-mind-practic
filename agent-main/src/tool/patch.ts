import z from "zod"
import * as path from "path"
import * as fs from "fs/promises"
import { Tool } from "./tool"
import { FileTime } from "../file/time"
import { Bus } from "../bus"
import { FileWatcher } from "../file/watcher"
import { Instance } from "../project/instance"
import { Patch } from "../patch"
import { Filesystem } from "../util/filesystem"
import { createTwoFilesPatch } from "diff"

// Схема параметров для инструмента применения патчей
const PatchParams = z.object({
  patchText: z.string().describe("The full patch text that describes all changes to be made"), // Полный текст патча
})

// Инструмент для применения патчей к множественным файлам
// Поддерживает добавление, обновление и удаление файлов с учетом контекста
export const PatchTool = Tool.define("patch", {
  description:
    "Apply a patch to modify multiple files. Supports adding, updating, and deleting files with context-aware changes.",
  parameters: PatchParams,
  async execute(params, ctx) {
    if (!params.patchText) {
      throw new Error("patchText is required")
    }

    // Парсим патч для получения блоков изменений (hunks)
    // Parse the patch to get hunks
    let hunks: Patch.Hunk[]
    try {
      const parseResult = Patch.parsePatch(params.patchText)
      hunks = parseResult.hunks
    } catch (error) {
      throw new Error(`Failed to parse patch: ${error}`)
    }

    if (hunks.length === 0) {
      throw new Error("No file changes found in patch")
    }

    // Без ограничений - неограниченное применение патчей
    // No restrictions - unrestricted patching
    const fileChanges: Array<{
      filePath: string // Путь к файлу
      oldContent: string // Старое содержимое
      newContent: string // Новое содержимое
      type: "add" | "update" | "delete" | "move" // Тип операции
      movePath?: string // Путь назначения при перемещении
    }> = []

    let totalDiff = ""

    // Обрабатываем каждый блок изменений
    for (const hunk of hunks) {
      const filePath = path.resolve(Instance.directory, hunk.path)

      switch (hunk.type) {
        case "add":
          // Добавление нового файла
          if (hunk.type === "add") {
            const oldContent = ""
            const newContent = hunk.contents
            const diff = createTwoFilesPatch(filePath, filePath, oldContent, newContent)

            fileChanges.push({
              filePath,
              oldContent,
              newContent,
              type: "add",
            })

            totalDiff += diff + "\n"
          }
          break

        case "update":
          // Обновление существующего файла
          // Проверяем существование файла
          // Check if file exists for update
          const stats = await fs.stat(filePath).catch(() => null)
          if (!stats || stats.isDirectory()) {
            throw new Error(`File not found or is directory: ${filePath}`)
          }

          // Читаем файл и обновляем отслеживание времени (как в инструменте редактирования)
          // Read file and update time tracking (like edit tool does)
          await FileTime.assert(ctx.sessionID, filePath)
          const oldContent = await fs.readFile(filePath, "utf-8")
          let newContent = oldContent

          // Применяем блоки обновлений для получения нового содержимого
          // Apply the update chunks to get new content
          try {
            const fileUpdate = Patch.deriveNewContentsFromChunks(filePath, hunk.chunks)
            newContent = fileUpdate.content
          } catch (error) {
            throw new Error(`Failed to apply update to ${filePath}: ${error}`)
          }

          const diff = createTwoFilesPatch(filePath, filePath, oldContent, newContent)

          fileChanges.push({
            filePath,
            oldContent,
            newContent,
            type: hunk.move_path ? "move" : "update",
            movePath: hunk.move_path ? path.resolve(Instance.directory, hunk.move_path) : undefined,
          })

          totalDiff += diff + "\n"
          break

        case "delete":
          // Удаление файла
          // Проверяем существование файла для удаления
          // Check if file exists for deletion
          await FileTime.assert(ctx.sessionID, filePath)
          const contentToDelete = await fs.readFile(filePath, "utf-8")
          const deleteDiff = createTwoFilesPatch(filePath, filePath, contentToDelete, "")

          fileChanges.push({
            filePath,
            oldContent: contentToDelete,
            newContent: "",
            type: "delete",
          })

          totalDiff += deleteDiff + "\n"
          break
      }
    }

    // Без ограничений - применяем изменения напрямую
    // No restrictions - apply changes directly
    // Применяем изменения
    // Apply the changes
    const changedFiles: string[] = []

    for (const change of fileChanges) {
      switch (change.type) {
        case "add":
          // Создаем родительские директории
          // Create parent directories
          const addDir = path.dirname(change.filePath)
          if (addDir !== "." && addDir !== "/") {
            await fs.mkdir(addDir, { recursive: true })
          }
          await fs.writeFile(change.filePath, change.newContent, "utf-8")
          changedFiles.push(change.filePath)
          break

        case "update":
          // Обновляем содержимое файла
          await fs.writeFile(change.filePath, change.newContent, "utf-8")
          changedFiles.push(change.filePath)
          break

        case "move":
          // Перемещаем файл
          if (change.movePath) {
            // Создаем родительские директории для места назначения
            // Create parent directories for destination
            const moveDir = path.dirname(change.movePath)
            if (moveDir !== "." && moveDir !== "/") {
              await fs.mkdir(moveDir, { recursive: true })
            }
            // Записываем в новое место
            // Write to new location
            await fs.writeFile(change.movePath, change.newContent, "utf-8")
            // Удаляем оригинал
            // Remove original
            await fs.unlink(change.filePath)
            changedFiles.push(change.movePath)
          }
          break

        case "delete":
          // Удаляем файл
          await fs.unlink(change.filePath)
          changedFiles.push(change.filePath)
          break
      }

      // Обновляем отслеживание времени файлов
      // Update file time tracking
      FileTime.read(ctx.sessionID, change.filePath)
      if (change.movePath) {
        FileTime.read(ctx.sessionID, change.movePath)
      }
    }

    // Публикуем события об изменении файлов
    // Publish file change events
    for (const filePath of changedFiles) {
      await Bus.publish(FileWatcher.Event.Updated, { file: filePath, event: "change" })
    }

    // Генерируем сводку результатов
    // Generate output summary
    const relativePaths = changedFiles.map((filePath) => path.relative(Instance.worktree, filePath))
    const summary = `${fileChanges.length} files changed`

    return {
      title: summary,
      metadata: {
        diff: totalDiff, // Полный diff всех изменений
      },
      output: `Patch applied successfully. ${summary}:\n${relativePaths.map((p) => `  ${p}`).join("\n")}`,
    }
  },
})
