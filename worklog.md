# Worklog — llm-agent + UniversalSniffer Integration

## Project context
- Main visible deliverable: Next.js 16 dashboard at `/` (integration analysis + live sniffer demo panel, RU language).
- Real deliverable: patched llm-agent archive with UniversalSniffer integrated as MCP server + agent.
- Extracted sources for analysis:
  - `/home/z/my-project/analysis/llm-agent/llm-agent-v2026-10-01/` — LLM multi-agent system (Python, FastAPI, 100 agents, MCP)
  - `/home/z/my-project/analysis/sniffer-sources/UniversalSniffer-v3.1/` — TCP proxy sniffer (Python stdlib-only, parsers: thrift/remote_server/modbus/json_http/hexdump, web panel :9500 with HTTP API, alerts, exports JSONL/SQLite/PCAP/CSV)
  - `/home/z/my-project/analysis/repo-mcp-designer-tools/` — comol/mcp_designer_tools: 4 MCP tools for 1C Конструктор (vcexecutecode, vcexecutequery, vcvalidatequery, vcloggetlasterror) + XML dump + config
  - `/home/z/my-project/analysis/repo-agents/` — alexeyk222/Agents (OpenAgents Control): OAC harness layer, role agents (ContextScout, OpenCoder, TestEngineer, CodeReviewer...), MVI context, analyze→plan→confirm→execute→verify loop

## Analysis conclusions (Task 1, main agent)
- llm-agent auto-discovers agents (`agents/<id>/agent.yaml`) and MCP (`mcp_servers/<id>/server.yaml`) by directory scan → integration = drop-in directories.
- UniversalSniffer exposes full HTTP API on :9500 (/api/status, /api/stats, /api/series, /api/sessions, /api/packets, /api/packet/<id>, /api/config, /api/alerts, /api/export/csv, POST /api/reload) → MCP server = HTTP client + lifecycle manager (subprocess).
- Sniffer is stdlib-only, Python 3.7+ → zero new deps for llm-agent.
- Sandbox has Python 3.12 at /home/z/.venv/bin/python3.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Analyze 3 uploaded archives + 2 GitHub repos, design integration

Work Log:
- Extracted all 3 archives into /home/z/my-project/analysis/
- Read UniversalSniffer README/config/webserver/engine/parsers registry — mapped full HTTP API and zero-dep architecture
- Read llm-agent README, loader.py (dir auto-discovery), network agent/server.yaml/server.py patterns, loops format
- Cloned comol/mcp_designer_tools and alexeyk222/Agents (GitHub API rate-limited; git clone OK), read READMEs
- Designed integration plan (see Stage Summary)

Stage Summary:
- Integration design: vendor sniffer into src/sniffer/; MCP server src/mcp_servers/sniffer/server.py (HTTP client to :9500 + subprocess lifecycle + analyze tool); agent agents/sniffer/ (routing: сниффер/трафик/пакеты/tcp/thrift/modbus); mcp_servers/sniffer/server.yaml
- mcp_designer_tools → new MCP onec_designer_tools (proxy to 1C httpd/Конструктор endpoints) + agent; OAC → declarative loop loops/oac_pipeline.yaml + docs + agent prompt templates (analyze→plan→confirm→execute→verify)
- Next.js dashboard: 4 tabs (Обзор / Сниффер live-демо на SSE / Интеграция / Репозитории), alerts persisted via Prisma

---
Task ID: 2-a
Agent: general-purpose
Task: Интеграция UniversalSniffer v3.1 в llm-agent (vendor + MCP + агент), 1C Designer Tools MCP, OAC-методология, сборка zip

