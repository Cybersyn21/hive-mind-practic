# Каталог helm/ — Helm Chart для Kubernetes

## Описание

Каталог `helm/` содержит Helm chart для развёртывания Hive Mind в Kubernetes кластере.

## Структура

```
helm/
└── hive-mind/                # Helm chart
    ├── Chart.yaml           # Метаданные chart
    ├── values.yaml          # Значения по умолчанию
    └── templates/           # Kubernetes манифесты
        ├── deployment.yaml  # Deployment
        ├── service.yaml     # Service
        ├── configmap.yaml   # ConfigMap
        └── ...
```

## Установка

### Добавление репозитория
```bash
helm repo add link-assistant https://link-assistant.github.io/hive-mind
helm repo update
```

### Базовая установка
```bash
helm install hive-mind link-assistant/hive-mind
```

### Установка с кастомными values
```bash
helm install hive-mind link-assistant/hive-mind -f values.yaml
```

### Пример values.yaml
```yaml
replicaCount: 1

image:
  repository: konard/hive-mind
  tag: latest
  pullPolicy: Always

resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "4Gi"
    cpu: "2"

env:
  TELEGRAM_BOT_TOKEN: "your-token"
  TELEGRAM_ALLOWED_CHATS: "-1002975819706"
```

## Обновление

```bash
# Обновление chart
helm repo update
helm upgrade hive-mind link-assistant/hive-mind

# Обновление с новыми values
helm upgrade hive-mind link-assistant/hive-mind -f new-values.yaml
```

## Откат

```bash
# Список ревизий
helm history hive-mind

# Откат к предыдущей версии
helm rollback hive-mind

# Откат к конкретной ревизии
helm rollback hive-mind 3
```

## Удаление

```bash
helm uninstall hive-mind
```

## Преимущества Helm

- ✅ Простое развёртывание в Kubernetes
- ✅ Декларативное управление конфигурацией
- ✅ Лёгкие обновления и откаты
- ✅ Поддержка нескольких реплик
- ✅ Production-ready конфигурация

## Мониторинг

После установки проверьте статус:

```bash
# Pods
kubectl get pods -l app=hive-mind

# Логи
kubectl logs -f deployment/hive-mind

# Описание
kubectl describe deployment hive-mind
```

## Ссылки

- [ArtifactHub](https://artifacthub.io/packages/helm/link-assistant/hive-mind)
- [Полная документация](../docs/HELM.md)
