# INTEGRATION NOTES — llm-agent + UniversalSniffer v3.1 (+ 1C Designer Tools, OAC)

Дата: 2026-10-01 · Патч-пакет: `llm-agent-v2026-10-01-sniffer-integration.zip`
(2.5 МБ, распакованное дерево llm-agent-v2026-10-01 с интеграцией)

## Состав пакета

- Пропатченное дерево `llm-agent-v2026-10-01/` (Python/FastAPI, мультиагентная система)
- **Вендоренный сниффер**: `src/sniffer/` — UniversalSniffer v3.1 целиком
  (`sniffcore/` 9 модулей, `parsers/` 5 парсеров + плагины, `webui/`, config.json,
  README), stdlib-only, Python 3.7+, ноль новых зависимостей
  (`__init__.py`, `__main__.py`, `selftest.py` добавлены при вендоринге)
- **Новый MCP-сервер `sniffer`**: `src/mcp_servers/sniffer/server.py` +
  `mcp_servers/sniffer/server.yaml` — **16 инструментов** (HTTP-клиент к панели
  :9500 + запуск/остановка subprocess + анализ)
- **Новый агент `sniffer`**: `agents/sniffer/{agent.yaml,prompt.md,user.md}`
- **MCP `onec_designer_tools`** (из GitHub comol/mcp_designer_tools):
  `src/mcp_servers/onec_designer_tools/` (server.py, tools/ИнструментыДляРазработки.xml,
  config/httpd.conf + mcpconfig.json + default.vrd, README.md) +
  `mcp_servers/onec_designer_tools/server.yaml` + `agents/onec_designer_tools/` —
  5 инструментов: vcexecutecode, vcexecutequery, vcvalidatequery,
  vcloggetlasterror, vc_tools_list (JSON-RPC 2.0 → ONEC_MCP_URL)
- **OAC-методология** (из GitHub alexeyk222/Agents): `loops/oac_pipeline.yaml`
  (анализ → план → подтверждение → выполнение → проверка), `docs/OAC_INTEGRATION.md`,
  шаблоны `agents/_templates/oac/` (context-bundle-template.md, navigation.md),
  агент `agents/oac_orchestrator/`
- **Документация**: `docs/SNIFFER_INTEGRATION.md` (полная), `docs/OAC_INTEGRATION.md`,
  обновлены `README.md` (40 MCP / 39 агентов) и `docs/CAPABILITIES.md`,
  `config/settings.yaml` (+ секции `sniffer`, `onec_designer_tools` c env `${VAR}`)

## Установка

1. Распаковать архив поверх корня `llm-agent-v2026-10-01/` (файлы добавляются,
   ничего не удаляется).
2. Новых pip-зависимостей нет: сниффер — только стандартная библиотека;
   MCP-серверам нужен уже используемый пакет `mcp`.
3. Проверка сниффера: `python3 -m src.sniffer.selftest` → печатает **PASS**
   (эхо-сервер + прокси in-process, работает без сети; если порты 19000/19001
   заняты — автоматически берёт свободные).
4. Запуск сниффера: `python3 -m src.sniffer --config src/sniffer/config.json`
   или `python3 -m src.sniffer --ports 3003:3004,10010:10011`.
5. Веб-панель сниффера: http://127.0.0.1:9500 (HTTP API: /api/status, /api/stats,
   /api/series, /api/sessions, /api/packets, /api/packet/<id>, /api/config,
   /api/alerts, /api/export/csv, POST /api/reload).
6. Агенты `sniffer`, `onec_designer_tools`, `oac_orchestrator` и MCP-серверы
   подхватятся автоматически при старте llm-agent (сканирование каталогов
   `agents/` и `mcp_servers/`). Данные сниффера: `data/sniffer/` (capture/,
   plugins/), pid — `data/sniffer.pid`.

## MCP-инструменты sniffer (16)

sniffer_status, sniffer_start*, sniffer_stop*, sniffer_restart*, sniffer_stats,
sniffer_series, sniffer_sessions, sniffer_packets (фильтры на стороне MCP),
sniffer_packet_detail (с hexdump), sniffer_alerts, sniffer_config_get,
sniffer_reload, sniffer_export_csv, sniffer_list_capture, sniffer_read_capture
(белый список расширений, защита от path traversal), sniffer_analyze
(сводка для LLM: протоколы, клиенты, ошибки, аномалии, crit-тревоги).
(* — `danger: external`, проходят approval gate; описания помечены
«ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ».)

Переменные окружения: `SNIFFER_PANEL_URL` (по умолчанию http://127.0.0.1:9500),
`SNIFFER_WEB_PORT`, `PROJECT_ROOT`, `USNIFF_ROOT`; для 1С — `ONEC_MCP_URL`
(по умолчанию http://127.0.0.1:8795/mcp), `ONEC_MCP_TOKEN`.

## Сценарий АЗС (как в README UniversalSniffer)

1. Остановить RemoteServer; запустить его на портах 3004 и 10011.
2. Сниффер слушает старые порты: `python3 -m src.sniffer --ports 3003:3004,10010:10011`.
3. АЗС подключаются как раньше; трафик виден в панели и пишется в
   `data/sniffer/capture/` (JSONL/SQLite/PCAP/CSV).
4. Тревоги: «Thrift EXCEPTION», «Откат безналичной оплаты» (≥2 за 60 c),
   «Гигантский пакет» (>1 МБ), «Ошибка БД в запросе»; cooldown 30 c;
   файл — `capture/alerts.jsonl`.

## Правила алертов (src/sniffer/config.json)

1. **Thrift EXCEPTION** — crit — protocol=THRIFT, msg_type=EXCEPTION
2. **Откат безналичной оплаты** — crit — method_type=CASHLESS_ROLLBACK, порог 2/60 c
3. **Гигантский пакет** — warn — size_gt: 1 000 000 Б
4. **Ошибка БД в запросе** — warn — cmd_type=DB_REQUEST + keyword «error»

## Проверки, выполненные при сборке

- `py_compile` всех новых/изменённых .py — OK
- YAML-валидация всех новых .yaml + pydantic-схемы проекта (AgentSchema,
  MCPServerSchema, LoopSpec) — OK
- `python3 -m src.sniffer.selftest` — **PASS** (8 пакетов: HTTP/JSON/RAW, эхо 4/4)
- Smoke MCP stdio: list_tools 16/16 (sniffer) и 5/5 (onec_designer_tools) — OK
- E2E через MCP-клиент: sniffer_start → status (панель :9500, порты) → stats →
  list_capture → блокировка `../server.py` в read_capture → sniffer_stop — OK
- Декларации подхватываются загрузчиком проекта (DeclarationLoader) — YES

## Риски

- `vcexecutecode`/`vcexecutequery` исполняют код/запросы в базе 1С —
  только доверенные окружения, approval gate включён (`danger: external`).
- `sniffer_start/stop/restart` управляют процессом сниффера — помечены danger,
  промпт агента требует подтверждения перед запуском.
- Экспорт PCAP растёт быстро: `pcap_rotation_mb`/`pcap_keep` в config.json.
- В репозитории есть заранее сломанные YAML-декларации других агентов
  (argocd, cassandra, wandb, twilio, terraform, seatunnel, supabase, qa_mcp,
  headroom, clinical_trials, image23js, impeccable, playwright_cli) — это
  состояние исходного архива, интеграцией не затронуто.
