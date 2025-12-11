# Каталог scripts/ — Скрипты установки

## Описание

Каталог `scripts/` содержит скрипты для автоматической установки и настройки Hive Mind на различных платформах.

## Файлы

### ubuntu-24-server-install.sh
**Назначение**: Автоматическая установка Hive Mind на Ubuntu 24.04 сервер.

**Что устанавливает**:
- Bun (JavaScript runtime)
- Claude Code CLI
- OpenCode AI CLI
- @link-assistant/agent
- Hive Mind
- Необходимые зависимости (git, screen, etc.)

**Что создаёт**:
- Пользователя `hive` с правильными правами
- Настройки окружения
- Структуру директорий

**Использование**:
```bash
# Выполнить от root
curl -fsSL -o- https://github.com/deep-assistant/hive-mind/raw/refs/heads/main/scripts/ubuntu-24-server-install.sh | bash
```

**Что НЕ делает** (требуется вручную):
- `gh auth login` — авторизация GitHub
- `claude` — авторизация Claude
- Настройка Telegram бота

## После установки

### 1. Переключиться на пользователя hive
```bash
su - hive
```

### 2. Авторизовать GitHub
```bash
gh auth login -h github.com -s repo,workflow,user,read:org,gist

# Настройка git
USERNAME=$(gh api user --jq '.login')
EMAIL=$(gh api user/emails --jq '.[] | select(.primary==true) | .email')

git config --global user.name "$USERNAME"
git config --global user.email "$EMAIL"
```

### 3. Авторизовать Claude
```bash
claude
# Следуйте инструкциям в браузере
```

### 4. Проверить установку
```bash
# Проверка версий
solve --version
hive --version
agent --version

# Тестовый запуск
solve https://github.com/test/repo/issues/1 --dry-run
```

## Системные требования

| Параметр | Минимум | Рекомендуется |
|----------|---------|---------------|
| CPU | 1 ядро | 2+ ядра |
| RAM | 1 GB | 4+ GB |
| SWAP | 2+ GB | 4+ GB |
| Диск | 50 GB | 100+ GB |
| ОС | Ubuntu 24.04 | Ubuntu 24.04 LTS |

## Troubleshooting

### Проблема: Недостаточно места
```bash
df -h
rm -rf /tmp/*
docker system prune -a
```

### Проблема: Claude не отвечает
```bash
claude-profiles logout
claude
```

### Проблема: GitHub токен истёк
```bash
gh auth logout
gh auth login -h github.com -s repo,workflow,user,read:org,gist
```

## Безопасность

**ВАЖНО**: Скрипт устанавливает ПО с полным доступом к системе!

- Используйте только на выделенных VPS
- Не используйте production токены
- Регулярно ротируйте токены
- Мониторьте использование

## Docker альтернатива

Для более безопасной установки используйте Docker:

```bash
docker pull konard/hive-mind:latest
docker run -it konard/hive-mind:latest
```
