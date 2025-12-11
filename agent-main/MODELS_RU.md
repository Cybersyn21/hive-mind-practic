# Модели

Этот агент использует модели из сервиса подписки [OpenCode Zen](https://opencode.ai/docs/zen/). OpenCode Zen предоставляет доступ к широкому спектру моделей ИИ через единое API.

## Доступные модели

Все модели доступны в формате `opencode/<model-id>`. Используйте опцию `--model` для указания желаемой модели:

```bash
echo "hi" | agent --model opencode/grok-code
```

## Ценообразование OpenCode Zen

Ниже приведены цены за 1 млн токенов для моделей OpenCode Zen. Модели отсортированы по цене вывода (сначала самые дешевые) для лучшей видимости цен.

| Модель | ID модели | Ввод | Вывод | Кэшировано чтение | Кэшировано запись |
|-------|----------|-------|--------|-------------|--------------|
| **Бесплатные модели (вывод: $0.00)** |
| Grok Code Fast 1 | `opencode/grok-code` | Бесплатно | Бесплатно | Бесплатно | - |
| GPT 5 Nano | `opencode/gpt-5-nano` | Бесплатно | Бесплатно | Бесплатно | - |
| Big Pickle | `opencode/big-pickle` | Бесплатно | Бесплатно | Бесплатно | - |
| **Платные модели (отсортированы по цене вывода)** |
| Qwen3 Coder 480B | `opencode/qwen3-coder-480b` | $0.45 | $1.50 | - | - |
| GLM 4.6 | `opencode/glm-4-6` | $0.60 | $2.20 | $0.10 | - |
| Kimi K2 | `opencode/kimi-k2` | $0.60 | $2.50 | $0.36 | - |
| Claude Haiku 3.5 | `opencode/claude-haiku-3-5` | $0.80 | $4.00 | $0.08 | $1.00 |
| Claude Haiku 4.5 | `opencode/haiku` | $1.00 | $5.00 | $0.10 | $1.25 |
| GPT 5.1 | `opencode/gpt-5-1` | $1.25 | $10.00 | $0.125 | - |
| GPT 5.1 Codex | `opencode/gpt-5-1-codex` | $1.25 | $10.00 | $0.125 | - |
| GPT 5 | `opencode/gpt-5` | $1.25 | $10.00 | $0.125 | - |
| GPT 5 Codex | `opencode/gpt-5-codex` | $1.25 | $10.00 | $0.125 | - |
| Gemini 3 Pro (≤ 200K токенов) | `opencode/gemini-3-pro` | $2.00 | $12.00 | $0.20 | - |
| Claude Sonnet 4.5 (≤ 200K токенов) | `opencode/sonnet` | $3.00 | $15.00 | $0.30 | $3.75 |
| Claude Sonnet 4 (≤ 200K токенов) | `opencode/claude-sonnet-4` | $3.00 | $15.00 | $0.30 | $3.75 |
| Gemini 3 Pro (> 200K токенов) | `opencode/gemini-3-pro` | $4.00 | $18.00 | $0.40 | - |
| Claude Sonnet 4.5 (> 200K токенов) | `opencode/sonnet` | $6.00 | $22.50 | $0.60 | $7.50 |
| Claude Sonnet 4 (> 200K токенов) | `opencode/claude-sonnet-4` | $6.00 | $22.50 | $0.60 | $7.50 |
| Claude Opus 4.1 | `opencode/opus` | $15.00 | $75.00 | $1.50 | $18.75 |

## Модель по умолчанию

Моделью по умолчанию является **Grok Code Fast 1** (`opencode/grok-code`), которая полностью бесплатна. Эта модель обеспечивает отличную производительность для задач кодирования без каких-либо затрат.

## Примеры использования

### Использование модели по умолчанию (бесплатно)

```bash
# По умолчанию использует opencode/grok-code
echo "hello" | agent
```

### Использование других бесплатных моделей

```bash
# Big Pickle (бесплатно)
echo "hello" | agent --model opencode/big-pickle

# GPT 5 Nano (бесплатно)
echo "hello" | agent --model opencode/gpt-5-nano
```

### Использование платных моделей

```bash
# Claude Sonnet 4.5 (лучшее качество)
echo "hello" | agent --model opencode/sonnet

# Claude Haiku 4.5 (быстро и доступно)
echo "hello" | agent --model opencode/haiku

# Claude Opus 4.1 (самая мощная)
echo "hello" | agent --model opencode/opus

# Gemini 3 Pro
echo "hello" | agent --model opencode/gemini-3-pro

# GPT 5.1
echo "hello" | agent --model opencode/gpt-5-1

# Qwen3 Coder (специализирована для кодирования)
echo "hello" | agent --model opencode/qwen3-coder-480b
```

## Дополнительная информация

Для получения полной информации о подписке OpenCode Zen и ценообразовании посетите [документацию OpenCode Zen](https://opencode.ai/docs/zen/).

## Примечания

- Все цены указаны за 1 млн токенов
- Цены за кэширование применяются при использовании функций кэширования запросов
- Лимиты контекста токенов варьируются в зависимости от модели
- Бесплатные модели не имеют затрат на токены, но могут иметь ограничения по частоте запросов
