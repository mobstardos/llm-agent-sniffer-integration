# 📦 llm-agent v2026-10-01 — Sniffer + MCP QA + Honcho Integration

Репозиторий содержит:

| Путь | Что это |
|---|---|
| [`analysis/llm-agent/llm-agent-v2026-10-01/`](analysis/llm-agent/llm-agent-v2026-10-01/) | **Основное приложение** — мультиагентная LLM-система (FastAPI + 42 MCP-сервера + sniffer + MCP QA + Honcho) |
| `/` (корень) | **Дашборд мониторинга** интеграций (Next.js 16, App Router) |
| [`analysis/llm-agent/llm-agent-v2026-10-01/docs/ONEC_QA_INTEGRATION.md`](analysis/llm-agent/llm-agent-v2026-10-01/docs/ONEC_QA_INTEGRATION.md) | Документация интеграции MCP QA (1С-тестирование) |
| [`analysis/llm-agent/llm-agent-v2026-10-01/docs/HONCHO_INTEGRATION.md`](analysis/llm-agent/llm-agent-v2026-10-01/docs/HONCHO_INTEGRATION.md) | Документация интеграции Honcho (межсессионная память) |

---

## 🚀 Установка и запуск llm-agent (основное приложение)

### Требования

- **Python 3.10–3.14** — обычная сборка с [python.org](https://www.python.org/downloads/)
  (⚠️ Python из Microsoft Store не подходит; на Windows отметьте «Add python.exe to PATH»)
- ~2 ГБ свободного места на диске
- Опционально: Docker Desktop (PostgreSQL), Ollama (локальные модели), Node.js ≥ 18

### Быстрый старт (3 команды)

**Windows:**
```bat
git clone https://github.com/mobstardos/llm-agent-sniffer-integration.git
cd llm-agent-sniffer-integration\analysis\llm-agent\llm-agent-v2026-10-01
python install.py
run.bat
```

**Linux / macOS:**
```bash
git clone https://github.com/mobstardos/llm-agent-sniffer-integration.git
cd llm-agent-sniffer-integration/analysis/llm-agent/llm-agent-v2026-10-01
python3 install.py
bash run.sh
```

Установщик `install.py` сам: проверит Python, создаст `.venv`, поставит зависимости,
спросит порт и PostgreSQL, запишет `.env`, накатит схему БД и прогонит смоук-тест.

Тихий режим без вопросов: `python install.py --auto` (порт 8000, PG пропустить).

После запуска откройте **http://127.0.0.1:8000** — веб-чат с агентом.
Интерактивный курс по системе: **http://127.0.0.1:8000/guide** (кнопка 🎓 в шапке).

### Что дальше настраивать

| Шаг | Где | Зачем |
|---|---|---|
| Провайдер LLM | чат → ⚙️ Настройки | ключ DeepSeek / OpenAI-совместимый / Ollama |
| PostgreSQL | `install.py` (пункт 1 — Docker) | память, векторы, аналитика |
| Embedder | `install.py` (`auto` = bge-m3, `hash` = без загрузок) | семантический поиск памяти |
| Первый запуск | мастер `first_run.py --defaults` уже вызван установщиком | каталоги data/, logs/, SQLite |

Подробно: [`docs/GETTING_STARTED.md`](analysis/llm-agent/llm-agent-v2026-10-01/docs/GETTING_STARTED.md) ·
типовые проблемы: [`docs/FAQ.md`](analysis/llm-agent/llm-agent-v2026-10-01/docs/FAQ.md) ·
production: [`DEPLOYMENT_GUIDE.md`](analysis/llm-agent/llm-agent-v2026-10-01/DEPLOYMENT_GUIDE.md)

### 🛠 Устранение неполадок

| Симптом | Причина | Решение |
|---|---|---|
| `ImportError: cannot import name 'SUPERVISOR_ENABLED'` | баг исходного архива (флаг потерян в `src/app.py`) | **исправлено в этом репозитории** — обновитесь: `git pull` |
| Установщик спросил порт, а в `.env` оказалось `PORT=run.bat` | в вопрос о порте введён не номер | откройте `.env`, замените строку на `WEB_PORT=8000` (**не** `PORT`) |
| `! venv не активирован`, пакеты ищутся в системе | запуск `python run.py` системным Python | запускайте через **`run.bat`** (или `.venv\Scripts\python.exe run.py`) |
| Смок-тест установщика: «Сервер не ответил за 2 минуты» | невалидный порт в `.env` (см. выше) | исправьте `WEB_PORT`, затем `run.bat` |
| `✗ qpx (qwenproxy-cli) не найден` | опциональный QwenProxy не установлен | только для пути Qwen: `npm install -g qwenproxy-cli` (можно игнорировать) |
| PostgreSQL подключён, но таблиц нет | выбор `[3] Пропустить` при установке | `.venv\Scripts\python.exe scripts/init_db.py` |

> ⚠️ Важно: `src/config.py` читает переменные **`WEB_HOST`/`WEB_PORT`** —
> старые значения `HOST`/`PORT` из ранних версий установщика игнорируются.

---

## 🧪 MCP QA — ИИ-тестирование форм 1С (опционально)

Нужен Docker (образ только **linux/amd64**) и, для самой 1С, Windows с платформой 1С.

```bash
# 1. Контейнер MCP QA (порт 8020)
docker run -d --name qa-mcp -p 8020:8020 comol/qa_mcp:latest
curl http://127.0.0.1:8020/healthz   # проверка

# 2. Тест-клиент 1С (Windows, та же машина или доступная по сети)
"C:\Program Files\1cv8\8.3.x.x\bin\1cv8c.exe" ENTERPRISE /F"C:\bases\demo" /TestClient -TPort1538
```

Переменные окружения прокси (задаются в `.env` llm-agent):

| Переменная | По умолчанию | Описание |
|---|---|---|
| `ONEC_QA_URL` | `http://127.0.0.1:8020/mcp` | адрес контейнера qa_mcp |
| `ONEC_QA_HTTP_TOKEN` | — (опц.) | `Authorization: Bearer …` контейнера |

Дальше в чате llm-agent вызывайте агента **🧪 onec_qa**: он сам запустит
MCP-прокси и даст ИИ ~31 инструмент `qa_*`/`ui_*` (чтение окон, клики,
ввод значений, проверка результата). Полная инструкция:
[ONEC_QA_INTEGRATION.md](analysis/llm-agent/llm-agent-v2026-10-01/docs/ONEC_QA_INTEGRATION.md).

---

## 🧩 Honcho — межсессионная память агентов (опционально)

Менеджер долговременной памяти (Plastic Labs, официальный MCP):
peers/sessions/conclusions, representation, peer card, dreams.
Подключение и настройка — [HONCHO_INTEGRATION.md](analysis/llm-agent/llm-agent-v2026-10-01/docs/HONCHO_INTEGRATION.md).

---

## 📊 Дашборд мониторинга (Next.js 16)

Веб-дашборд по интеграциям: sniffer-прокси, MCP-серверы, агенты, MCP QA.

```bash
# из корня репозитория
bun install          # или: npm install
bun run db:push      # инициализация SQLite (Prisma)
bun run dev          # http://localhost:3000
```

Прод-сборка: `bun run build && bun run start`.

---

## 🔎 Sniffer-интеграция

Все MCP-вызовы агентов проходят через встроенный sniffer-прокси (перехват,
логирование, инспекция трафика агентов). Архитектура и настройки:
[`docs/ARCHITECTURE-V2.md`](analysis/llm-agent/llm-agent-v2026-10-01/docs/ARCHITECTURE-V2.md),
справочник серверов: [`docs/MCP_SERVERS.md`](analysis/llm-agent/llm-agent-v2026-10-01/docs/MCP_SERVERS.md).
