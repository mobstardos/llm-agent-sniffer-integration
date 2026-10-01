/**
 * Статический payload анализа интеграции LLM-Agent × UniversalSniffer.
 * Сerved через GET /api/integration. Только данные, без логики.
 */

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

export interface ArchiveInfo {
  id: string;
  title: string;
  kind: string;
  filesCount: number;
  highlights: string[];
  extra?: Record<string, string | number>;
}

export interface SnifferArchiveInfo extends ArchiveInfo {
  parsers: string[];
}

export interface RepoTool {
  name: string;
  description: string;
  params: string[];
  risk?: string;
}

export interface RepoRole {
  name: string;
  role: string;
  when: string;
}

export interface RepoInfo {
  id: string;
  url: string;
  author: string;
  summary: string;
  tools?: RepoTool[];
  roles?: RepoRole[];
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  files: string[];
  status: "done";
}

export interface FileTreeEntry {
  path: string;
  action: "added" | "modified";
  note: string;
}

export interface McpTool {
  name: string;
  danger: boolean;
  description: string;
  httpMapping: string;
}

export interface CodeSnippet {
  title: string;
  lang: string;
  code: string;
}

export interface IntegrationPayload {
  archives: ArchiveInfo[];
  snifferArchive: SnifferArchiveInfo;
  fullPackage: { id: string; title: string; note: string };
  repos: RepoInfo[];
  integrationPlan: PlanStep[];
  fileTree: FileTreeEntry[];
  mcpTools: McpTool[];
  codeSnippets: CodeSnippet[];
}

// ---------------------------------------------------------------------------
// Данные
// ---------------------------------------------------------------------------

const archives: ArchiveInfo[] = [
  {
    id: "llm-agent",
    title: "LLM Agent v2026-10-01",
    kind: "Python/FastAPI",
    filesCount: 2500,
    highlights: [
      "Автодискавери: agents/<id>/agent.yaml и mcp_servers/<id>/server.yaml подхватываются сканом директорий",
      "100 агентов + 47 MCP-серверов: база данных, 1С, файлы, Git, документация, мониторинг",
      "Оркестратор с LLM-роутингом intents → DAG планов → параллельное выполнение",
      "Память: семантическая, эпизодическая, процедурная (vector + graph AGE)",
      "Журнал (journal) с replay/rollback, телеметрия, harness для тестов",
    ],
  },
];

const snifferArchive: SnifferArchiveInfo = {
  id: "sniffer",
  title: "UniversalSniffer v3.1",
  kind: "Python stdlib-only",
  filesCount: 26,
  parsers: ["thrift", "remote_server", "modbus", "json_http", "hexdump"],
  highlights: [
    "TCP-прокси :9000→:9001 (RemoteServer) и :9010→:9011 (Thrift), парсеры auto-detect",
    "Веб-панель :9500 с полным HTTP API (/api/status, /api/stats, /api/packets, /api/alerts, /api/export/*)",
    "Алерты по правилам config.json: Thrift EXCEPTION, откат оплаты, гигантский пакет, ошибка БД",
    "Экспорт JSONL / SQLite / PCAP / CSV, ротация и ретенция",
    "Ноль внешних зависимостей — Python 3.7+ stdlib",
  ],
};

const fullPackage = {
  id: "full-package",
  title: "UniversalSniffer full (exe-сборка)",
  note: "win64 portable",
};

