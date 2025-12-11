# Каталог data/ — Данные

## Описание

Каталог `data/` содержит данные, используемые проектом, включая case studies и примеры.

## Структура

```
data/
└── case-studies/                          # Практические примеры
    ├── issue-683-original-error-log.txt  # Логи ошибки #683
    └── issue-683-pr-creation-failure.md  # Анализ ошибки создания PR
```

## case-studies/

### issue-683-original-error-log.txt
**Содержание**: Полные логи ошибки из issue #683.

**Назначение**: Сохранение оригинальных данных для воспроизведения и анализа проблемы.

### issue-683-pr-creation-failure.md
**Содержание**: Документация проблемы с созданием PR.

**Секции**:
- Описание проблемы
- Воспроизведение
- Анализ логов
- Решение
- Выводы

## Использование

### Анализ проблем
```bash
# Просмотр логов
cat data/case-studies/issue-683-original-error-log.txt

# Поиск паттернов ошибок
grep -i "error" data/case-studies/*.txt
```

### Создание нового case study
```bash
# Сохранить логи
solve https://github.com/owner/repo/issues/123 2>&1 | tee data/case-studies/issue-123-log.txt

# Создать документацию
touch data/case-studies/issue-123-analysis.md
```

## Структура case study файла

```markdown
# Issue #XXX - Название проблемы

## Описание
Краткое описание проблемы.

## Воспроизведение
Шаги для воспроизведения.

## Логи
Ключевые выдержки из логов.

## Анализ
Root cause analysis.

## Решение
Как проблема была решена.

## Предотвращение
Как избежать в будущем.
```

## Связь с docs/case-studies/

- `data/case-studies/` — сырые данные (логи, JSON)
- `docs/case-studies/` — обработанная документация

Рекомендуется:
1. Сохранять логи в `data/`
2. Писать анализ в `docs/`
3. Ссылаться из документации на данные
