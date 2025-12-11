import z from "zod"
import path from "path"
import { Config } from "../config/config"
import { mergeDeep, sortBy } from "remeda"
import { NoSuchModelError, type LanguageModel, type Provider as SDK } from "ai"
import { Log } from "../util/log"
import { BunProc } from "../bun"
import { ModelsDev } from "./models"
import { NamedError } from "../util/error"
import { Auth } from "../auth"
import { Instance } from "../project/instance"
import { Global } from "../global"
import { Flag } from "../flag/flag"
import { iife } from "../util/iife"

// Модуль для управления поставщиками моделей AI и их конфигурацией
// Этот файл отвечает за инициализацию, загрузку и управление различными AI-провайдерами
// (OpenAI, Anthropic, Google, Amazon Bedrock и т.д.), их моделями и параметрами
export namespace Provider {
  const log = Log.create({ service: "provider" })

  // Тип для функции загрузки пользовательских провайдеров
  // Возвращает информацию о том, автоматически ли загружать провайдер, и способ получения модели
  type CustomLoader = (provider: ModelsDev.Provider) => Promise<{
    autoload: boolean
    getModel?: (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>
    options?: Record<string, any>
  }>

  // Источник конфигурации провайдера (переменная окружения, конфиг, кастомный или API)
  type Source = "env" | "config" | "custom" | "api"

  // Кастомные загрузчики для специфичных провайдеров
  // Каждый загрузчик настраивает провайдер с правильными опциями и обработчиками
  const CUSTOM_LOADERS: Record<string, CustomLoader> = {
    // Конфигурация Anthropic провайдера - включает поддержку экспериментальных функций
    async anthropic() {
      return {
        autoload: false,
        options: {
          headers: {
            // Активирует бета-функции: Claude Code, интерпретируемое мышление и потоковая передача инструментов
            "anthropic-beta":
              "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
          },
        },
      }
    },
    // Конфигурация OpenCode провайдера - фильтрует платные модели если нет ключа доступа
    async opencode(input) {
      // Проверяем наличие API ключа в переменных окружения или сохраненном хранилище аутентификации
      const hasKey = await (async () => {
        if (input.env.some((item) => process.env[item])) return true
        if (await Auth.get(input.id)) return true
        return false
      })()

      // Если нет ключа, удаляем все платные модели (оставляем только с нулевой стоимостью)
      if (!hasKey) {
        for (const [key, value] of Object.entries(input.models)) {
          if (value.cost.input === 0) continue
          delete input.models[key]
        }
      }

      return {
        autoload: Object.keys(input.models).length > 0,
        // Используем публичный ключ если свой ключ недоступен
        options: hasKey ? {} : { apiKey: "public" },
      }
    },
    // Конфигурация OpenAI провайдера - использует SDK responses для получения моделей
    openai: async () => {
      return {
        autoload: false,
        async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
          // OpenAI использует метод responses для совместимости с API
          return sdk.responses(modelID)
        },
        options: {},
      }
    },
    // Конфигурация Azure провайдера - поддерживает оба типа эндпоинтов (chat и responses)
    azure: async () => {
      return {
        autoload: false,
        async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
          // Выбираем тип эндпоинта в зависимости от опции useCompletionUrls
          if (options?.["useCompletionUrls"]) {
            return sdk.chat(modelID)
          } else {
            return sdk.responses(modelID)
          }
        },
        options: {},
      }
    },
    // Конфигурация Azure Cognitive Services провайдера - использует кастомный baseURL
    "azure-cognitive-services": async () => {
      // Получаем имя ресурса Azure из переменных окружения
      const resourceName = process.env["AZURE_COGNITIVE_SERVICES_RESOURCE_NAME"]
      return {
        autoload: false,
        async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
          if (options?.["useCompletionUrls"]) {
            return sdk.chat(modelID)
          } else {
            return sdk.responses(modelID)
          }
        },
        options: {
          // Устанавливаем базовый URL для Azure Cognitive Services API
          baseURL: resourceName ? `https://${resourceName}.cognitiveservices.azure.com/openai` : undefined,
        },
      }
    },
    // Конфигурация Amazon Bedrock провайдера - сложная логика добавления префиксов регионов к ID модели
    "amazon-bedrock": async () => {
      // Проверяем наличие AWS учетных данных, иначе пропускаем автозагрузку
      if (!process.env["AWS_PROFILE"] && !process.env["AWS_ACCESS_KEY_ID"] && !process.env["AWS_BEARER_TOKEN_BEDROCK"])
        return { autoload: false }

      // Получаем AWS регион (по умолчанию us-east-1)
      const region = process.env["AWS_REGION"] ?? "us-east-1"

      // Загружаем AWS SDK для получения учетных данных
      const { fromNodeProviderChain } = await import(await BunProc.install("@aws-sdk/credential-providers"))
      return {
        autoload: true,
        options: {
          region,
          credentialProvider: fromNodeProviderChain(),
        },
        // Метод получения модели с добавлением префиксов к ID в зависимости от региона и типа модели
        async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
          // Извлекаем первую часть регионального кода (например, "us" из "us-east-1")
          let regionPrefix = region.split("-")[0]

          // Для US региона добавляем префикс определенным моделям (кроме Gov Cloud)
          switch (regionPrefix) {
            case "us": {
              const modelRequiresPrefix = [
                "nova-micro",
                "nova-lite",
                "nova-pro",
                "nova-premier",
                "claude",
                "deepseek",
              ].some((m) => modelID.includes(m))
              const isGovCloud = region.startsWith("us-gov")
              if (modelRequiresPrefix && !isGovCloud) {
                modelID = `${regionPrefix}.${modelID}`
              }
              break
            }
            // Для EU регионов - специальная логика для различных регионов и моделей
            case "eu": {
              const regionRequiresPrefix = [
                "eu-west-1",
                "eu-west-2",
                "eu-west-3",
                "eu-north-1",
                "eu-central-1",
                "eu-south-1",
                "eu-south-2",
              ].some((r) => region.includes(r))
              const modelRequiresPrefix = ["claude", "nova-lite", "nova-micro", "llama3", "pixtral"].some((m) =>
                modelID.includes(m),
              )
              if (regionRequiresPrefix && modelRequiresPrefix) {
                modelID = `${regionPrefix}.${modelID}`
              }
              break
            }
            // Для AP (азиатско-тихоокеанский) регион - специальный случай для Австралии и APAC
            case "ap": {
              const isAustraliaRegion = ["ap-southeast-2", "ap-southeast-4"].includes(region)
              if (
                isAustraliaRegion &&
                ["anthropic.claude-sonnet-4-5", "anthropic.claude-haiku"].some((m) => modelID.includes(m))
              ) {
                regionPrefix = "au"
                modelID = `${regionPrefix}.${modelID}`
              } else {
                const modelRequiresPrefix = ["claude", "nova-lite", "nova-micro", "nova-pro"].some((m) =>
                  modelID.includes(m),
                )
                if (modelRequiresPrefix) {
                  regionPrefix = "apac"
                  modelID = `${regionPrefix}.${modelID}`
                }
              }
              break
            }
          }

          return sdk.languageModel(modelID)
        },
      }
    },
    // Конфигурация OpenRouter провайдера - добавляет заголовки для идентификации приложения
    openrouter: async () => {
      return {
        autoload: false,
        options: {
          headers: {
            "HTTP-Referer": "https://opencode.ai/",
            "X-Title": "opencode",
          },
        },
      }
    },
    // Конфигурация Vercel провайдера - аналогична OpenRouter
    vercel: async () => {
      return {
        autoload: false,
        options: {
          headers: {
            "http-referer": "https://opencode.ai/",
            "x-title": "opencode",
          },
        },
      }
    },
    // Конфигурация Google Vertex AI провайдера - использует Google Cloud проект и регион
    "google-vertex": async () => {
      // Ищем ID проекта Google Cloud в различных переменных окружения
      const project = process.env["GOOGLE_CLOUD_PROJECT"] ?? process.env["GCP_PROJECT"] ?? process.env["GCLOUD_PROJECT"]
      // Определяем локацию для Vertex AI (по умолчанию us-east5)
      const location = process.env["GOOGLE_CLOUD_LOCATION"] ?? process.env["VERTEX_LOCATION"] ?? "us-east5"
      const autoload = Boolean(project)
      if (!autoload) return { autoload: false }
      return {
        autoload: true,
        options: {
          project,
          location,
        },
        async getModel(sdk: any, modelID: string) {
          const id = String(modelID).trim()
          return sdk.languageModel(id)
        },
      }
    },
    // Конфигурация Google Vertex AI with Anthropic провайдера - специфична для Claude моделей
    "google-vertex-anthropic": async () => {
      // Ищем ID проекта Google Cloud
      const project = process.env["GOOGLE_CLOUD_PROJECT"] ?? process.env["GCP_PROJECT"] ?? process.env["GCLOUD_PROJECT"]
      // Определяем локацию (по умолчанию global для Anthropic моделей)
      const location = process.env["GOOGLE_CLOUD_LOCATION"] ?? process.env["VERTEX_LOCATION"] ?? "global"
      const autoload = Boolean(project)
      if (!autoload) return { autoload: false }
      return {
        autoload: true,
        options: {
          project,
          location,
        },
        async getModel(sdk: any, modelID: string) {
          const id = String(modelID).trim()
          return sdk.languageModel(id)
        },
      }
    },
    // Конфигурация Zenmux провайдера - добавляет заголовки для идентификации приложения
    zenmux: async () => {
      return {
        autoload: false,
        options: {
          headers: {
            "HTTP-Referer": "https://opencode.ai/",
            "X-Title": "opencode",
          },
        },
      }
    },
  }

  // Кэшированное состояние провайдеров, которое загружается один раз и переиспользуется
  // Содержит информацию о провайдерах, моделях, SDK и маппинг идентификаторов
  const state = Instance.state(async () => {
    using _ = log.time("state")
    // Загружаем конфигурацию приложения и базу данных моделей
    const config = await Config.get()
    const database = await ModelsDev.get()

    // Объект для хранения информации о загруженных провайдерах
    const providers: {
      [providerID: string]: {
        source: Source
        info: ModelsDev.Provider
        getModel?: (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>
        options: Record<string, any>
      }
    } = {}
    // Map для кэширования загруженных моделей с их информацией и SDK экземплярами
    const models = new Map<
      string,
      {
        providerID: string
        modelID: string
        info: ModelsDev.Model
        language: LanguageModel
        npm?: string
      }
    >()
    // Map для кэширования SDK экземпляров, ключ основан на хэше конфигурации
    const sdk = new Map<number, SDK>()
    // Маппинг для пользовательских псевдонимов моделей в их реальные ID (формат: ${provider}/${key} -> actualID)
    const realIdByKey = new Map<string, string>()

    log.info("init")

    // Функция для добавления или обновления информации о провайдере
    // Объединяет опции с существующей конфигурацией
    function mergeProvider(
      id: string,
      options: Record<string, any>,
      source: Source,
      getModel?: (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>,
    ) {
      const provider = providers[id]
      if (!provider) {
        // Если провайдер еще не загружен, получаем его из базы данных
        const info = database[id]
        if (!info) return
        // Если в базе данных есть API endpoint, используем его по умолчанию
        if (info.api && !options["baseURL"]) options["baseURL"] = info.api
        providers[id] = {
          source,
          info,
          options,
          getModel,
        }
        return
      }
      // Если провайдер уже существует, объединяем опции и обновляем источник
      provider.options = mergeDeep(provider.options, options)
      provider.source = source
      provider.getModel = getModel ?? provider.getModel
    }

    // Получаем список провайдеров из конфигурации
    const configProviders = Object.entries(config.provider ?? {})

    // Создаем провайдер GitHub Copilot Enterprise наследуя конфигурацию от обычного GitHub Copilot
    // Enterprise версия имеет другой API endpoint, который будет установлен динамически
    if (database["github-copilot"]) {
      const githubCopilot = database["github-copilot"]
      database["github-copilot-enterprise"] = {
        ...githubCopilot,
        id: "github-copilot-enterprise",
        name: "GitHub Copilot Enterprise",
        // Endpoint для Enterprise установится позже на основе аутентификации
        api: undefined,
      }
    }

    // Обрабатываем все провайдеры из конфигурации и объединяем их с информацией из базы данных
    for (const [providerID, provider] of configProviders) {
      const existing = database[providerID]
      // Создаем объединенную конфигурацию провайдера, приоритизируя значения из конфигурации
      const parsed: ModelsDev.Provider = {
        id: providerID,
        npm: provider.npm ?? existing?.npm,
        name: provider.name ?? existing?.name ?? providerID,
        env: provider.env ?? existing?.env ?? [],
        api: provider.api ?? existing?.api,
        models: existing?.models ?? {},
      }

      // Обрабатываем каждую модель в провайдере
      for (const [modelID, model] of Object.entries(provider.models ?? {})) {
        const existing = parsed.models[model.id ?? modelID]
        // Определяем имя модели: предпочитаем явно указанное, или используем существующее
        const name = iife(() => {
          if (model.name) return model.name
          if (model.id && model.id !== modelID) return modelID
          return existing?.name ?? modelID
        })
        // Собираем всю информацию о модели, заполняя отсутствующие поля значениями по умолчанию
        const parsedModel: ModelsDev.Model = {
          id: modelID,
          name,
          release_date: model.release_date ?? existing?.release_date,
          attachment: model.attachment ?? existing?.attachment ?? false,
          reasoning: model.reasoning ?? existing?.reasoning ?? false,
          temperature: model.temperature ?? existing?.temperature ?? false,
          tool_call: model.tool_call ?? existing?.tool_call ?? true,
          // Стоимость использования модели за входные/выходные токены и кэш
          cost:
            !model.cost && !existing?.cost
              ? {
                  input: 0,
                  output: 0,
                  cache_read: 0,
                  cache_write: 0,
                }
              : {
                  cache_read: 0,
                  cache_write: 0,
                  ...existing?.cost,
                  ...model.cost,
                },
          options: {
            ...existing?.options,
            ...model.options,
          },
          // Лимиты на размер контекста и выходных токенов
          limit: model.limit ??
            existing?.limit ?? {
              context: 0,
              output: 0,
            },
          // Поддерживаемые модели входных и выходных данных (текст, изображения и т.д.)
          modalities: model.modalities ??
            existing?.modalities ?? {
              input: ["text"],
              output: ["text"],
            },
          headers: model.headers,
          provider: model.provider ?? existing?.provider,
        }
        // Если модель имеет пользовательский ID (отличается от конфига), регистрируем маппинг
        if (model.id && model.id !== modelID) {
          realIdByKey.set(`${providerID}/${modelID}`, model.id)
        }
        parsed.models[modelID] = parsedModel
      }
      database[providerID] = parsed
    }

    // Получаем список отключенных провайдеров из конфигурации
    const disabled = await Config.get().then((cfg) => new Set(cfg.disabled_providers ?? []))

    // Загружаем провайдеры из переменных окружения
    for (const [providerID, provider] of Object.entries(database)) {
      if (disabled.has(providerID)) continue
      // Получаем API ключ из переменных окружения
      const apiKey = provider.env.map((item) => process.env[item]).at(0)
      if (!apiKey) continue
      mergeProvider(
        providerID,
        // Включаем API ключ только если есть ровно одна потенциальная переменная окружения
        provider.env.length === 1 ? { apiKey } : {},
        "env",
      )
    }

    // Загружаем API ключи из хранилища аутентификации
    for (const [providerID, provider] of Object.entries(await Auth.all())) {
      if (disabled.has(providerID)) continue
      if (provider.type === "api") {
        mergeProvider(providerID, { apiKey: provider.key }, "api")
      }
    }

    // Загружаем кастомные конфигурации для специфичных провайдеров
    for (const [providerID, fn] of Object.entries(CUSTOM_LOADERS)) {
      if (disabled.has(providerID)) continue
      const result = await fn(database[providerID])
      // Загружаем если провайдер имеет autoload=true или уже был загружен из других источников
      if (result && (result.autoload || providers[providerID])) {
        mergeProvider(providerID, result.options ?? {}, "custom", result.getModel)
      }
    }

    // Загружаем конфигурацию провайдеров из файла конфигурации приложения
    for (const [providerID, provider] of configProviders) {
      mergeProvider(providerID, provider.options ?? {}, "config")
    }

    // Фильтруем модели для каждого провайдера, удаляя те которые в черном списке или устарели
    for (const [providerID, provider] of Object.entries(providers)) {
      const filteredModels = Object.fromEntries(
        Object.entries(provider.info.models)
          // Удаляем модели из черного списка
          .filter(
            ([modelID]) =>
              modelID !== "gpt-5-chat-latest" && !(providerID === "openrouter" && modelID === "openai/gpt-5-chat"),
          )
          // Удаляем экспериментальные и альфа модели (если не включен флаг OPENCODE_ENABLE_EXPERIMENTAL_MODELS)
          // Также удаляем устаревшие (deprecated) модели
          .filter(
            ([, model]) =>
              ((!model.experimental && model.status !== "alpha") || Flag.OPENCODE_ENABLE_EXPERIMENTAL_MODELS) &&
              model.status !== "deprecated",
          ),
      )
      provider.info.models = filteredModels

      // Если после фильтрации у провайдера нет моделей, удаляем его
      if (Object.keys(provider.info.models).length === 0) {
        delete providers[providerID]
        continue
      }
      log.info("found", { providerID })
    }

    // Возвращаем полное состояние со всеми провайдерами, моделями и кэшами
    return {
      models,
      providers,
      sdk,
      realIdByKey,
    }
  })

  // Экспортированная функция для получения списка всех доступных провайдеров
  export async function list() {
    return state().then((state) => state.providers)
  }

  // Функция для получения и кэширования SDK экземпляра провайдера
  // SDK загружается один раз и переиспользуется для всех запросов к провайдеру
  async function getSDK(provider: ModelsDev.Provider, model: ModelsDev.Model) {
    return (async () => {
      using _ = log.time("getSDK", {
        providerID: provider.id,
      })
      const s = await state()
      // Получаем имя NPM пакета для SDK провайдера
      const pkg = model.provider?.npm ?? provider.npm ?? provider.id
      const options = { ...s.providers[provider.id]?.options }
      // Для OpenAI совместимых провайдеров включаем отслеживание использования токенов
      if (pkg.includes("@ai-sdk/openai-compatible") && options["includeUsage"] === undefined) {
        options["includeUsage"] = true
      }
      // Создаем хэш конфигурации для идентификации уникального SDK экземпляра
      const key = Bun.hash.xxHash32(JSON.stringify({ pkg, options }))
      const existing = s.sdk.get(key)
      if (existing) return existing

      // Загружаем SDK провайдера (либо из NPM, либо локально)
      let installedPath: string
      if (!pkg.startsWith("file://")) {
        installedPath = await BunProc.install(pkg, "latest")
      } else {
        log.info("loading local provider", { pkg })
        installedPath = pkg
      }

      // Специальная обработка для google-vertex-anthropic провайдера
      // Пакет указывает на @ai-sdk/google-vertex, но экспорт находится в подпути /anthropic
      // Так как Bun не поддерживает импорт подпатей, мы загружаем напрямую из dist директории
      // Ссылки:
      // - https://github.com/sst/models.dev/blob/0a87de42ab177bebad0620a889e2eb2b4a5dd4ab/providers/google-vertex-anthropic/provider.toml
      // - https://ai-sdk.dev/providers/ai-sdk-providers/google-vertex#google-vertex-anthropic-provider-usage
      const modPath =
        provider.id === "google-vertex-anthropic" ? `${installedPath}/dist/anthropic/index.mjs` : installedPath
      const mod = await import(modPath)

      // Настройка логики таймаутов для запросов
      if (options["timeout"] !== undefined && options["timeout"] !== null) {
        // Сохраняем пользовательскую fetch функцию если она есть, оборачиваем с логикой таймаутов
        const customFetch = options["fetch"]
        options["fetch"] = async (input: any, init?: BunFetchRequestInit) => {
          const { signal, ...rest } = init ?? {}

          // Объединяем сигналы отмены: существующий и новый таймаут
          const signals: AbortSignal[] = []
          if (signal) signals.push(signal)
          if (options["timeout"] !== false) signals.push(AbortSignal.timeout(options["timeout"]))

          const combined = signals.length > 1 ? AbortSignal.any(signals) : signals[0]

          const fetchFn = customFetch ?? fetch
          return fetchFn(input, {
            ...rest,
            signal: combined,
            // @ts-ignore см. https://github.com/oven-sh/bun/issues/16682
            timeout: false,
          })
        }
      }
      // Находим и вызываем функцию создания SDK (обычно это createXXX функция)
      const fn = mod[Object.keys(mod).find((key) => key.startsWith("create"))!]
      const loaded = fn({
        name: provider.id,
        ...options,
      })
      // Кэшируем SDK экземпляр для будущего использования
      s.sdk.set(key, loaded)
      return loaded as SDK
    })().catch((e) => {
      throw new InitError({ providerID: provider.id }, { cause: e })
    })
  }

  // Получить информацию о конкретном провайдере по его ID
  export async function getProvider(providerID: string) {
    return state().then((s) => s.providers[providerID])
  }

  // Получить модель AI от конкретного провайдера
  // Загружает SDK, кэширует модель и возвращает языковую модель для использования
  export async function getModel(providerID: string, modelID: string) {
    const key = `${providerID}/${modelID}`
    const s = await state()
    // Проверяем кэш уже загруженных моделей
    if (s.models.has(key)) return s.models.get(key)!

    log.info("getModel", {
      providerID,
      modelID,
    })

    // Получаем информацию о провайдере
    const provider = s.providers[providerID]
    if (!provider) throw new ModelNotFoundError({ providerID, modelID })
    // Получаем информацию о модели
    const info = provider.info.models[modelID]
    if (!info) throw new ModelNotFoundError({ providerID, modelID })
    // Загружаем SDK для провайдера (будет переиспользован из кэша если доступен)
    const sdk = await getSDK(provider.info, info)

    try {
      const keyReal = `${providerID}/${modelID}`
      // Получаем реальный ID модели если был использован пользовательский псевдоним
      const realID = s.realIdByKey.get(keyReal) ?? info.id
      // Получаем языковую модель от SDK провайдера
      // Используем кастомный getModel если определен, иначе используем стандартный метод
      const language = provider.getModel
        ? await provider.getModel(sdk, realID, provider.options)
        : sdk.languageModel(realID)
      log.info("found", { providerID, modelID })
      // Кэшируем загруженную модель
      s.models.set(key, {
        providerID,
        modelID,
        info,
        language,
        npm: info.provider?.npm ?? provider.info.npm,
      })
      return {
        modelID,
        providerID,
        info,
        language,
        npm: info.provider?.npm ?? provider.info.npm,
      }
    } catch (e) {
      // Преобразуем ошибки SDK в стандартные ошибки ModelNotFoundError
      if (e instanceof NoSuchModelError)
        throw new ModelNotFoundError(
          {
            modelID: modelID,
            providerID,
          },
          { cause: e },
        )
      throw e
    }
  }

  // Получить наиболее экономичную (маленькую) модель от провайдера
  // Используется для операций которые не требуют мощной модели (например, генерация заголовков)
  export async function getSmallModel(providerID: string) {
    const cfg = await Config.get()

    // Если в конфигурации указана конкретная маленькая модель, используем её
    if (cfg.small_model) {
      const parsed = parseModel(cfg.small_model)
      return getModel(parsed.providerID, parsed.modelID)
    }

    const provider = await state().then((state) => state.providers[providerID])
    if (!provider) return
    // Приоритет моделей - выбираем первую доступную из списка
    let priority = ["claude-haiku-4-5", "claude-haiku-4.5", "3-5-haiku", "3.5-haiku", "gemini-2.5-flash", "gpt-5-nano"]
    // Для GitHub Copilot исключаем claude-haiku-4.5 так как она считается премиум моделью
    if (providerID === "github-copilot") {
      priority = priority.filter((m) => m !== "claude-haiku-4.5")
    }
    // Для локальных/OpenCode провайдеров используем только nano модели
    if (providerID === "opencode" || providerID === "local") {
      priority = ["gpt-5-nano"]
    }
    // Ищем первую доступную модель из списка приоритета
    for (const item of priority) {
      for (const model of Object.keys(provider.info.models)) {
        if (model.includes(item)) return getModel(providerID, model)
      }
    }
  }

  // Список приоритета моделей для сортировки - более мощные модели выше
  const priority = ["gpt-5", "claude-sonnet-4", "big-pickle", "gemini-3-pro"]
  // Функция для сортировки моделей по приоритету
  // Сортирует по: наличию в списке приоритета, наличию "latest" в названии, и по алфавиту
  export function sort(models: ModelsDev.Model[]) {
    return sortBy(
      models,
      [(model) => priority.findIndex((filter) => model.id.includes(filter)), "desc"],
      [(model) => (model.id.includes("latest") ? 0 : 1), "asc"],
      [(model) => model.id, "desc"],
    )
  }

  // Получить модель по умолчанию для приложения
  // Используется когда пользователь не указал конкретную модель явно
  export async function defaultModel() {
    const cfg = await Config.get()
    // Если в конфигурации указана модель по умолчанию, используем её
    if (cfg.model) return parseModel(cfg.model)

    // Находим первый доступный провайдер (если в конфигурации указаны провайдеры, выбираем из них)
    const provider = await list()
      .then((val) => Object.values(val))
      .then((x) => x.find((p) => !cfg.provider || Object.keys(cfg.provider).includes(p.info.id)))
    if (!provider) throw new Error("no providers found")
    // Получаем первую модель после сортировки по приоритету
    const [model] = sort(Object.values(provider.info.models))
    if (!model) throw new Error("no models found")
    return {
      providerID: provider.info.id,
      modelID: model.id,
    }
  }

  // Парсер для строки вида "providerID/modelID"
  // Разделяет строку на ID провайдера и ID модели (модель может содержать слеши)
  export function parseModel(model: string) {
    const [providerID, ...rest] = model.split("/")
    return {
      providerID: providerID,
      modelID: rest.join("/"),
    }
  }

  // Ошибка, выбрасываемая когда запрошенная модель не найдена у провайдера
  export const ModelNotFoundError = NamedError.create(
    "ProviderModelNotFoundError",
    z.object({
      providerID: z.string(),
      modelID: z.string(),
    }),
  )

  // Ошибка, выбрасываемая при ошибке инициализации SDK провайдера
  export const InitError = NamedError.create(
    "ProviderInitError",
    z.object({
      providerID: z.string(),
    }),
  )
}