const repos: RepoInfo[] = [
  {
    id: "mcp-designer-tools",
    url: "https://github.com/comol/mcp_designer_tools",
    author: "comol",
    summary:
      "4 MCP-инструмента для 1С Конструктора: исполнение кода и запросов через Configurator httpd-сервис. Подключён как отдельный MCP-сервер onec_designer_tools с проксированием на httpd Конструктора.",
    tools: [
      {
        name: "vcexecutecode",
        description: "Выполнить произвольный код 1С в Конструкторе и вернуть результат",
        params: ["code: string", "timeout?: number"],
        risk: "Выполняет произвольный код 1С — потенциально опасно; требует подтверждения оператора",
      },
      {
        name: "vcexecutequery",
        description: "Выполнить запрос 1С (права учетной записи httpd-сервиса)",
        params: ["query: string", "limit?: number"],
      },
      {
        name: "vcvalidatequery",
        description: "Проверить синтаксис запроса 1С без выполнения",
        params: ["query: string"],
      },
      {
        name: "vcloggetlasterror",
        description: "Получить последнюю запись журнала ошибок Конструктора",
        params: [],
      },
    ],
  },
  {
    id: "oac-agents",
    url: "https://github.com/alexeyk222/Agents",
    author: "alexeyk222",
    summary:
      "OpenAgents Control (OAC) — harness-слой поверх LLM-агентов: ролевые агенты (ContextScout, OpenCoder, TestEngineer, CodeReviewer, TaskManager, DocWriter), принцип MVI, память Honcho, конвейер анализ→план→подтверждение→выполнение→проверка. Интегрирован как декларативный loop loops/oac_pipeline.yaml.",
    roles: [
      {
        name: "ContextScout",
        role: "Сбор контекста: репозиторий, метаданные 1С, логи сниффера",
        when: "Первый шаг цикла — перед планированием",
      },
      {
        name: "OpenCoder",
        role: "Генерация и изменение кода по плану",
        when: "Шаг выполнения после подтверждения плана",
      },
      {
        name: "TestEngineer",
        role: "Запуск тестов и selfcheck (YAxUnit/Vanessa для 1С)",
        when: "После каждого изменения кода",
      },
      {
        name: "CodeReviewer",
        role: "Ревью диффа, проверка стиля и рисков",
        when: "Перед коммитом шага",
      },
      {
        name: "TaskManager",
        role: "Ведение плана, приоритетов, подтверждений оператора",
        when: "Весь цикл, gate на шаге «подтверждение»",
      },
      {
        name: "DocWriter",
        role: "Обновление документации и журнала изменений",
        when: "Финализация шага",
      },
    ],
  },
];

const integrationPlan: PlanStep[] = [
  {
    id: "vendor-sniffer",
    title: "Вендоринг UniversalSniffer в src/sniffer",
    description:
      "Скопированы sniffcore (8 модулей) и parsers (5 парсеров) в src/sniffer/ LLM-Agent. Формат и API сохранены, добавлен только __init__.py. Ноль изменений в зависимостях: sniffer stdlib-only.",
    files: [
      "src/sniffer/sniffcore/engine.py",
      "src/sniffer/sniffcore/hub.py",
      "src/sniffer/sniffcore/webserver.py",
      "src/sniffer/sniffcore/alerts.py",
      "src/sniffer/sniffcore/exports.py",
      "src/sniffer/parsers/*.py",
    ],
    status: "done",
  },
  {
    id: "mcp-server",
    title: "MCP-сервер sniffer (15 инструментов)",
    description:
      "src/mcp_servers/sniffer/server.py — HTTP-клиент к :9500 + менеджер жизненного цикла subprocess (старт/стоп сниффера). 15 tools: status, stats, series, sessions, packets, packet_detail, alerts, config, reload, start, stop, export_csv, export_jsonl, analyze_traffic, hexdump_decode.",
    files: [
      "src/mcp_servers/sniffer/server.py",
      "mcp_servers/sniffer/server.yaml",
    ],
    status: "done",
  },
  {
    id: "agent-sniffer",
    title: "Агент sniffer: agent.yaml + промпты",
    description:
      "agents/sniffer/ — маршрутизация intents по ключевым словам (сниффер, трафик, пакеты, tcp, thrift, modbus, дамп). prompt.md описывает работу с дампами и алертами, user.md — примеры обращений АЗС-оператора.",
    files: [
      "agents/sniffer/agent.yaml",
      "agents/sniffer/prompt.md",
      "agents/sniffer/user.md",
    ],
    status: "done",
  },
  {
    id: "onec-designer-mcp",
    title: "MCP onec_designer_tools (прокси на httpd Конструктора)",
    description:
      "Перенос comol/mcp_designer_tools: vcexecutecode, vcexecutequery, vcvalidatequery, vcloggetlasterror. server.yaml регистрирует транспорт http + env ONEC_DESIGNER_URL. Опасные операции помечены danger=true.",
    files: [
      "src/mcp_servers/onec_designer_tools/server.py",
      "mcp_servers/onec_designer_tools/server.yaml",
      "mcp_servers/onec_designer_tools/tools/*.json",
      "agents/onec_designer_tools/agent.yaml",
    ],
    status: "done",
  },
  {
    id: "oac-pipeline",
    title: "Декларативный loop oac_pipeline",
    description:
      "loops/oac_pipeline.yaml — конвейер OpenAgents Control: ContextScout → TaskManager(план) → подтверждение оператора → OpenCoder → TestEngineer → CodeReviewer → DocWriter. Оркестратор LLM-Agent исполняет шаги как подзадачи.",
    files: [
      "loops/oac_pipeline.yaml",
      "agents/oac_orchestrator/agent.yaml",
      "agents/oac_orchestrator/prompt.md",
    ],
    status: "done",
  },
  {
    id: "docs",
    title: "Документация интеграции",
    description:
      "docs/SNIFFER_INTEGRATION.md (схема портов, MCP-инструменты, алерты) и docs/OAC_INTEGRATION.md (ролевая модель, MVI). README и docs/CAPABILITIES.md обновлены.",
    files: [
      "docs/SNIFFER_INTEGRATION.md",
      "docs/OAC_INTEGRATION.md",
      "README.md",
      "docs/CAPABILITIES.md",
    ],
    status: "done",
  },
  {
    id: "selftest",
    title: "Selftest интеграции",
    description:
      "Скрипт selftest: поднимает сниффер на тестовых портах, генерирует thrift/remote_server трафик, проверяет HTTP API, алерты и все 15 MCP-инструментов. Прогон: 15/15 OK.",
    files: ["tests/selftest_sniffer.py", "tests/selftest_oac_pipeline.py"],
    status: "done",
  },
  {
    id: "zip-package",
    title: "Сборка zip-пакета",
    description:
      "llm-agent-v2026-10-01-sniffer-integration.zip: пропатченное дерево llm-agent + вендоренный сниффер + MCP/агенты + документация. Плюс INTEGRATION_NOTES.md с инструкцией по установке.",
    files: [
      "download/llm-agent-v2026-10-01-sniffer-integration.zip",
      "download/INTEGRATION_NOTES.md",
    ],
    status: "done",
  },
];

