# Пример анализа GitHub проблемы

## Запрос

```txt
Используйте gh инструмент для получения названия и описания https://github.com/link-assistant/agent/issues/5

Пожалуйста, загрузите все логи и данные, связанные с этой проблемой в этот репозиторий, убедитесь, что мы компилируем эти данные в отдельную папку для этой проблемы в стиле kebab-case ./docs/case-studies, и используйте их для глубокого анализа тематического исследования, в котором мы реконструируем временную шкалу/последовательность событий, найдем корневые причины проблемы и предложим возможные решения.

При компилировании данных также убедитесь, что вы ищете в Интернете, возможно, известные решения уже известны в Интернете.

Убедитесь, что вы сохраняете ссылки на источники в своих документах markdown.
```

## Журнал выполнения

```json
konard@MacBook-Pro-Konstantin agent % echo "Используйте gh инструмент для получения названия и описания https://github.com/link-assistant/agent/issues/5

Пожалуйста, загрузите все логи и данные, связанные с этой проблемой в этот репозиторий, убедитесь, что мы компилируем эти данные в отдельную папку для этой проблемы в стиле kebab-case ./docs/case-studies, и используйте их для глубокого анализа тематического исследования, в котором мы реконструируем временную шкалу/последовательность событий, найдем корневые причины проблемы и предложим возможные решения.

При компилировании данных также убедитесь, что вы ищете в Интернете, возможно, известные решения уже известны в Интернете.

Убедитесь, что вы сохраняете ссылки на источники в своих документах markdown." | agent
{
  "type": "step_start",
  "timestamp": 1763627174011,
  "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
  "part": {
    "id": "prt_aa05f087a001f5VGIIXsOEv5xS",
    "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
    "messageID": "msg_aa05f0223001gyiDLm66AVtTbS",
    "type": "step-start",
    "snapshot": "9eb7113cec838860d07ca261f0b0b9777a240906"
  }
}
{
  "type": "tool_use",
  "timestamp": 1763627177460,
  "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
  "part": {
    "id": "prt_aa05f116f001sPM6yohGtbkJ58",
    "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
    "messageID": "msg_aa05f0223001gyiDLm66AVtTbS",
    "type": "tool",
    "callID": "call_92429346",
    "tool": "bash",
    "state": {
      "status": "completed",
      "input": {
        "command": "gh issue view 5 --repo link-assistant/agent",
        "description": "Fetch title and description of issue #5"
      },
      "output": "title:\tОшибка установки\nstate:\tOPEN\nauthor:\tunidel2035\nlabels:\t\ncomments:\t0\nassignees:\t\nprojects:\t\nmilestone:\t\nnumber:\t5\n--\nunidel@DG:~$ # Install Bun first if you haven't already\ncurl -fsSL https://bun.sh/install | bash\n######################################################################## 100.0%\nbun was installed successfully to ~/.bun/bin/bun\nRun 'bun --help' to get started\nunidel@DG:~$ # Install the package globally\nbun install -g @link-assistant/agent\nbun add v1.3.2 (b131639c)\nInvalidNPMLockfile: failed to migrate lockfile: 'package-lock.json'\n\nwarn: Ignoring lockfile\nwarn: incorrect peer dependency \"solid-js@1.9.10\"\n\ninstalled @link-assistant/agent@0.0.2 with binaries:\n - agent\n\n444 packages installed [8.77s]\n\nBlocked 2 postinstalls. Run bun pm -g untrusted for details.\nunidel@DG:~$ echo \"hi\" | agent\n75 |     const json = await data()\n                            ^\nerror: For security reasons, macros cannot be run from node_modules.\n    at /home/unidel/node_modules/@link-assistant/agent/src/provider/models.ts:75:24\n\nBun v1.3.2 (Linux x64)\n",
      "title": "gh issue view 5 --repo link-assistant/agent",
      "metadata": {
        "output": "title:\tОшибка установки\nstate:\tOPEN\nauthor:\tunidel2035\nlabels:\t\ncomments:\t0\nassignees:\t\nprojects:\t\nmilestone:\t\nnumber:\t5\n--\nunidel@DG:~$ # Install Bun first if you haven't already\ncurl -fsSL https://bun.sh/install | bash\n######################################################################## 100.0%\nbun was installed successfully to ~/.bun/bin/bun\nRun 'bun --help' to get started\nunidel@DG:~$ # Install the package globally\nbun install -g @link-assistant/agent\nbun add v1.3.2 (b131639c)\nInvalidNPMLockfile: failed to migrate lockfile: 'package-lock.json'\n\nwarn: Ignoring lockfile\nwarn: incorrect peer dependency \"solid-js@1.9.10\"\n\ninstalled @link-assistant/agent@0.0.2 with binaries:\n - agent\n\n444 packages installed [8.77s]\n\nBlocked 2 postinstalls. Run bun pm -g untrusted for details.\nunidel@DG:~$ echo \"hi\" | agent\n75 |     const json = await data()\n                            ^\nerror: For security reasons, macros cannot be run from node_modules.\n    at /home/unidel/node_modules/@link-assistant/agent/src/provider/models.ts:75:24\n\nBun v1.3.2 (Linux x64)\n",
        "exit": 0,
        "description": "Fetch title and description of issue #5"
      },
      "time": {
        "start": 1763627176313,
        "end": 1763627177457
      }
    }
  }
}
{
  "type": "step_finish",
  "timestamp": 1763627177489,
  "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
  "part": {
    "id": "prt_aa05f15f6001zF9ho1Osx5mX4q",
    "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
    "messageID": "msg_aa05f0223001gyiDLm66AVtTbS",
    "type": "step-finish",
    "reason": "tool-calls",
    "snapshot": "9eb7113cec838860d07ca261f0b0b9777a240906",
    "cost": 0,
    "tokens": {
      "input": 139,
      "output": 51,
      "reasoning": 368,
      "cache": {
        "read": 11520,
        "write": 0
      }
    }
  }
}

... [сокращено для краткости] ...

{
  "type": "text",
  "timestamp": 1763627231300,
  "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
  "part": {
    "id": "prt_aa05fe540001bTHLA57aZgxQVg",
    "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
    "messageID": "msg_aa05fe22f001hJY5dSH5i4Ji2d",
    "type": "text",
    "text": "Тематическое исследование завершено. Я создал папку `./docs/case-studies/installation-error/` и составил подробный анализ в `case-study.md`, включая временную шкалу, корневые причины, решения и ссылки. Данные проблемы сохранены в `issue-5.json`. Корневая причина - это ограничение безопасности Bun на макросы в node_modules, а рекомендуемое исправление - построить пакет перед публикацией для встраивания макросов.",
    "time": {
      "start": 1763627231300,
      "end": 1763627231300
    }
  }
}
{
  "type": "step_finish",
  "timestamp": 1763627231333,
  "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
  "part": {
    "id": "prt_aa05fe845001vMJjZ2XQRYuTlc",
    "sessionID": "ses_55fa0fe18ffeEw7d7T3j1Yrw3r",
    "messageID": "msg_aa05fe22f001hJY5dSH5i4Ji2d",
    "type": "step-finish",
    "reason": "stop",
    "snapshot": "392692e7188c8ac104d29c345780b72078396214",
    "cost": 0,
    "tokens": {
      "input": 97,
      "output": 84,
      "reasoning": 12,
      "cache": {
        "read": 23616,
        "write": 0
      }
    }
  }
}
konard@MacBook-Pro-Konstantin agent %
```

## Результат анализа

Данный пример демонстрирует полный цикл анализа GitHub проблемы с использованием агента:

1. **Получение информации о проблеме** - использование команды `gh issue view` для извлечения деталей
2. **Создание структуры папок** - организация данных в структурированную папку case-studies
3. **Загрузка и архивирование данных** - сохранение полной информации о проблеме в JSON формате
4. **Поиск решений в Интернете** - использование веб-поиска для поиска известных решений
5. **Анализ и составление отчета** - создание подробного документа с временной шкалой, корневыми причинами и предложенными решениями
6. **Документирование источников** - сохранение всех ссылок на источники в markdown документах

Результатом является полное тематическое исследование (case study), готовое к использованию и общему доступу.
