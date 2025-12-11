import z from "zod"
import { Identifier } from "../id/id"
import { Snapshot } from "../snapshot"
import { MessageV2 } from "./message-v2"
import { Session } from "."
import { Log } from "../util/log"
import { splitWhen } from "remeda"
import { Storage } from "../storage/storage"
import { Bus } from "../bus"
import { SessionPrompt } from "./prompt"

// Пространство имен для управления откатом изменений в сессии
// Позволяет отменять сообщения и их части, восстанавливая предыдущее состояние файлов
export namespace SessionRevert {
  const log = Log.create({ service: "session.revert" })

  // Схема валидации входных данных для отката
  export const RevertInput = z.object({
    sessionID: Identifier.schema("session"), // ID сессии для отката
    messageID: Identifier.schema("message"), // ID сообщения до которого откатываемся
    partID: Identifier.schema("part").optional(), // Опциональный ID части сообщения для точного отката
  })
  export type RevertInput = z.infer<typeof RevertInput>

  // Выполняет откат сессии до указанного сообщения или части сообщения
  // Сохраняет текущее состояние в snapshot и откатывает файлы к предыдущему состоянию
  export async function revert(input: RevertInput) {
    // Проверяем что сессия не занята
    SessionPrompt.assertNotBusy(input.sessionID)
    // Получаем все сообщения сессии
    const all = await Session.messages({ sessionID: input.sessionID })
    let lastUser: MessageV2.User | undefined
    const session = await Session.get(input.sessionID)

    let revert: Session.Info["revert"]
    const patches: Snapshot.Patch[] = []
    // Проходим по всем сообщениям для определения точки отката и сбора патчей
    for (const msg of all) {
      if (msg.info.role === "user") lastUser = msg.info
      const remaining = []
      for (const part of msg.parts) {
        if (revert) {
          // После точки отката собираем все патчи для отката изменений
          if (part.type === "patch") {
            patches.push(part)
          }
          continue
        }

        if (!revert) {
          // Ищем точку отката по messageID или partID
          if ((msg.info.id === input.messageID && !input.partID) || part.id === input.partID) {
            // Если в сообщении не осталось полезных частей, откатываем всё сообщение
            // if no useful parts left in message, same as reverting whole message
            const partID = remaining.some((item) => ["text", "tool"].includes(item.type)) ? input.partID : undefined
            revert = {
              messageID: !partID && lastUser ? lastUser.id : msg.info.id,
              partID,
            }
          }
          remaining.push(part)
        }
      }
    }

    if (revert) {
      const session = await Session.get(input.sessionID)
      // Сохраняем текущий snapshot или создаем новый если его еще нет
      revert.snapshot = session.revert?.snapshot ?? (await Snapshot.track())
      // Откатываем все собранные патчи
      await Snapshot.revert(patches)
      // Вычисляем разницу между текущим и откатанным состоянием
      if (revert.snapshot) revert.diff = await Snapshot.diff(revert.snapshot)
      return Session.update(input.sessionID, (draft) => {
        draft.revert = revert
      })
    }
    return session
  }

  // Отменяет откат, восстанавливая изменения которые были откачены
  // Возвращает сессию к состоянию до вызова revert()
  export async function unrevert(input: { sessionID: string }) {
    log.info("unreverting", input)
    SessionPrompt.assertNotBusy(input.sessionID)
    const session = await Session.get(input.sessionID)
    if (!session.revert) return session
    // Восстанавливаем snapshot если он существует
    if (session.revert.snapshot) await Snapshot.restore(session.revert.snapshot)
    // Очищаем информацию об откате из сессии
    const next = await Session.update(input.sessionID, (draft) => {
      draft.revert = undefined
    })
    return next
  }

  // Очищает откатанные сообщения и их части из хранилища
  // Удаляет все сообщения и части после точки отката
  export async function cleanup(session: Session.Info) {
    if (!session.revert) return
    const sessionID = session.id
    let msgs = await Session.messages({ sessionID })
    const messageID = session.revert.messageID
    // Разделяем сообщения на те что сохраняем и те что удаляем
    const [preserve, remove] = splitWhen(msgs, (x) => x.info.id === messageID)
    msgs = preserve
    // Удаляем откатанные сообщения из хранилища
    for (const msg of remove) {
      await Storage.remove(["message", sessionID, msg.info.id])
      await Bus.publish(MessageV2.Event.Removed, { sessionID: sessionID, messageID: msg.info.id })
    }
    // Если откат был на уровне части сообщения, удаляем только откатанные части
    const last = preserve.at(-1)
    if (session.revert.partID && last) {
      const partID = session.revert.partID
      const [preserveParts, removeParts] = splitWhen(last.parts, (x) => x.id === partID)
      last.parts = preserveParts
      for (const part of removeParts) {
        await Storage.remove(["part", last.info.id, part.id])
        await Bus.publish(MessageV2.Event.PartRemoved, {
          sessionID: sessionID,
          messageID: last.info.id,
          partID: part.id,
        })
      }
    }
    // Очищаем информацию об откате из сессии
    await Session.update(sessionID, (draft) => {
      draft.revert = undefined
    })
  }
}