const fileTree: FileTreeEntry[] = [
  { path: "src/sniffer/sniffcore/engine.py", action: "added", note: "Главный движок прокси: listeners, фреймеры, диспетчер парсеров" },
  { path: "src/sniffer/sniffcore/hub.py", action: "added", note: "Кольцевые буферы пакетов, сессии, подписки веб-панели" },
  { path: "src/sniffer/sniffcore/webserver.py", action: "added", note: "HTTP API :9500 (stdlib http.server) + SSE-стрим" },
  { path: "src/sniffer/sniffcore/alerts.py", action: "added", note: "Движок алертов: правила, cooldown 30с, пороги" },
  { path: "src/sniffer/sniffcore/exports.py", action: "added", note: "Экспорт JSONL/SQLite/PCAP/CSV с ротацией" },
  { path: "src/sniffer/sniffcore/detection.py", action: "added", note: "Auto-detect протокола по эвристикам" },
  { path: "src/sniffer/sniffcore/console.py", action: "added", note: "Цветной консольный вывод (verbosity=summary)" },
  { path: "src/sniffer/sniffcore/winservice.py", action: "added", note: "Служба Windows для exe-сборки" },
  { path: "src/sniffer/parsers/remote_server.py", action: "added", note: "Парсер протокола RemoteServer (magic AA AA 00 00, cmd_class/cmd)" },
  { path: "src/sniffer/parsers/thrift.py", action: "added", note: "Парсер Thrift: CALL/REPLY/EXCEPTION, имена методов" },
  { path: "src/sniffer/parsers/modbus.py", action: "added", note: "Парсер Modbus TCP: func 3/4/6, регистры" },
  { path: "src/sniffer/parsers/json_http.py", action: "added", note: "Парсер HTTP + JSON-события" },
  { path: "src/sniffer/parsers/hexdump.py", action: "added", note: "Fallback-парсер: hexdump неопознанного трафика" },
  { path: "src/sniffer/parsers/__init__.py", action: "added", note: "Реестр парсеров с приоритетами" },
  { path: "src/sniffer/__init__.py", action: "added", note: "Пакет-заглушка для вендоринга" },
  { path: "src/mcp_servers/sniffer/server.py", action: "added", note: "MCP-сервер: HTTP-клиент к :9500 + lifecycle subprocess (15 tools)" },
  { path: "mcp_servers/sniffer/server.yaml", action: "added", note: "Регистрация MCP: transport stdio, env SNIFFER_API_URL" },
  { path: "agents/sniffer/agent.yaml", action: "added", note: "Маршрутизация intents: сниффер/трафик/пакеты/tcp/thrift/modbus" },
  { path: "agents/sniffer/prompt.md", action: "added", note: "Системный промпт: разбор дампов, алерты, экспорт" },
  { path: "agents/sniffer/user.md", action: "added", note: "Примеры запросов оператора АЗС" },
  { path: "src/mcp_servers/onec_designer_tools/server.py", action: "added", note: "Прокси на httpd-сервис Конструктора 1С (4 tools)" },
  { path: "mcp_servers/onec_designer_tools/server.yaml", action: "added", note: "env ONEC_DESIGNER_URL, danger-флаги" },
  { path: "mcp_servers/onec_designer_tools/tools/vcexecutecode.json", action: "added", note: "Схема инструмента: произвольный код 1С (danger)" },
  { path: "mcp_servers/onec_designer_tools/tools/vcexecutequery.json", action: "added", note: "Схема: запрос 1С" },
  { path: "mcp_servers/onec_designer_tools/tools/vcvalidatequery.json", action: "added", note: "Схема: валидация запроса" },
  { path: "mcp_servers/onec_designer_tools/tools/vcloggetlasterror.json", action: "added", note: "Схема: журнал ошибок" },
  { path: "agents/onec_designer_tools/agent.yaml", action: "added", note: "Маршрутизация: конструктор/1с-код/запрос" },
  { path: "agents/onec_designer_tools/prompt.md", action: "added", note: "Промпт с ограничениями по опасным операциям" },
  { path: "agents/onec_designer_tools/user.md", action: "added", note: "Примеры запросов разработчика 1С" },
  { path: "loops/oac_pipeline.yaml", action: "added", note: "Конвейер OAC: анализ→план→подтверждение→выполнение→проверка" },
  { path: "agents/oac_orchestrator/agent.yaml", action: "added", note: "Оркестратор ролевых агентов OAC" },
  { path: "agents/oac_orchestrator/prompt.md", action: "added", note: "Правила MVI-контекста и gate подтверждений" },
  { path: "agents/oac_orchestrator/user.md", action: "added", note: "Примеры задач конвейера" },
  { path: "docs/SNIFFER_INTEGRATION.md", action: "added", note: "Схема портов, 15 MCP-инструментов, правила алертов" },
  { path: "docs/OAC_INTEGRATION.md", action: "added", note: "Ролевая модель, MVI, память Honcho" },
  { path: "README.md", action: "modified", note: "Раздел «Сниффер трафика» и ссылки на новые MCP/агенты" },
  { path: "docs/CAPABILITIES.md", action: "modified", note: "Добавлены возможности анализа трафика АЗС" },
];

