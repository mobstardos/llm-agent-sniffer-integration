# Task honcho-b — Секция «Honcho — межсессионная память агентов» в дашборде

Агент: honcho-b (general-purpose, Z.ai Code)
Дата: 2026-10-02
Статус: ✅ завершено (lint 0, tsc чисто по src, браузерный QA десктоп+мобайл пройден)

## Что сделано

### 1. Данные (`src/lib/sniffer/integration-data.ts`)
- Новые типы: `HonchoToolGroup` ("recall"|"store"|"meta"), `HonchoEnvVar`, `HonchoConcept`, `HonchoTool` (mutating?, slow?), `HonchoMode`, `HonchoServerInfo`; `IntegrationPayload` + `honchoServer`.
- Payload `honchoServer` строго по фактам официальной доки honcho.dev (без выдумок):
  - name «Honcho — межсессионная память агентов», vendor Plastic Labs, license AGPL-3.0;
  - hostedMcpUrl https://mcp.honcho.dev, docsUrl https://honcho.dev, githubUrl github.com/plastic-labs/honcho;
  - envVars ×3: HONCHO_MCP_URL (default https://mcp.honcho.dev), HONCHO_API_KEY (hch-..., app.honcho.dev; для self-hosted не нужен), HONCHO_WORKSPACE_ID (optional);
  - concepts ×8 кратко: workspace / peer / session / conclusion (explicit/deductive/inductive/contradiction, source_ids, times_derived) / representation / peer card / dream / reasoning_level (minimal…max);
  - tools 21: recall 13 (list_workspaces, list_peers, get_peer_card, list_sessions, get_session_context, get_peer_context, get_representation, chat ⚡slow, workspace_chat ⚡slow, search, list_conclusions, get_conclusions, get_derived_conclusions) + store 7 все mutating (create_workspace, create_peer, set_peer_card, create_session, add_peers_to_session, add_messages_to_session, schedule_dream) + meta 1 (honcho_tools_list);
  - modes ×2 (recall / memory_store), bestPractices ×6 (стабильный peer_id; session как «корзина» контекста; reasoning асинхронный; дешёвые чтения до chat 5+ сек; hch-ключ только в env прокси; dreams не блокируют), oacTieIn (README OAC → honcho_memory как долговременный слой oac_orchestrator, memory: provider: honcho в oac_pipeline.yaml);
  - mcpJson: url mcp.honcho.dev + headers Authorization Bearer hch-... (макс строка ~41ch — влезает в 390px).
- Счётчики пакета: `packageTotals` = MCP 41→42, агенты 40→41, note «honcho — +1 MCP и +1 агент к составу после onec_qa» → бейджи на «Интеграции» стали «41 → 42» / «40 → 41» (рендер от данных, integration-tab не тронут).
- Highlight llm-agent на «Обзоре»: «42 MCP-сервера и 41 агент (в т.ч. …, honcho_memory, …)».
- fileTree +5: src/mcp_servers/honcho/server.py, src/mcp_servers/honcho/__init__.py, mcp_servers/honcho/server.yaml, agents/honcho_memory/agent.yaml, docs/HONCHO_INTEGRATION.md (итого 47 записей; honcho-файлы после onec_qa-блока, дока — рядом с другими docs/*_INTEGRATION.md).
- integrationPlan: +10-й шаг «Honcho — межсессионная память (MCP-прокси + агент)» (append после zip-package; заголовок плана динамический — «10 шагов»).

### 2. UI — вкладка «Репозитории» (`honcho-section.tsx` — новый, четвёртая секция после QA)
- Карточка в emerald/teal-системе (отличие от violet QA/OAC): BrainCircuit, бейдж вендора Plastic Labs, ссылки honcho.dev + GitHub, моно-бейджи hosted MCP · mcp.honcho.dev (Cloud) / Streamable HTTP (teal) / Bearer hch-... (KeyRound) / AGPL-3.0.
- Концепты: сетка 8 плиток (grid-cols-2 → sm:3 → lg:4), term mono emerald + desc 10px, hover-подсветка бордера, title-тултипы.
- Инструменты: фильтр-чипы «все 21 / Recall — чтение 13 / Запись 7 / Служебные 1» (aria-pressed, счётчики, повторный клик = сброс, emerald ring); таблица desktop (hidden sm:block) — зебра bg-slate-950/40, hover:bg-emerald-500/[0.08], sticky-шапка, max-h-96 custom-scroll, whitespace-normal + [overflow-wrap:anywhere]; бейджи amber: ⚡ «медленно» (Zap, chat/workspace_chat) и «пишет» (PenLine, 7 mutating); на <sm — карточки (sm:hidden) в том же скролл-контейнере.
- «Цикл памяти агента»: горизонтальный strip recall → respond → record (как OAC-конвейер в repos-tab; recall emerald, record teal, respond slate).
- Режимы: две карточки — Recall (emerald, Eye) и Memory store (teal, Save).
- Best practices: ul с Check-иконками (emerald).
- env-таблица (3 строки, key truncate 170px + тултип) + mcp.json pre с CopyButton; подпись «hch-ключ только в env прокси».
- Callout связи с OAC: violet border/bg (в системе OAC-секции), Workflow icon, текст oacTieIn.
- framer-motion появление (opacity/y, 0.3s easeOut) — как в qa-section.

### 3. OAC-карточка (`repos-tab.tsx`)
- В плитке «Память Honcho» добавлена строка-дополнение (emerald, ArrowDown): «Honcho подключён как долговременная память (см. секцию ниже)» — существующая вёрстка не тронута.
- Импорт + рендер `<HonchoSection honcho={data.honchoServer} />` после `<QaSection/>`.

### 4. Вкладка «Интеграция»
- Без изменений кода: бейджи счётчиков и динамический заголовок плана подхватили данные (проверено: «MCP-серверов: 41 → 42», «агентов: 40 → 41», план 10 шагов, дерево 47).

## Ключевые технические решения
- Отдельный emerald/teal-оттенок для Honcho против violet QA/OAC: emerald — основной акцент секции (как панель), teal — второй тон (transport/record/store-режим), amber зарезервирован под предупреждающие бейджи (медленно/пишет) — язык панели сохранён.
- Фильтр-чипы: labels не в данных, а в словаре GROUP_LABELS в компоненте (данные держат машиночитаемые recall/store/meta).
- «10-й шаг» плана добавлен append'ом после zip-package (дословно по ТЗ); zip-шаг трактуется как «пересобирается на каждой интеграции» (прецедент: qa-a пересобирала zip).
- Скопировал локально copyToClipboard/CopyButton/MonoBadge (как в qa-section) — секции самодостаточны, qa-section не тронут.
- Проверка мобайла: chipCols=2, карточки вместо таблицы, pre без h-scroll, 0 элементов Honcho/QA за 390px (1px doc-overflow — pre-existing OAC-титул, задокументирован ранее).

## Проверки
- `bun run lint` — 0 проблем; `bunx tsc --noEmit` — 0 ошибок в src (4 pre-existing в examples/skills, вне проекта).
- curl /api/integration: honchoServer полный (21 tool: 13/7/1, slow=chat/workspace_chat, mutating=7), packageTotals 42/41, план 10, fileTree 47.
- agent-browser: десктоп 1280 — порядок секций designer→OAC→QA→Honcho, чип «Запись» → 7 строк create_*/add_*/schedule_dream с бейджами «пишет», консоль чистая; мобайл 390 — сетка концептов 2 колонки, карточки инструментов, mcp.json без скролла; VLM-ревью: 9/10 (mobile и desktop).
- Не тронуто: analysis/**, download/**, API-роуты, qa-section.tsx, integration-tab.tsx. worklog дописан в конце (append).

## Изменённые файлы
1. `src/lib/sniffer/integration-data.ts` — типы + honchoServer + packageTotals + highlight + fileTree + шаг 10
2. `src/components/dashboard/honcho-section.tsx` — НОВЫЙ: вся Honcho-секция
3. `src/components/dashboard/repos-tab.tsx` — импорт HonchoSection, рендер после QA, строка в OAC-плитке
4. `worklog.md` — append записи honcho-b
