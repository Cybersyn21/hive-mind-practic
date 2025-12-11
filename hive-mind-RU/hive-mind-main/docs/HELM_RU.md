# Документация Helm Chart

Этот документ предоставляет полное руководство по развертыванию Hive Mind на Kubernetes с помощью Helm.

## Предварительные условия

- Кластер Kubernetes 1.19+
- Helm 3.0+
- `kubectl` настроен для доступа к вашему кластеру
- Достаточные ресурсы в кластере (см. [Требования к ресурсам](#требования-к-ресурсам))

## Установка

### Добавить Helm репозиторий

```bash
helm repo add link-assistant https://link-assistant.github.io/hive-mind
helm repo update
```

### Установить Chart

#### Базовая установка

```bash
helm install hive-mind link-assistant/hive-mind
```

#### Установка с пользовательскими значениями

```bash
helm install hive-mind link-assistant/hive-mind -f custom-values.yaml
```

#### Установка в конкретное пространство имен

```bash
kubectl create namespace hive-mind
helm install hive-mind link-assistant/hive-mind -n hive-mind
```

## Конфигурация

### Значения по умолчанию

`values.yaml` по умолчанию обеспечивает разумные значения по умолчанию для большинства развертываний. Ключевые варианты конфигурации:

### Требования к ресурсам

Распределение ресурсов по умолчанию:

```yaml
resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 1Gi
```

**Рекомендуемые минимальные ресурсы на pod:**
- CPU: 500m (0.5 ядра)
- Memory: 1Gi ОЗУ
- Disk: 50Gi постоянное хранилище

### Конфигурация постоянного хранилища

По умолчанию постоянное хранилище включено с размером 50Gi:

```yaml
persistence:
  enabled: true
  accessMode: ReadWriteOnce
  size: 50Gi
```

**Использование конкретного класса хранилища:**

```yaml
persistence:
  enabled: true
  storageClass: "fast-ssd"
  size: 100Gi
```

**Использование существующего PVC:**

```yaml
persistence:
  enabled: true
  existingClaim: "my-existing-pvc"
```

### Конфигурация аутентификации

Hive Mind требует аутентификацию GitHub и Claude. Они должны быть настроены через секреты Kubernetes:

#### Создать секрет GitHub Token

```bash
kubectl create secret generic hive-github-token \
  --from-literal=token='ghp_your_github_token_here'
```

#### Создать секрет Claude API Key

```bash
kubectl create secret generic hive-claude-api-key \
  --from-literal=apiKey='sk-ant-your_claude_key_here'
```

#### Ссылка на секреты в значениях

```yaml
secrets:
  githubToken: "hive-github-token"
  claudeApiKey: "hive-claude-api-key"
```

### Запуск как Telegram Bot

Для запуска Hive Mind как Telegram бота в Kubernetes:

```yaml
command:
  - /bin/bash
  - -c
  - |
    # Аутентифицируйтесь в GitHub, используя токен из секрета
    echo "$GITHUB_TOKEN" | gh auth login --with-token

    # Запустить Telegram бота
    hive-telegram-bot --configuration "
      TELEGRAM_BOT_TOKEN: '$TELEGRAM_BOT_TOKEN'
      TELEGRAM_ALLOWED_CHATS:
        -1002975819706
      TELEGRAM_HIVE_OVERRIDES:
        --all-issues
        --once
        --auto-fork
        --attach-logs
        --verbose
      TELEGRAM_BOT_VERBOSE: true
    "

env:
  TELEGRAM_BOT_TOKEN: "your-telegram-bot-token"
```

### Автомасштабирование

Включить горизонтальное автомасштабирование pod для нескольких экземпляров ботов:

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80
```

### Выбор узлов и сродство

#### Node Selector

Развертывание на конкретных узлах:

```yaml
nodeSelector:
  disktype: ssd
  workload: ai-intensive
```

#### Tolerations

Разрешить планирование на помеченных узлах:

```yaml
tolerations:
  - key: "ai-workload"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
```

#### Правила сродства

Совместное размещение или распределение pod:

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - hive-mind
          topologyKey: kubernetes.io/hostname
```

## Распространенные сценарии использования

### Пример 1: Одиночный экземпляр бота

Простое развертывание для тестирования или малого масштаба:

```yaml
# values-simple.yaml
replicaCount: 1

persistence:
  enabled: true
  size: 50Gi

resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 1000m
    memory: 2Gi
```

```bash
helm install hive-mind link-assistant/hive-mind -f values-simple.yaml
```

### Пример 2: Рабочий Telegram Bot

Развертывание с высокой доступностью и автомасштабированием:

```yaml
# values-production.yaml
replicaCount: 3

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

persistence:
  enabled: true
  storageClass: "fast-ssd"
  size: 100Gi

resources:
  requests:
    cpu: 1000m
    memory: 2Gi
  limits:
    cpu: 2000m
    memory: 4Gi

secrets:
  githubToken: "hive-github-token"
  claudeApiKey: "hive-claude-api-key"

command:
  - /bin/bash
  - -c
  - |
    echo "$GITHUB_TOKEN" | gh auth login --with-token
    hive-telegram-bot --token "$TELEGRAM_BOT_TOKEN" --verbose

podAntiAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchExpressions:
          - key: app.kubernetes.io/name
            operator: In
            values:
              - hive-mind
      topologyKey: "kubernetes.io/hostname"
```

```bash
helm install hive-mind link-assistant/hive-mind -f values-production.yaml
```

### Пример 3: Окружение разработки

Минимальные ресурсы для разработки/тестирования:

```yaml
# values-dev.yaml
replicaCount: 1

persistence:
  enabled: false

resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: 500m
    memory: 1Gi
```

```bash
helm install hive-mind-dev link-assistant/hive-mind -f values-dev.yaml
```

## Обновление

### Обновить репозиторий

```bash
helm repo update
```

### Обновить выпуск

```bash
helm upgrade hive-mind link-assistant/hive-mind
```

### Обновить с новыми значениями

```bash
helm upgrade hive-mind link-assistant/hive-mind -f new-values.yaml
```

### Откат

```bash
# Список истории выпусков
helm history hive-mind

# Откат к предыдущей версии
helm rollback hive-mind

# Откат к определенной редакции
helm rollback hive-mind 2
```

## Удаление

```bash
helm uninstall hive-mind
```

**Примечание:** По умолчанию PersistentVolumeClaims не удаляются автоматически. Для их удаления:

```bash
kubectl delete pvc -l app.kubernetes.io/name=hive-mind
```

## Устранение неполадок

### Проверить статус Pod

```bash
kubectl get pods -l app.kubernetes.io/name=hive-mind
```

### Просмотреть логи Pod

```bash
kubectl logs -l app.kubernetes.io/name=hive-mind --tail=100 -f
```

### Получить доступ к оболочке Pod

```bash
kubectl exec -it deployment/hive-mind -- /bin/bash
```

### Проверить статус PVC

```bash
kubectl get pvc
kubectl describe pvc hive-mind
```

### Распространенные проблемы

#### Pod не запускается

**Симптом:** Pod зависает в состоянии `Pending`

**Решения:**
1. Проверьте ресурсы узла: `kubectl describe node`
2. Проверьте, привязан ли PVC: `kubectl get pvc`
3. Проверьте существование класса хранилища: `kubectl get storageclass`

#### Проблемы с аутентификацией

**Симптом:** Команды GitHub/Claude не работают

**Решения:**
1. Проверьте существование секретов: `kubectl get secrets`
2. Проверьте содержимое секрета: `kubectl describe secret hive-github-token`
3. Вручную аутентифицируйтесь внутри pod:
   ```bash
   kubectl exec -it deployment/hive-mind -- /bin/bash
   gh auth login
   claude
   ```

#### Нехватка памяти

**Симптом:** Pod завершается с OOMKilled

**Решения:**
1. Увеличьте лимиты памяти в values.yaml
2. Мониторьте текущее использование: `kubectl top pods`
3. Рассмотрите использование автомасштабирования

## Расширенная конфигурация

### Несколько Helm выпусков

Запуск нескольких изолированных экземпляров Hive Mind:

```bash
# Экземпляр 1 - Команда A
helm install hive-team-a link-assistant/hive-mind \
  -n team-a --create-namespace \
  -f team-a-values.yaml

# Экземпляр 2 - Команда B
helm install hive-team-b link-assistant/hive-mind \
  -n team-b --create-namespace \
  -f team-b-values.yaml
```

### Пользовательский образ

Использование пользовательского образа Docker:

```yaml
image:
  repository: myregistry.com/custom-hive-mind
  tag: "1.0.0"
  pullPolicy: Always

imagePullSecrets:
  - name: myregistrykey
```

### Дополнительные томы

Монтирование дополнительных томов:

```yaml
volumes:
  - name: custom-config
    configMap:
      name: hive-config

volumeMounts:
  - name: custom-config
    mountPath: /etc/hive-config
    readOnly: true
```

## Мониторинг и наблюдаемость

### Мониторинг ресурсов

```bash
# Просмотреть использование ресурсов
kubectl top pods -l app.kubernetes.io/name=hive-mind

# Непрерывный мониторинг
watch kubectl top pods -l app.kubernetes.io/name=hive-mind
```

### Логирование

Интеграция с системами логирования, такими как ELK, Loki или CloudWatch:

```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "9090"
```

## Лучшие практики безопасности

1. **Используйте управление секретами:** Храните токены GitHub и API ключи в секретах Kubernetes или внешних менеджерах секретов (HashiCorp Vault, AWS Secrets Manager)

2. **Сетевые политики:** Ограничьте сетевой доступ между pod:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: hive-mind-netpol
   spec:
     podSelector:
       matchLabels:
         app.kubernetes.io/name: hive-mind
     policyTypes:
       - Ingress
       - Egress
     egress:
       - to:
         - namespaceSelector: {}
   ```

3. **Стандарты безопасности Pod:** Используйте ограниченные стандарты безопасности pod:
   ```yaml
   podSecurityContext:
     runAsNonRoot: true
     runAsUser: 1000
     fsGroup: 1000
     seccompProfile:
       type: RuntimeDefault
   ```

4. **RBAC:** Создайте минимальные разрешения роли для учетной записи сервиса

5. **Регулярные обновления:** Держите chart и образ контейнера в актуальном состоянии

## Поддержка и участие

- **GitHub Issues:** https://github.com/link-assistant/hive-mind/issues
- **Документация:** https://github.com/link-assistant/hive-mind
- **Docker Hub:** https://hub.docker.com/r/konard/hive-mind
- **ArtifactHub:** https://artifacthub.io/packages/helm/link-assistant/hive-mind

## Лицензия

Этот Helm chart выпущен под лицензией Unlicense. См. файл [LICENSE](https://github.com/link-assistant/hive-mind/blob/main/LICENSE) для подробностей.
