import type { Argv } from "yargs"
import { Session } from "../../session"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { EOL } from "os"

// Команда экспорта данных сессии в JSON формат
// Позволяет экспортировать информацию о сессии и все сообщения для резервного копирования или анализа
export const ExportCommand = cmd({
  command: "export [sessionID]",
  describe: "export session data as JSON",
  builder: (yargs: Argv) => {
    return yargs.positional("sessionID", {
      describe: "session id to export",
      type: "string",
    })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      let sessionID = args.sessionID
      process.stderr.write(`Exporting session: ${sessionID ?? "latest"}`)

      // Если sessionID не указан, показываем интерактивный выбор
      if (!sessionID) {
        UI.empty()
        prompts.intro("Export session", {
          output: process.stderr,
        })

        // Загружаем список всех доступных сессий
        const sessions = []
        for await (const session of Session.list()) {
          sessions.push(session)
        }

        if (sessions.length === 0) {
          prompts.log.error("No sessions found", {
            output: process.stderr,
          })
          prompts.outro("Done", {
            output: process.stderr,
          })
          return
        }

        // Сортируем сессии по времени обновления (новые первые)
        sessions.sort((a, b) => b.time.updated - a.time.updated)

        // Показываем автокомплит для выбора сессии
        const selectedSession = await prompts.autocomplete({
          message: "Select session to export",
          maxItems: 10,
          options: sessions.map((session) => ({
            label: session.title,
            value: session.id,
            hint: `${new Date(session.time.updated).toLocaleString()} • ${session.id.slice(-8)}`, // Показываем дату и короткий ID
          })),
          output: process.stderr,
        })

        if (prompts.isCancel(selectedSession)) {
          throw new UI.CancelledError()
        }

        sessionID = selectedSession as string

        prompts.outro("Exporting session...", {
          output: process.stderr,
        })
      }

      try {
        // Загружаем полную информацию о сессии
        const sessionInfo = await Session.get(sessionID!)
        const messages = await Session.messages({ sessionID: sessionID! })

        // Формируем структуру экспорта: метаданные сессии + все сообщения
        const exportData = {
          info: sessionInfo,
          messages: messages.map((msg) => ({
            info: msg.info,
            parts: msg.parts,
          })),
        }

        // Выводим JSON в stdout (позволяет использовать перенаправление: export > file.json)
        process.stdout.write(JSON.stringify(exportData, null, 2))
        process.stdout.write(EOL)
      } catch (error) {
        UI.error(`Session not found: ${sessionID!}`)
        process.exit(1)
      }
    })
  },
})
