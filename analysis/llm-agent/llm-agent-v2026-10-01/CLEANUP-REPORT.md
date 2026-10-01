# Cleanup Report — финальная очистка проекта

> Все ошибки найденные при аудите исправлены.

## Что было исправлено

### 1. Удалены agents/<id>/ для 10 DEPRECATED MCP

Эти MCP-серверы помечены DEPRECATED (пакеты не существуют на npm/PyPI).
Агенты для них тоже не нужны — удалены:

- agents/terraform/
- agents/argocd/
- agents/postgrest/
- agents/cassandra/
- agents/twilio/
- agents/wandb/
- agents/clinical_trials/
- agents/seatunnel/
- agents/supabase/
- agents/github_projects/


### 2. Очищен .env.example.mcp-expansion

Удалены env vars для DEPRECATED MCP:
- SUPABASE_ACCESS_TOKEN
- ARGOCD_SERVER
- ARGOCD_TOKEN
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- WANDB_API_KEY
- SEATUNNEL_API_URL
- POSTGREST_URL
- CASSANDRA_HOST
- CASSANDRA_PORT
- TF_TOKEN
- CLINICAL_TRIALS_API_KEY
- GITHUB_PROJECTS_TOKEN


### 3. Очищен config/settings.yaml.sprint6-addition

Удалены entries для 10 DEPRECATED MCP:
- terraform
- argocd
- postgrest
- cassandra
- twilio
- wandb
- clinical_trials
- seatunnel
- supabase
- github_projects


### 4. Обновлена документация

- `docs/MCP-INTEGRATION.md` — добавлен раздел про DEPRECATED MCP и agent_skills
- `MCP-VERIFICATION-REPORT.md` — обновлён (taste и awesome_design теперь в agent_skills/)

## Финальная статистика после cleanup

| Метрика | До cleanup | После cleanup |
|---|---|---|
| MCP-серверов | 103 | 93 (10 помечены DEPRECATED, но каталоги сохранены) |
| Агентов | 101 | 91 (10 удалены) |
| Agent Skills | 2 | 2 (без изменений) |
| Native Python MCP | 6 | 6 (без изменений) |
| Размер .env.example.mcp-expansion | ~200 строк | ~150 строк |

## Что НЕ трогали

- **103 MCP-сервера в mcp_servers/** — каталоги сохранены с DEPRECATED.md
  для будущего (если пакеты появятся — можно включить)
- **6 нативных Python MCP** в src/mcp_servers/ — все в порядке,
  mcp 1.x контракт, lazy imports, async main()
- **install_mcp_servers.sh** — уже был обновлён в предыдущем спринте
  (не содержит DEPRECATED пакетов)

## Аудит нативных Python MCP

Все 6 нативных MCP прошли проверку:
- ✓ Импорт `from mcp import Server`
- ✓ `app = Server("...")`
- ✓ `@app.list_tools()` decorator (mcp 1.x контракт)
- ✓ `@app.call_tool()` decorator
- ✓ `if __name__ == "__main__": asyncio.run(main())`
- ✓ lazy imports для тяжёлых зависимостей

| MCP | LOC | list_tools | call_tool | main | asyncio.run |
|---|---|---|---|---|---|
| elasticsearch | 238 | ✓ | ✓ | ✓ | ✓ |
| redis | 165 | ✓ | ✓ | ✓ | ✓ |
| brave_search | 150 | ✓ | ✓ | ✓ | ✓ |
| exa_search | 152 | ✓ | ✓ | ✓ | ✓ |
| tavily_search | 156 | ✓ | ✓ | ✓ | ✓ |
| headroom | 200 | ✓ | ✓ | ✓ | ✓ |

## Рекомендации

1. **DEPRECATED MCP (10)** — если очень нужны, реализуйте нативный Python MCP
   для wandb/cassandra/twilio через `scripts/add_mcp_server.py --native`.
   Для terraform/argocd/postgrest/clinical_trials/seatunnel/supabase —
   дождитесь официальных MCP.

2. **Agent Skills** — установите через `bash agent_skills/install_all.sh`,
   если используете Claude Code / Cursor для UI-задач.

3. **MCP-серверы (54 рабочих)** — установите через `bash install_mcp_servers.sh`,
   заполните .env, включите в config/settings.yaml.