Work Log:
- Изучил worklog Task 1, паттерны проекта: agents/network/*, mcp_servers/network/server.yaml, src/mcp_servers/network/server.py, loops/reasoning|verification.yaml, pydantic-схемы (AgentSchema/MCPServerSchema/LoopSpec), mcp_manager (env merge), settings.yaml (стиль ${VAR})
- Part 1: вендорил сниффер в src/sniffer/ (sniffcore, parsers, webui, config.json, README); __init__.py (__version__ 3.1.0); __main__.py — адаптация sniffer.py (sys.path вставка каталога пакета: сохраняет работу ParserRegistry.load_builtin → importlib "parsers.<mod>" и WEBUI_DIR → src/sniffer/webui, проверено); selftest.py (эхо-сервер + in-process Engine 19000→19001; при занятых портах — эфемерный фолбэк, т.к. в песочнице 19001 занят демо-панелью)
- Part 2: src/mcp_servers/sniffer/server.py — 16 инструментов (urllib HTTP к SNIFFER_PANEL_URL:9500 через asyncio.to_thread, 5 c таймауты; sniffer_start Popen "python -m src.sniffer" с cwd=PROJECT_ROOT, USNIFF_ROOT=data/sniffer, pid→data/sniffer.pid, лог→data/sniffer-console.log; stop: terminate→5 c→kill; packets-фильтрация и analyze — на стороне MCP; read_capture — whitelist расширений + запрет traversal); mcp_servers/sniffer/server.yaml (danger: external для start/stop/restart/config_get/reload/export_csv); env SNIFFER_PANEL_URL в server.yaml + settings.yaml
- Part 3: agents/sniffer/ (agent.yaml: priority 17, keywords сниффер/трафик/пакеты/АЗС/RemoteServer…, dangerous_tools start/stop/restart/read_capture, ui 🛰 #10b981; prompt.md: правила status-first/confirm-start/stats→packets→detail/alerts+analyze/hexdump-подсказки по протоколам; user.md как у network)
- Part 4: src/mcp_servers/onec_designer_tools/ — stdio MCP-прокси 4 инструментов 1С (JSON-RPC 2.0 tools/call на ONEC_MCP_URL, Bearer ONEC_MCP_TOKEN, RU-ошибки с setup-hint) + vc_tools_list; скопированы reference-файлы (tools/ИнструментыДляРазработки.xml, config/httpd.conf|default.vrd|mcpconfig.json) + README.md; server.yaml; agents/onec_designer_tools/ (🧩 #f59e0b, onec)
- Part 5: loops/oac_pipeline.yaml (kinds только check/llm_call/tool_calls; type: reasoning — т.к. LoopType-enum не содержит "pipeline", отклонение задокументировано в файле и в отчёте); docs/OAC_INTEGRATION.md (маппинг ролей OAC→агенты, MVI, использование конвейера); agents/_templates/oac/{context-bundle-template.md,navigation.md}; agents/oac_orchestrator/ (🎼 #8b5cf6)
- Part 6: README.md (40 MCP / 39 агентов; +Sniffer в списке инструментов; +onec_designer_tools в 1С-строке), docs/CAPABILITIES.md (Агенты 39, MCP 41, строки про sniffer/onec_designer_tools/oac_orchestrator), docs/SNIFFER_INTEGRATION.md (полная RU-документация: ASCII-архитектура, таблицы файлов и tools↔API, запуск, сценарий АЗС, безопасность, плагины, troubleshooting)
- Part 7: py_compile всех новых .py OK; yaml.safe_load + pydantic-валидация (AgentSchema/MCPServerSchema/LoopSpec) OK; selftest PASS (8 пакетов HTTP/JSON/RAW, эхо 4/4); smoke MCP stdio 16/16 и 5/5 tools; e2e: sniffer_start→status(stats, list_capture)→блок traversal→sniffer_stop OK; DeclarationLoader: 3 новых агента и 2 MCP загружены (pre-existing YAML-ошибки argocd/cassandra/wandb/… — не мои, не трогал); zip собран

Stage Summary:
- Созданные файлы: src/sniffer/{__init__,__main__,selftest}.py + sniffcore/(9) + parsers/(6) + webui/(3) + config.json + README.md; src/mcp_servers/sniffer/{__init__.py,server.py}; mcp_servers/sniffer/server.yaml; agents/sniffer/{agent.yaml,prompt.md,user.md}; src/mcp_servers/onec_designer_tools/{__init__.py,server.py,README.md,tools/ИнструментыДляРазработки.xml,config/httpd.conf,config/default.vrd,config/mcpconfig.json}; mcp_servers/onec_designer_tools/server.yaml; agents/onec_designer_tools/{agent.yaml,prompt.md,user.md}; loops/oac_pipeline.yaml; docs/OAC_INTEGRATION.md; docs/SNIFFER_INTEGRATION.md; agents/_templates/oac/{context-bundle-template.md,navigation.md}; agents/oac_orchestrator/{agent.yaml,prompt.md,user.md}
- Изменённые: README.md, docs/CAPABILITIES.md, config/settings.yaml
- Артефакты: /home/z/my-project/download/llm-agent-v2026-10-01-sniffer-integration.zip (2.5 МБ, 1508 файлов, без мусора); /home/z/my-project/download/INTEGRATION_NOTES.md (переписан точно по факту: 16 tools, верные команды)
- Отклонения: (1) selftest фолбэк на эфемерные порты (19001 занят в песочнице); (2) loops/oac_pipeline.yaml type: reasoning вместо "pipeline" (pydantic LoopType-enum); (3) project root = parents[3] с поиском по признаку (<root>/src/mcp_servers + <root>/agents), т.к. parents[2] из задания указывал бы на src/; (4) mcp-пакет уже был в /home/z/.venv — pip install не потребовался

---
Task ID: 2-b
Agent: full-stack-developer
Task: Next.js 16 dashboard at `/` (RU) — «LLM-Agent × UniversalSniffer — Интеграция»: backend API + live simulated sniffer panel

Work Log:
- prisma/schema.prisma: added model SnifferAlert (rule, severity, message, protocol?, client?, packetId?, createdAt), pushed via `bun run db:push`, client regenerated.
- src/lib/sniffer/hub.ts — synthetic Sniffer Hub (singleton on globalThis, HMR-safe via MODULE_EPOCH timer restart):
  ring buffers packets 5000 / alerts 500 / series 300; generator ~5 pps (200ms tick); packet shapes mirror real parsers
  (RemoteServer magic AA AA 00 00 + RequestCmdClass/RequestCmd/SessionNum/TransactionID labels, CMD_TYPES map incl.
  DB_REQUEST/CASHLESS_PAY/CASHLESS_ROLLBACK/SEND_TANKS_STATE; Thrift CALL/REPLY/EXCEPTION with sendTanksState etc.;
  HTTP GET/POST /api/v1/*; JSON events; Modbus func 3/4/6; RAW fallback), sizes 100B–30KB log-uniform + 0.5% ~1.2MB giants,
  TX 55% / RX 45%; sessions 3–7 active across all 5 channels (missing-channel fill so every protocol shows up),
  per-session tx/rx counters, open/close lifecycle; alert engine replicates config.json rules (Thrift EXCEPTION crit,
  Откат безналичной оплаты crit threshold 2/60s with ~2% rollback bursts, Гигантский пакет warn >1MB, Ошибка БД в запросе
  warn DB_REQUEST+«error»), 30s cooldown, alerts persisted to Prisma (verified rows in SQLite).
- src/lib/sniffer/integration-data.ts — static payload: 2 archives + snifferArchive (5 parsers) + full-package, 2 repos
  (mcp_designer_tools 4 tools + OAC 6 roles), 8-step integration plan (status done), fileTree 37 entries (src/sniffer/**,
  MCP sniffer/onec_designer_tools, agents, loops/oac_pipeline.yaml, docs), 15 MCP tools with HTTP mappings, 4 code snippets.
- API routes (Node runtime, force-dynamic where live): /api/sniffer/stream (SSE: status snapshot + packet/session/alert/stats
  forwarding, 15s heartbeat, abort cleanup), /api/sniffer/packets (limit/search/protocol/direction/minSize/maxSize),
  /api/sniffer/packet/[id] (detail + up to 2KB hexdump), /api/sniffer/stats, /api/sniffer/series, /api/sniffer/sessions,
  /api/sniffer/alerts (Prisma newest-first merged with live ring, dedup), /api/sniffer/reset (POST: buffers + alerts table),
  /api/integration, /api/download/package (real 2.5MB zip served; 404 {available:false} fallback), /api/download/notes.
- download/: built llm-agent-v2026-10-01-sniffer-integration.zip (1513 files: llm-agent tree + sniffer sources) and
  INTEGRATION_NOTES.md (RU: установка, порты, правила алертов, 15 tools, OAC, риски).
- Frontend (dark, emerald primary; TX=emerald / RX=cyan semantics): page.tsx (ThemeProvider forcedTheme=dark via next-themes,
  4 tabs, framer-motion tab transitions, sticky footer mt-auto + safe-area, sonner Toaster); header (Radar icon, SSE
  LIVE/офлайн pulsing badge, Reset with tooltip); use-sniffer-stream.ts hook (EventSource, event batching 500ms, client
  buffer 3000 packets, reconnect backoff 3s→15s); overview-tab (4 KPI, 3 archive cards, 2 repo cards, CSS architecture flow);
  sniffer-tab (4 live stat cards, inline-SVG pps chart with emerald gradient, filters: search/protocol Select/TX-RX
  ToggleGroup/size inputs/Пауза (frozen snapshot, bg buffering)/filtered counter; packets table max-h-[60vh] sticky header,
  latest 200 of N note, row → right Sheet with all fields + hexdump mono bg-slate-950; Sessions card; Тревоги card with
  mute Switch + toasts); integration-tab (download card, 8-step plan, fileTree ScrollArea, 15-tools table, code viewer);
  repos-tab (designer tools table + risk callout, OAC pipeline strip анализ→план→подтверждение→выполнение→проверка,
  roles table, MVI + Honcho callouts); footer with repo links.
- globals.css: .dark primary/ring → emerald; .custom-scroll thin scrollbar styles; layout.tsx metadata title/description only.
- eslint.config.mjs: ignore analysis/**, download/**, tests/**, mini-services/** (pre-existing vendored JS).

Stage Summary:
- Dashboard complete at `/`: 4 tabs, RU, dark emerald theme, fully responsive; backend = 11 route endpoints + in-memory
  synthetic hub mirroring UniversalSniffer architecture; alerts persisted via Prisma/SQLite.
- Verified: `bun run lint` — 0 problems; `tsc --noEmit` clean for project sources; curl all endpoints 200 JSON;
  `curl -N` SSE streams packet ~5/s + stats 1/s + status snapshot; SQLite SnifferAlert rows present; zip/notes downloads
  200 (2.5MB / 3.9KB); dev.log free of runtime errors; no duplicate dev server started (port 3000 already serving).
- Not verified: visual E2E in browser (left to main agent); SSE long-lifetime reconnect under client throttling.

---
Task ID: 3
Agent: main (Z.ai Code)
Task: E2E verification with agent-browser, QA fixes, final health checks

Work Log:
- Verified all 4 tabs in browser: Обзор (KPI/архивы/репозитории/архитектура), Сниффер-демо (live SSE: статистика, pps-график, поток пакетов, фильтры, пауза/продолжить, детальный Sheet с hexdump, сессии, тревоги WARN/CRIT), Интеграция (zip-скачивание 200/2.5MB, план 8 шагов, дерево файлов 37, MCP-таблица 15 tools, code viewer), Репозитории (mcp_designer_tools 4 tools + OAC конвейер/роли/MVI)
- Verified mobile 390x844: табы складываются в сетку 2x2, карточки стекуются, таблица скроллится горизонтально
- Verified download endpoint: GET /api/download/package → 200 (2,497,910 bytes zip)
- QA fix 1: toast-уведомления накапливались и перекрывали кнопки → добавлены duration (2.5-3.5s), глобальный Toaster position=bottom-right duration=3000 closeButton, lang="ru" в layout
- QA fix 2 (критический): серьёзный layout-баг — контент ScrollArea переливался поверх соседних карточек на вкладке «Интеграция». Корневая причина: shadcn ScrollArea Root без overflow-hidden + процентная высота Viewport не резолвится против max-height родителя → Viewport рос до 1334px и вываливался из карточки. Исправление: в integration-tab.tsx ScrollArea заменён на нативные div (max-h-96 overflow-y-auto custom-scroll), в ui/scroll-area.tsx возвращён overflow-hidden. Проверено: overlap=false, внутренний скролл работает
- QA fix 3: убран backdrop-blur у sticky-хедера (перф + артефакты композитинга)
- lint: 0 ошибок; dev.log: только 200s, SSE-потоки живые, Prisma пишет алерты

Stage Summary:
- Dashboard полностью работоспособен и проверен в браузере (десктоп + мобайл)
- Архитектурное знание для будущих итераций: в этом шаблоне shadcn ScrollArea с max-h-* на Root ломает клампинг — использовать нативные div с overflow-y-auto + custom-scroll
