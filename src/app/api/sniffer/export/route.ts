import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getRecentPackets,
  getLiveAlerts,
  getSessions,
  getStats,
} from "@/lib/sniffer/hub";
import {
  filterPackets,
  hasActiveFilter,
  packetFilterFromSearchParams,
  type PacketFilterParams,
} from "@/lib/sniffer/packet-filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sniffer/export?format=jsonl|csv|sessions|alerts&limit=N
 *                        [&client=ip:port] [&port=ChannelName] — экспорт одной сессии
 *                        [&search=&protocol=&direction=&minSize=&maxSize=] — экспорт «только отфильтрованного»
 * GET /api/sniffer/export?format=alerts_db|alerts_db_csv[&severity=crit|warn|info]
 *                        — персистентный журнал тревог из SQLite (с тем же фильтром severity, что в UI)
 * GET /api/sniffer/export?counts=1 — лёгкий JSON со счётчиками строк для меню экспорта
 *
 * Экспорт кольцевого буфера — аналог экспорта реального UniversalSniffer:
 *  - jsonl  → capture/traffic.jsonl (по строке JSON на пакет)
 *  - csv    → capture/reports/*.csv (Excel-отчёт, разделитель «;»)
 *  - alerts → capture/alerts.jsonl (журнал тревог живого ring)
 *  - alerts_db → capture/alerts_journal.jsonl|csv (SQLite-история, переживает Reset буфера)
 *  - sessions → capture/reports/sessions.csv
 *  При наличии client/port — срез одной сессии (jsonl/csv).
 *  При наличии поисковых условий — фильтрованный срез буфера (jsonl/csv).
 */

const EXPORT_CAP = 5000;
const ALERTS_CAP_MAX = 500;

interface SessionFilter {
  client?: string;
  port?: string;
}

function matchesFilter(p: PacketLike, f: SessionFilter | undefined): boolean {
  if (!f) return true;
  if (f.client && p.client !== f.client) return false;
  if (f.port && p.portName !== f.port) return false;
  return true;
}

interface PacketLike {
  id: number;
  ts: string;
  direction: "TX" | "RX";
  client: string;
  portName: string;
  protocol: string;
  msgType?: string;
  methodType?: string;
  method?: string;
  cmdType?: string;
  size: number;
  valid: boolean;
  summary: string;
}

/**
 * Записи журнала тревог из SQLite (формат экспорта alerts_db / alerts_db_csv).
 * Тот же фильтр severity, что у журнала в UI; верхний предел 5000 строк.
 */
