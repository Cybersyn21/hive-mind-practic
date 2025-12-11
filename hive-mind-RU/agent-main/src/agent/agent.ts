// Модуль управления агентами
// Отвечает за создание, конфигурирование и использование различных AI-агентов
// Включает встроенные агенты (general, build, plan) и пользовательские агенты из конфигурации

import { Config } from "../config/config"
import z from "zod"
import { Provider } from "../provider/provider"
import { generateObject, type ModelMessage } from "ai"
import PROMPT_GENERATE from "./generate.txt"
import { SystemPrompt } from "../session/system"
import { Instance } from "../project/instance"
import { mergeDeep } from "remeda"

export namespace Agent {
  // Схема Zod для валидации информации об агенте
  // Определяет структуру конфигурации каждого агента с его параметрами и инструментами
  export const Info = z
    .object({
      name: z.string(), // Уникальное имя агента
      description: z.string().optional(), // Описание возможностей агента
      mode: z.enum(["subagent", "primary", "all"]), // Режим работы: вспомогательный, основной или оба
      builtIn: z.boolean(), // Встроен ли агент по умолчанию
      topP: z.number().optional(), // Параметр top-p для модели (контролирует разнообразие)
      temperature: z.number().optional(), // Температура модели (контролирует креативность)
      color: z.string().optional(), // Цвет для UI представления
      model: z
        .object({
          modelID: z.string(), // ID языковой модели
          providerID: z.string(), // ID провайдера модели (OpenAI, Anthropic и т.д.)
        })
        .optional(),
      prompt: z.string().optional(), // Системный промпт специально для этого агента
      tools: z.record(z.string(), z.boolean()), // Словарь инструментов и их доступность
      options: z.record(z.string(), z.any()), // Дополнительные опции конфигурации
    })
    .meta({
      ref: "Agent",
    })
  export type Info = z.infer<typeof Info>

  // Кэшированное состояние всех доступных агентов
  // Загружает встроенные агенты и объединяет их с пользовательскими агентами из конфигурации
  const state = Instance.state(async () => {
    const cfg = await Config.get()
    const defaultTools = cfg.tools ?? {} // Инструменты по умолчанию для всех агентов

    // Инициализация встроенных агентов
    const result: Record<string, Info> = {
      // general: универсальный агент для поиска, анализа кода и многошаговых задач
      general: {
        name: "general",
        description:
          "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you.",
        tools: {
          todoread: false, // Отключены встроенные инструменты для работы со списками задач
          todowrite: false,
          ...defaultTools,
        },
        options: {},
        mode: "subagent", // Работает только как вспомогательный агент
        builtIn: true,
      },
      // build: агент для сборки проекта и управления зависимостями
      build: {
        name: "build",
        tools: { ...defaultTools },
        options: {},
        mode: "primary", // Может работать как основной агент
        builtIn: true,
      },
      // plan: агент для планирования и организации работы
      plan: {
        name: "plan",
        options: {},
        tools: {
          ...defaultTools,
        },
        mode: "primary", // Может работать как основной агент
        builtIn: true,
      },
    }
    // Обработка пользовательских агентов из конфигурации
    for (const [key, value] of Object.entries(cfg.agent ?? {})) {
      // Пропускаем отключенные агенты
      if (value.disable) {
        delete result[key]
        continue
      }
      // Получаем существующий агент или создаем новый
      let item = result[key]
      if (!item)
        item = result[key] = {
          name: key,
          mode: "all", // По умолчанию новые агенты могут работать в любом режиме
          options: {},
          tools: {},
          builtIn: false,
        }
      // Деструктуризация параметров конфигурации агента
      const { name, model, prompt, tools, description, temperature, top_p, mode, color, ...extra } = value
      // Сохраняем дополнительные опции
      item.options = {
        ...item.options,
        ...extra,
      }
      // Парсим и устанавливаем модель если указана
      if (model) item.model = Provider.parseModel(model)
      // Устанавливаем системный промпт если указан
      if (prompt) item.prompt = prompt
      // Объединяем инструменты с существующими
      if (tools)
        item.tools = {
          ...item.tools,
          ...tools,
        }
      // Применяем инструменты по умолчанию
      item.tools = {
        ...defaultTools,
        ...item.tools,
      }
      // Устанавливаем опциональные параметры если они присутствуют
      if (description) item.description = description
      if (temperature != undefined) item.temperature = temperature
      if (top_p != undefined) item.topP = top_p
      if (mode) item.mode = mode
      if (color) item.color = color
      // Обновляем имя для консистентности
      if (name) item.name = name
    }
    return result
  })

  // Получить конфигурацию агента по имени
  // Возвращает информацию об агенте или undefined если агент не найден
  export async function get(agent: string) {
    return state().then((x) => x[agent])
  }

  // Получить список всех доступных агентов
  // Возвращает массив конфигураций всех агентов (встроенных и пользовательских)
  export async function list() {
    return state().then((x) => Object.values(x))
  }

  // Генерировать конфигурацию нового агента на основе описания
  // Использует AI модель для автоматического создания подходящей конфигурации агента
  export async function generate(input: { description: string }) {
    // Получаем модель по умолчанию для генерации
    const defaultModel = await Provider.defaultModel()
    const model = await Provider.getModel(defaultModel.providerID, defaultModel.modelID)

    // Собираем системные промпты
    const system = SystemPrompt.header(defaultModel.providerID)
    system.push(PROMPT_GENERATE)

    // Получаем список существующих агентов для проверки уникальности имен
    const existing = await list()

    // Вызываем AI для генерации структурированной конфигурации агента
    const result = await generateObject({
      temperature: 0.3, // Низкая температура для более детерминированного результата
      prompt: [
        ...system.map(
          (item): ModelMessage => ({
            role: "system",
            content: item,
          }),
        ),
        {
          role: "user",
          content: `Create an agent configuration based on this request: \"${input.description}\".\n\nIMPORTANT: The following identifiers already exist and must NOT be used: ${existing.map((i) => i.name).join(", ")}\n  Return ONLY the JSON object, no other text, do not wrap in backticks`,
        },
      ],
      model: model.language,
      // Схема ожидаемого результата от AI модели
      schema: z.object({
        identifier: z.string(), // Уникальное имя агента
        whenToUse: z.string(), // Описание когда использовать агента
        systemPrompt: z.string(), // Системный промпт для агента
      }),
    })
    return result.object
  }
}

// Система разрешений удалена - больше не требуется
