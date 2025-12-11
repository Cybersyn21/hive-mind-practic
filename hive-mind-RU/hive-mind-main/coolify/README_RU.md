# Каталог coolify/ — Coolify развёртывание

## Описание

Каталог `coolify/` содержит конфигурацию для развёртывания Hive Mind через [Coolify](https://coolify.io/) — self-hosted PaaS альтернативу Heroku/Vercel.

## Файлы

### Dockerfile
**Назначение**: Docker образ, оптимизированный для Coolify.

Отличия от основного Dockerfile:
- Упрощённая структура
- Интеграция с Coolify переменными окружения
- Автоматический запуск через start.sh

### docker-compose.yml
**Назначение**: Docker Compose конфигурация для локального тестирования и Coolify.

```yaml
version: '3.8'
services:
  hive-mind:
    build: .
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_ALLOWED_CHATS=${TELEGRAM_ALLOWED_CHATS}
    volumes:
      - hive-data:/home/hive
```

### start.sh
**Назначение**: Скрипт запуска контейнера.

**Функциональность**:
- Инициализация окружения
- Восстановление авторизации (если есть)
- Запуск Telegram бота или hive оркестратора

### .dockerignore
**Назначение**: Исключения для Docker сборки.

### .env.example
**Назначение**: Пример переменных окружения.

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_CHATS=-1002975819706
```

### README.md
**Назначение**: Документация развёртывания в Coolify.

## Развёртывание в Coolify

### 1. Подготовка
1. Установите Coolify на сервер
2. Создайте новый проект
3. Подключите GitHub репозиторий

### 2. Конфигурация
1. Укажите путь к Dockerfile: `coolify/Dockerfile`
2. Добавьте переменные окружения:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_CHATS`

### 3. Запуск
1. Нажмите Deploy
2. Дождитесь сборки образа
3. Проверьте логи

### 4. Авторизация
После первого запуска нужно авторизовать GitHub и Claude:

```bash
# Подключиться к контейнеру
docker exec -it <container-id> bash

# Авторизация
gh auth login -h github.com -s repo,workflow,user,read:org,gist
claude
```

## Преимущества Coolify

- ✅ Self-hosted — полный контроль
- ✅ Простой интерфейс
- ✅ Автоматические деплои из GitHub
- ✅ SSL сертификаты
- ✅ Мониторинг и логи

## Ограничения

- Требуется ручная авторизация после первого запуска
- Нужен доступ к серверу для настройки секретов

## Ссылки

- [Coolify](https://coolify.io/)
- [Документация Coolify](https://coolify.io/docs)