async function alertsDbRows(severity?: string) {
  const sevOk = ["crit", "warn", "info"].includes(severity ?? "")
    ? (severity as "crit" | "warn" | "info")
    : undefined;
  return db.snifferAlert.findMany({
    where: sevOk ? { severity: sevOk } : {},
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
}

function alertsDbJsonl(rows: Awaited<ReturnType<typeof alertsDbRows>>): string {
  return rows
    .map((a) =>
      JSON.stringify({
        ts: a.createdAt.toISOString(),
        rule: a.rule,
        severity: a.severity,
        protocol: a.protocol,
        client: a.client,
        packet_id: a.packetId,
        message: a.message,
      })
    )
    .join("\n");
}

function alertsDbCsv(rows: Awaited<ReturnType<typeof alertsDbRows>>): string {
  const lines: string[] = [];
  const crit = rows.filter((a) => a.severity === "crit").length;
  const warn = rows.filter((a) => a.severity === "warn").length;
  const info = rows.filter((a) => a.severity === "info").length;
  lines.push("Universal Sniffer — журнал тревог из SQLite (демо-панель)");
  lines.push(`Сформирован;${new Date().toLocaleString("ru-RU")}`);
  lines.push(`Записей;${rows.length}`);
  lines.push(`CRIT;${crit};WARN;${warn};INFO;${info}`);
  lines.push("");
  lines.push("ВРЕМЯ;УРОВЕНЬ;ПРАВИЛО;ПРОТОКОЛ;КЛИЕНТ;ПАКЕТ;СООБЩЕНИЕ");
  for (const a of rows) {
    lines.push(
      [
        a.createdAt.toISOString(),
        a.severity.toUpperCase(),
        csvEscape(a.rule),
        a.protocol ?? "—",
        csvEscape(a.client ?? "—"),
        a.packetId ?? "—",
        csvEscape(a.message),
      ].join(";")
    );
  }
  return lines.join("\n");
}

/** ip:port / «RemoteServer TCP» → безопасный кусок имени файла */
function slug(s: string): string {
  return s.replace(/[^A-Za-zА-Яа-я0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "session";
}

function stamp(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function packetJsonl(filter?: SessionFilter, extra?: PacketFilterParams): string {
  let packets = getRecentPackets(EXPORT_CAP);
  if (extra && hasActiveFilter(extra)) packets = filterPackets(packets, extra); // фильтр таблицы
  packets = packets.filter((p) => matchesFilter(p, filter)); // новые первыми — как в traffic.jsonl
  return packets
    .map((p) =>
      JSON.stringify({
        id: p.id,
        ts: p.ts,
        direction: p.direction,
        client: p.client,
        port_name: p.portName,
        protocol: p.protocol,
        msg_type: p.msgType ?? null,
        method_type: p.methodType ?? null,
        method: p.method ?? null,
        cmd_type: p.cmdType ?? null,
        size: p.size,
        valid: p.valid,
        summary: p.summary,
      })
    )
    .join("\n");
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function reportCsv(): string {
  const stats = getStats();
  const packets = getRecentPackets(EXPORT_CAP);
  const lines: string[] = [];

  lines.push("Universal Sniffer — отчёт (демо-панель)");
  lines.push(`Сформирован;${new Date().toLocaleString("ru-RU")}`);
  lines.push(`Всего пакетов;${stats.totalPackets}`);
  lines.push(`Всего байт;${stats.totalBytes}`);
  lines.push(`Активных сессий;${stats.activeSessions}`);
  lines.push(`Тревог;${stats.alertsCount}`);
  lines.push("");

  lines.push("ПРОТОКОЛЫ;ПАКЕТОВ");
  for (const [proto, count] of Object.entries(stats.perProtocol).sort(
    (a, b) => b[1] - a[1]
  )) {
    lines.push(`${csvEscape(proto)};${count}`);
  }
  lines.push("");

  lines.push("ТОП КОМАНД/МЕТОДОВ;СЧЁТЧИК");
  for (const t of stats.topMethods) {
    lines.push(`${csvEscape(t.name)};${t.count}`);
  }
  lines.push("");

  lines.push("ТОП КЛИЕНТОВ;ПАКЕТОВ");
  for (const t of stats.topClients) {
    lines.push(`${csvEscape(t.name)};${t.count}`);
  }
  lines.push("");

  lines.push("ВРЕМЯ;НАПР.;КЛИЕНТ;КАНАЛ;ПРОТОКОЛ;ТИП/МЕТОД;РАЗМЕР;ВАЛИД;РЕЗЮМЕ");
  for (const p of packets.slice(0, 2000)) {
    lines.push(
      [
        p.ts,
        p.direction,
        csvEscape(p.client),
        csvEscape(p.portName),
        p.protocol,
        csvEscape(p.methodType ?? p.method ?? p.msgType ?? ""),
        p.size,
        p.valid ? "да" : "нет",
        csvEscape(p.summary),
      ].join(";")
    );
  }
  return lines.join("\n");
}

function alertsJsonl(): string {
  const alerts = getLiveAlerts(ALERTS_CAP_MAX);
  return alerts
    .map((a) =>
      JSON.stringify({
        ts: a.createdAt,
        rule: a.rule,
        severity: a.severity,
        protocol: a.protocol ?? null,
        client: a.client ?? null,
        packet_id: a.packetId ?? null,
        message: a.message,
      })
    )
    .join("\n");
}

function sessionsCsv(): string {
  const lines: string[] = [];
  lines.push("КЛИЕНТ;КАНАЛ;ПРОТОКОЛ;СТАРТ;TX ПАК.;RX ПАК.;TX БАЙТ;RX БАЙТ;СОСТОЯНИЕ");
  for (const s of getSessions()) {
    lines.push(
      [
        csvEscape(s.client),
        csvEscape(s.portName),
        s.protocol,
        s.startedAt,
        s.txPackets,
        s.rxPackets,
        s.txBytes,
        s.rxBytes,
        s.state,
      ].join(";")
    );
  }
  return lines.join("\n");
}

/** Срез одной сессии или отфильтрованный срез: сводка + пакеты (новые первыми). */
function sessionCsv(filter: SessionFilter, extra?: PacketFilterParams): string {
  let packets = getRecentPackets(EXPORT_CAP);
  if (extra && hasActiveFilter(extra)) packets = filterPackets(packets, extra);
  packets = packets.filter((p) => matchesFilter(p, filter));
  const lines: string[] = [];
  const tx = packets.filter((p) => p.direction === "TX");
  const rx = packets.filter((p) => p.direction === "RX");
  const bytes = packets.reduce((acc, p) => acc + p.size, 0);
  const isSession = Boolean(filter.client || filter.port);
  const conditions: string[] = [];
  if (filter.client) conditions.push(`клиент ${filter.client}`);
  if (filter.port) conditions.push(`канал ${filter.port}`);
  if (extra?.search?.trim()) conditions.push(`поиск «${extra.search.trim()}»`);
  if (extra?.protocol?.trim() && extra.protocol !== "all") conditions.push(`протокол ${extra.protocol}`);
  if (extra?.direction?.trim() && extra.direction !== "all") conditions.push(`направление ${extra.direction}`);
  if (extra?.minSize?.trim()) conditions.push(`≥ ${extra.minSize} Б`);
  if (extra?.maxSize?.trim()) conditions.push(`≤ ${extra.maxSize} Б`);

  lines.push(
    isSession
      ? "Universal Sniffer — экспорт сессии (демо-панель)"
      : "Universal Sniffer — отфильтрованный срез буфера (демо-панель)"
  );
  lines.push(`Сформирован;${new Date().toLocaleString("ru-RU")}`);
  lines.push(`Клиент;${csvEscape(filter.client ?? "все")}`);
  lines.push(`Канал;${csvEscape(filter.port ?? "все")}`);
  if (conditions.length > 0) lines.push(`Условия;${csvEscape(conditions.join("; "))}`);
  lines.push(`Пакетов в буфере;${packets.length}`);
  lines.push(`TX;${tx.length};RX;${rx.length}`);
  lines.push(`Суммарный объём;${bytes}`);
  lines.push("");
  lines.push("ВРЕМЯ;НАПР.;КАНАЛ;ПРОТОКОЛ;ТИП/МЕТОД;РАЗМЕР;ВАЛИД;РЕЗЮМЕ");
  for (const p of packets.slice(0, 2000)) {
    lines.push(
      [
        p.ts,
        p.direction,
        csvEscape(p.portName),
        p.protocol,
        csvEscape(p.methodType ?? p.method ?? p.msgType ?? ""),
        p.size,
        p.valid ? "да" : "нет",
        csvEscape(p.summary),
      ].join(";")
    );
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") ?? "jsonl";
  const client = sp.get("client") ?? undefined;
  const port = sp.get("port") ?? undefined;
  const hasSessionFilter = !!(client || port);
  const filter: SessionFilter | undefined = hasSessionFilter
    ? { client: client || undefined, port: port || undefined }
    : undefined;
  // «только отфильтрованное» — те же условия, что в таблице пакетов
  const extra = packetFilterFromSearchParams(sp);
  const filtered = hasActiveFilter(extra);
  const ts = stamp();
  const filterInfix = filtered ? "filtered_" : "";

  // ── Лёгкий подсчёт строк для счётчиков меню экспорта (без генерации файлов) ──
  if (sp.get("counts")) {
    const packets = getRecentPackets(EXPORT_CAP);
    let filteredCount: number | null = null;
    if (filtered) {
      filteredCount = filterPackets(packets, extra).filter((p) =>
        matchesFilter(p, filter)
      ).length;
    }
    let alertsDb: number | null = null;
    try {
      alertsDb = await db.snifferAlert.count();
    } catch {
      // БД недоступна — счётчик не отдаём
    }
    return NextResponse.json(
      {
        packets: packets.length,
        filtered: filteredCount,
        sessions: getSessions().length,
        alerts: getLiveAlerts(ALERTS_CAP_MAX).length,
        alertsDb,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  switch (format) {
    case "jsonl": {
      const filename = hasSessionFilter
        ? `session_${slug(client ?? "")}${port ? `_${slug(port)}` : ""}_${ts}.jsonl`
        : `traffic_${filterInfix}${ts}.jsonl`;
      return new NextResponse(packetJsonl(filter, extra), {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    case "csv": {
      const filename = hasSessionFilter
        ? `session_${slug(client ?? "")}${port ? `_${slug(port)}` : ""}_${ts}.csv`
        : `sniffer_report_${filterInfix}${ts}.csv`;
      const body = hasSessionFilter || filtered ? sessionCsv(filter ?? {}, extra) : reportCsv();
      return new NextResponse("\uFEFF" + body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    case "sessions":
      return new NextResponse("\uFEFF" + sessionsCsv(), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="sessions_${ts}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    case "alerts":
      return new NextResponse(alertsJsonl(), {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Content-Disposition": `attachment; filename="alerts_${ts}.jsonl"`,
          "Cache-Control": "no-store",
        },
      });
    case "alerts_db":
    case "alerts_db_csv": {
      // Персистентный журнал из SQLite с фильтром severity (как в UI журнала)
      const severity = sp.get("severity") ?? undefined;
      const rows = await alertsDbRows(severity);
      const sevInfix = severity && ["crit", "warn", "info"].includes(severity) ? `${severity}_` : "";
      const isCsv = format === "alerts_db_csv";
      return new NextResponse(
        isCsv ? "\uFEFF" + alertsDbCsv(rows) : alertsDbJsonl(rows),
        {
          headers: {
            "Content-Type": isCsv
              ? "text/csv; charset=utf-8"
              : "application/x-ndjson; charset=utf-8",
            "Content-Disposition": `attachment; filename="alerts_journal_${sevInfix}${ts}.${isCsv ? "csv" : "jsonl"}"`,
            "Cache-Control": "no-store",
          },
        }
      );
    }
    default:
      return NextResponse.json(
        { error: "Формат поддерживает: jsonl | csv | sessions | alerts | alerts_db | alerts_db_csv" },
        { status: 400 }
      );
  }
}
