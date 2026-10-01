import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getRecentPackets,
  getLiveAlerts,
  getSessions,
  getStats,
} from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sniffer/export?format=jsonl|csv|sessions|alerts&limit=N
 *                        [&client=ip:port] [&port=ChannelName] — экспорт одной сессии
 *
 * Экспорт кольцевого буфера — аналог экспорта реального UniversalSniffer:
 *  - jsonl  → capture/traffic.jsonl (по строке JSON на пакет)
 *  - csv    → capture/reports/*.csv (Excel-отчёт, разделитель «;»)
 *  - alerts → capture/alerts.jsonl (журнал тревог)
 *  - sessions → capture/reports/sessions.csv
 *  При наличии client/port — срез одной сессии (jsonl/csv).
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

/** ip:port / «RemoteServer TCP» → безопасный кусок имени файла */
function slug(s: string): string {
  return s.replace(/[^A-Za-zА-Яа-я0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "session";
}

function stamp(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function packetJsonl(filter?: SessionFilter): string {
  const packets = getRecentPackets(EXPORT_CAP).filter((p) => matchesFilter(p, filter)); // новые первыми — как в traffic.jsonl
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

/** Срез одной сессии: сводка + пакеты (новые первыми). */
function sessionCsv(filter: SessionFilter): string {
  const packets = getRecentPackets(EXPORT_CAP).filter((p) => matchesFilter(p, filter));
  const lines: string[] = [];
  const tx = packets.filter((p) => p.direction === "TX");
  const rx = packets.filter((p) => p.direction === "RX");
  const bytes = packets.reduce((acc, p) => acc + p.size, 0);

  lines.push("Universal Sniffer — экспорт сессии (демо-панель)");
  lines.push(`Сформирован;${new Date().toLocaleString("ru-RU")}`);
  lines.push(`Клиент;${csvEscape(filter.client ?? "все")}`);
  lines.push(`Канал;${csvEscape(filter.port ?? "все")}`);
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
  const format = req.nextUrl.searchParams.get("format") ?? "jsonl";
  const client = req.nextUrl.searchParams.get("client") ?? undefined;
  const port = req.nextUrl.searchParams.get("port") ?? undefined;
  const hasSessionFilter = !!(client || port);
  const filter: SessionFilter | undefined = hasSessionFilter
    ? { client: client || undefined, port: port || undefined }
    : undefined;
  const ts = stamp();

  switch (format) {
    case "jsonl": {
      const filename = hasSessionFilter
        ? `session_${slug(client ?? "")}${port ? `_${slug(port)}` : ""}_${ts}.jsonl`
        : `traffic_${ts}.jsonl`;
      return new NextResponse(packetJsonl(filter), {
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
        : `sniffer_report_${ts}.csv`;
      const body = hasSessionFilter ? sessionCsv(filter!) : reportCsv();
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
    default:
      return NextResponse.json(
        { error: "Формат поддерживает: jsonl | csv | sessions | alerts" },
        { status: 400 }
      );
  }
}
