# Поддержка Docker для Hive Mind

Этот документ объясняет, как запустить Hive Mind в контейнерах Docker.

## Быстрый старт

### Вариант 1: Использование предварительно собранного образа из Docker Hub (рекомендуется)

```bash
# Загрузить последний образ
docker pull konard/hive-mind:latest

# Запустить интерактивный сеанс
docker run -it konard/hive-mind:latest

# ВАЖНО: Аутентификация выполняется ПОСЛЕ установки образа Docker
# Скрипт установки НЕ запускает gh auth login во избежание тайм-аутов сборки
# Это позволяет завершить сборку Docker без интерактивных подсказок

# Внутри контейнера, аутентифицируйтесь в GitHub
gh auth login -h github.com -s repo,workflow,user,read:org,gist

# Аутентифицируйтесь в Claude
claude

# Теперь вы можете использовать hive и solve команды
solve https://github.com/owner/repo/issues/123
```

### Вариант 2: Локальная сборка

```bash
# Собрать рабочий образ
docker build -t hive-mind:local .

# Запустить образ
docker run -it hive-mind:local
```

### Вариант 3: Режим разработки (совместимость с Gitpod)

Для целей разработки устаревший `Dockerfile` предоставляет окружение, совместимое с Gitpod:

```bash
# Собрать образ разработки
docker build -t hive-mind-dev .

# Запустить с монтированием учетных данных
docker run --rm -it \
    -v ~/.config/gh:/workspace/.persisted-configs/gh:ro \
    -v ~/.local/share/claude-profiles:/workspace/.persisted-configs/claude:ro \
    -v ~/.config/claude-code:/workspace/.persisted-configs/claude-code:ro \
    -v "$(pwd)/output:/workspace/output" \
    hive-mind-dev
```

## Аутентификация

Рабочий образ Docker (`Dockerfile`) использует Ubuntu 24.04 и официальный скрипт установки. **ВАЖНО:** Аутентификация выполняется **внутри контейнера ПОСЛЕ** полной установки и запуска образа Docker.

**Почему аутентификация происходит после установки:**
- ✅ Избегает тайм-аутов сборки Docker, вызванных интерактивными подсказками
- ✅ Предотвращает сбои в конвейерах CI/CD
- ✅ Позволяет скрипту установки завершить работу успешно
- ✅ Поддерживает автоматизированные сборки образов Docker

### Аутентификация GitHub
```bash
# Внутри контейнера, ПОСЛЕ его запуска
gh auth login -h github.com -s repo,workflow,user,read:org,gist
```

**Примечание:** Скрипт установки намеренно НЕ вызывает `gh auth login` во время процесса сборки. Это сделано специально для поддержки сборок Docker без тайм-аутов.

### Аутентификация Claude
```bash
# Внутри контейнера, ПОСЛЕ его запуска
claude
```

Этот подход позволяет:
- ✅ Запускать несколько экземпляров Docker с разными учетными записями GitHub
- ✅ Запускать несколько экземпляров Docker с разными подписками Claude
- ✅ Отсутствие утечек учетных данных между контейнерами
- ✅ Каждый контейнер имеет собственную изолированную аутентификацию
- ✅ Успешные сборки Docker без интерактивной аутентификации

## Предварительные условия

1. **Docker:** Установите Docker Desktop или Docker Engine (версия 20.10 или выше)
2. **Интернет-соединение:** Требуется для загрузки образов и аутентификации

## Структура каталогов

```
.
├── Dockerfile                    # Рабочий образ с использованием Ubuntu 24.04
├── experiments/
│   └── solve-dockerize/
│       └── Dockerfile            # Устаревший образ, совместимый с Gitpod (архивирован)
├── scripts/
│   └── ubuntu-24-server-install.sh  # Скрипт установки, используемый Dockerfile
└── docs/
    └── DOCKER.md                 # Этот файл
```

## Расширенное использование

### Запуск с постоянным хранилищем

Для сохранения аутентификации и работы между перезагрузками контейнера:

```bash
# Создать том для домашнего каталога пользователя hive
docker volume create hive-home

# Запустить с монтированным томом
docker run -it -v hive-home:/home/hive konard/hive-mind:latest
```

### Запуск в отсоединенном режиме

```bash
# Запустить отсоединенный контейнер
docker run -d --name hive-worker -v hive-home:/home/hive konard/hive-mind:latest sleep infinity

# Выполнить команды в работающем контейнере
docker exec -it hive-worker bash

# Внутри контейнера, запустите ваши команды
solve https://github.com/owner/repo/issues/123
```

### Использование с Docker Compose

Создайте `docker-compose.yml`:

```yaml
version: '3.8'
services:
  hive-mind:
    image: konard/hive-mind:latest
    volumes:
      - hive-home:/home/hive
    stdin_open: true
    tty: true

volumes:
  hive-home:
```

Затем запустите:
```bash
docker-compose run --rm hive-mind
```

## Устранение неполадок