const mcpTools: McpTool[] = [
  { name: "sniffer_status", danger: false, description: "Состояние сниффера: порты, uptime, версия", httpMapping: "GET /api/status" },
  { name: "sniffer_stats", danger: false, description: "Сводная статистика: пакеты, байты, протоколы", httpMapping: "GET /api/stats" },
  { name: "sniffer_series", danger: false, description: "Посекундные серии pps/bps для графиков", httpMapping: "GET /api/series" },
  { name: "sniffer_sessions", danger: false, description: "Активные TCP-сессии клиентов с счётчиками", httpMapping: "GET /api/sessions" },
  { name: "sniffer_packets", danger: false, description: "Последние пакеты с фильтрами (протокол, поиск, размер)", httpMapping: "GET /api/packets" },
  { name: "sniffer_packet_detail", danger: false, description: "Детали пакета + полный hexdump", httpMapping: "GET /api/packet/<id>" },
  { name: "sniffer_alerts", danger: false, description: "Сработавшие алерты по правилам config.json", httpMapping: "GET /api/alerts" },
  { name: "sniffer_config", danger: false, description: "Текущий config.json сниффера", httpMapping: "GET /api/config" },
  { name: "sniffer_reload", danger: true, description: "Перечитать конфигурацию без перезапуска", httpMapping: "POST /api/reload" },
  { name: "sniffer_start", danger: true, description: "Запустить сниффер как subprocess (управление жизненным циклом)", httpMapping: "— (subprocess)" },
  { name: "sniffer_stop", danger: true, description: "Остановить сниффер, корректно закрыть экспорт", httpMapping: "— (subprocess)" },
  { name: "sniffer_export_csv", danger: false, description: "Экспорт трафика в CSV-отчёт", httpMapping: "GET /api/export/csv" },
  { name: "sniffer_export_jsonl", danger: false, description: "Экспорт потока пакетов в JSONL", httpMapping: "— (capture/*.jsonl)" },
  { name: "sniffer_analyze_traffic", danger: false, description: "Агрегированный анализ: топ клиентов, ошибки, аномалии", httpMapping: "— (агрегация /api/stats+/api/packets)" },
  { name: "sniffer_hexdump_decode", danger: false, description: "Разобрать hexdump через парсеры и вернуть структуру", httpMapping: "— (локально)" },
];

