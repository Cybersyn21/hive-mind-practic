import { Format } from "../format"
import { FileWatcher } from "../file/watcher"
import { File } from "../file"
import { Flag } from "../flag/flag"
import { Project } from "./project"
import { Bus } from "../bus"
import { Command } from "../command"
import { Instance } from "./instance"
import { Log } from "../util/log"

// Функция инициализации экземпляра проекта
// Выполняет начальную настройку всех подсистем для работы с проектом
export async function InstanceBootstrap() {
  Log.Default.info("bootstrapping", { directory: Instance.directory })

  // Инициализируем форматирование вывода
  Format.init()

  // Инициализируем наблюдатель за изменениями файлов
  FileWatcher.init()

  // Инициализируем файловую подсистему
  File.init()

  // Подписываемся на событие выполнения команды INIT
  // Когда команда INIT выполнена, помечаем проект как инициализированный
  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(Instance.project.id)
    }
  })
}