### Проблемы с аутентификацией GitHub
```bash
# Внутри контейнера, проверить статус аутентификации
gh auth status

# Повторная аутентификация, если необходимо
gh auth login -h github.com -s repo,workflow,user,read:org,gist
```

### Проблемы с аутентификацией Claude
```bash
# Внутри контейнера, повторно запустить Claude для аутентификации
claude
```

### Проблемы Docker
```bash
# Проверить статус Docker на хосте
docker info

# Загрузить последний образ
docker pull konard/hive-mind:latest

# Пересобрать из источника
docker build -t hive-mind:local .
```

### Проблемы со сборкой

Если возникают проблемы при локальной сборке образа:

1. Убедитесь, что у вас достаточно свободного места на диске (минимум 20 ГБ)
2. Проверьте интернет-соединение
3. Попробуйте собрать с более подробным выводом:
   ```bash
   docker build -t hive-mind:local --progress=plain .
   ```

## Конфигурация CI/CD для публикации на Docker Hub

Если вы поддерживаете форк или хотите опубликовать на свой аккаунт Docker Hub, следуйте этим шагам для настройки GitHub Actions:

### Шаг 1: Создать аккаунт Docker Hub

1. Перейдите на [hub.docker.com](https://hub.docker.com)
2. Зарегистрируйтесь или войдите в свой аккаунт
3. Запомните ваше имя пользователя Docker Hub (например, `konard`)

### Шаг 2: Создать токен доступа Docker Hub

1. Войдите в [hub.docker.com](https://hub.docker.com)
2. Нажмите на ваше имя пользователя в верхнем правом углу
3. Выберите **Account Settings** → **Security**
4. Нажмите **New Access Token**
5. Введите описание (например, "GitHub Actions - Hive Mind")
6. Установите разрешения на **Read, Write, Delete** (требуется для публикации)
7. Нажмите **Generate**
8. **ВАЖНО:** Скопируйте токен сразу же - вы не сможете его увидеть позже!
   - Пример формата: `dckr_pat_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`

### Шаг 3: Добавить секреты в репозиторий GitHub

1. Перейдите в ваш репозиторий GitHub (например, `https://github.com/konard/hive-mind`)
2. Нажмите **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret**
4. Добавьте следующие два секрета:

   **Секрет 1: DOCKERHUB_USERNAME**
   - Name: `DOCKERHUB_USERNAME`
   - Value: Ваше имя пользователя Docker Hub (например, `konard`)
   - Нажмите **Add secret**

   **Секрет 2: DOCKERHUB_TOKEN**
   - Name: `DOCKERHUB_TOKEN`
   - Value: Токен доступа, созданный на шаге 2
   - Нажмите **Add secret**

### Шаг 4: Обновить имя образа Docker

Если вы используете форк, обновите имя образа в `.github/workflows/docker-publish.yml`:

```yaml
env:
  REGISTRY: docker.io
  IMAGE_NAME: YOUR_DOCKERHUB_USERNAME/hive-mind  # Измените на ваше имя пользователя
```

### Шаг 5: Проверить конфигурацию

1. Отправьте изменения в ветку `main`
2. Перейдите на вкладку **Actions** в вашем репозитории GitHub
3. Найдите рабочий процесс "Docker Build and Publish"
4. Проверьте, что он завершен успешно
5. Проверьте, что образ появился на [hub.docker.com/r/YOUR_USERNAME/hive-mind](https://hub.docker.com/r/konard/hive-mind)

### Как это работает

- **На Pull Requests:** Рабочий процесс тестирует сборку образа Docker без публикации
- **На ветке Main:** Рабочий процесс собирает и публикует на Docker Hub с тегом `latest`
- **На тегах версий:** Рабочий процесс публикует с семантическими тегами версий (например, `v0.37.0`, `0.37`, `0`)

### Устранение неполадок CI/CD

**Сборка не удается с ошибкой аутентификации:**
- Проверьте, что `DOCKERHUB_USERNAME` точно совпадает с вашим именем пользователя Docker Hub
- Повторно создайте `DOCKERHUB_TOKEN` и обновите секрет

**Образ опубликован, но не удается загрузить:**
- Убедитесь, что репозиторий на Docker Hub является публичным (или вы аутентифицированы)
- Проверьте [hub.docker.com](https://hub.docker.com) → Your repositories → hive-mind → Settings → Make Public

**Сборка выполнена, но образ не появился:**
- Проверьте, что вы отправляете в ветку `main` (pull requests только тестируют, не публикуют)
- Проверьте, что рабочий процесс запустился на вкладке Actions
- Проверьте, не превышены ли лимиты частоты Docker Hub

## Примечания безопасности

- Каждый контейнер сохраняет собственную изолированную аутентификацию
- Учетные данные не совместно используются между контейнерами
- Учетные данные не хранятся в самом образе Docker
- Аутентификация происходит внутри контейнера после его запуска
- Каждый аккаунт GitHub/Claude может иметь свой экземпляр контейнера
- Токены доступа Docker Hub следует хранить только как GitHub Secrets, никогда не коммитить в репозиторий
