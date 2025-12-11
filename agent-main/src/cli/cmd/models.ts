import type { Argv } from "yargs"
import { Instance } from "../../project/instance"
import { Provider } from "../../provider/provider"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { EOL } from "os"

// Команда отображения списка доступных моделей
// Показывает все модели от всех провайдеров или фильтрует по конкретному провайдеру
export const ModelsCommand = cmd({
  command: "models [provider]",
  describe: "list all available models",
  builder: (yargs: Argv) => {
    return yargs
      .positional("provider", {
        describe: "provider ID to filter models by",
        type: "string",
        array: false,
      })
      .option("verbose", {
        describe: "use more verbose model output (includes metadata like costs)",
        type: "boolean",
      })
  },
  handler: async (args) => {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const providers = await Provider.list()

        // Вспомогательная функция для вывода моделей провайдера
        // В verbose режиме выводит полные метаданные (стоимость, лимиты и т.д.)
        function printModels(providerID: string, verbose?: boolean) {
          const provider = providers[providerID]
          for (const [modelID, model] of Object.entries(provider.info.models)) {
            // Выводим в формате provider/model
            process.stdout.write(`${providerID}/${modelID}`)
            process.stdout.write(EOL)
            if (verbose) {
              // В verbose режиме выводим полный JSON с метаданными модели
              process.stdout.write(JSON.stringify(model, null, 2))
              process.stdout.write(EOL)
            }
          }
        }

        // Если указан конкретный провайдер, выводим только его модели
        if (args.provider) {
          const provider = providers[args.provider]
          if (!provider) {
            UI.error(`Provider not found: ${args.provider}`)
            return
          }

          printModels(args.provider, args.verbose)
          return
        }

        // Выводим модели всех провайдеров
        for (const providerID of Object.keys(providers)) {
          printModels(providerID, args.verbose)
        }
      },
    })
  },
})