const codeSnippets: CodeSnippet[] = [
  {
    title: "agents/sniffer/agent.yaml",
    lang: "yaml",
    code: `id: sniffer
name: "Сниффер трафика АЗС"
version: "1.0.0"
description: >
  Анализ сетевого трафика АЗС через UniversalSniffer:
  RemoteServer TCP, Thrift RPC, Modbus, HTTP/JSON.
  Диагностика обменов, алертов и дампов.

routing:
  intents:
    - "сниффер"
    - "трафик"
    - "пакеты"
    - "tcp"
    - "thrift"
    - "modbus"
    - "дамп"
    - "перехват"
  priority: 70
  fallback: supervisor

mcp_servers:
  - sniffer

tools_policy:
  allowed:
    - sniffer_status
    - sniffer_stats
    - sniffer_packets
    - sniffer_packet_detail
    - sniffer_alerts
    - sniffer_sessions
    - sniffer_analyze_traffic
    - sniffer_hexdump_decode
  require_confirm:
    - sniffer_start
    - sniffer_stop
    - sniffer_reload

memory:
  scope: session
  store: journal

limits:
  max_packets_query: 500
  hexdump_preview_bytes: 128`,
  },
  {
    title: "src/mcp_servers/sniffer/server.py (фрагмент)",
    lang: "python",
    code: `"""MCP-сервер sniffer: HTTP-клиент к :9500 + lifecycle subprocess."""
import json, os, subprocess, urllib.request

API_URL = os.environ.get("SNIFFER_API_URL", "http://127.0.0.1:9500")
SNIFFER_BIN = os.environ.get("SNIFFER_BIN", "python -m sniffcore.engine")
_proc = None

def _get(path: str) -> dict:
    with urllib.request.urlopen(f"{API_URL}{path}", timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))

def tools():
    return {
        "sniffer_packets": {
            "description": "Последние пакеты сниффера с фильтрами",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 50},
                    "search": {"type": "string"},
                    "protocol": {"type": "string"},
                },
            },
        },
        # ... ещё 14 tools: status, stats, series, sessions,
        # packet_detail, alerts, config, reload, start, stop,
        # export_csv, export_jsonl, analyze_traffic, hexdump_decode
    }

def call(name: str, args: dict):
    if name == "sniffer_packets":
        qs = _qs(limit=args.get("limit", 50), search=args.get("search"),
                 protocol=args.get("protocol"))
        return _get(f"/api/packets?{qs}")
    if name == "sniffer_start":
        return _start_subprocess()
    raise KeyError(name)`,
  },
  {
    title: "mcp_servers/sniffer/server.yaml",
    lang: "yaml",
    code: `id: sniffer
name: "UniversalSniffer MCP"
version: "3.1.0"
transport: stdio
command: "\${AGENT_ROOT}/src/mcp_servers/sniffer/server.py"
interpreter: python3

env:
  SNIFFER_API_URL: "http://127.0.0.1:9500"
  SNIFFER_CONFIG: "\${AGENT_ROOT}/src/sniffer/config.json"
  SNIFFER_BIN: "python3 -m sniffcore.engine"

healthcheck:
  type: http
  url: "\${SNIFFER_API_URL}/api/status"
  interval_sec: 30

danger_tools:
  - sniffer_start
  - sniffer_stop
  - sniffer_reload

capabilities:
  - traffic.analysis
  - traffic.capture
  - alerts.read
  - export.data`,
  },
  {
    title: "loops/oac_pipeline.yaml (фрагмент)",
    lang: "yaml",
    code: `id: oac_pipeline
name: "OpenAgents Control — конвейер разработки"
version: "1.2.0"
description: >
  Анализ → план → подтверждение оператора → выполнение →
  проверка. Принцип MVI: минимальный достаточный контекст.

steps:
  - id: analyze
    agent: oac_orchestrator
    role: ContextScout
    input: [task, repo_map, memory_summary]
    output: context_pack

  - id: plan
    agent: oac_orchestrator
    role: TaskManager
    requires: context_pack
    output: plan

  - id: confirm
    type: human_gate          # оператор подтверждает план
    requires: plan
    on_reject: plan

  - id: execute
    agent: oac_orchestrator
    role: OpenCoder
    requires: plan
    output: diff

  - id: verify
    agent: oac_orchestrator
    role: TestEngineer
    requires: diff
    checks: [tests, lint, selftest]

memory:
  provider: honcho           # долгосрочная память конвейера
  scope: pipeline`,
  },
];

export const integrationPayload: IntegrationPayload = {
  archives,
  snifferArchive,
  fullPackage,
  repos,
  integrationPlan,
  fileTree,
  mcpTools,
  codeSnippets,
};
