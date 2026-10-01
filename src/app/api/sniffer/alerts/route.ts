import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLiveAlerts, ensureRunning } from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sniffer/alerts?limit=
 *   Живой ring сниффера объединяется с персистентными записями Prisma
 *   (аналог capture/alerts.jsonl в реальном сниффере). Новые первыми.
 *
 * GET /api/sniffer/alerts?history=1&limit=50&offset=0[&severity=crit|warn|info]
 *   Журнал из SQLite (только персистентные записи) с пагинацией по offset,
 *   фильтром по severity и счётчиками по уровням. Аналог чтения журнала
 *   реального сниффера после ротации живого ring.
 */

interface JournalAlert {
  id: string;
  rule: string;
  severity: string;
  message: string;
  protocol: string | null;
  client: string | null;
  packetId: number | null;
  createdAt: string;
  source: "live" | "db";
}

export async function GET(req: NextRequest) {
  ensureRunning();
  const sp = req.nextUrl.searchParams;

  // ── Режим журнала: постраничная история из БД ──────────────────────────
  if (sp.get("history")) {
    const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);
    const severity = sp.get("severity") ?? "";
    const severityOk = ["crit", "warn", "info"].includes(severity) ? severity : undefined;

    const where = severityOk ? { severity: severityOk } : {};
    try {
      const [rows, total, crit, warn, info] = await Promise.all([
        db.snifferAlert.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        db.snifferAlert.count({ where }),
        db.snifferAlert.count({ where: { severity: "crit" } }),
        db.snifferAlert.count({ where: { severity: "warn" } }),
        db.snifferAlert.count({ where: { severity: "info" } }),
      ]);
      const alerts: JournalAlert[] = rows.map((a) => ({
        id: a.id,
        rule: a.rule,
        severity: a.severity,
        message: a.message,
        protocol: a.protocol,
        client: a.client,
        packetId: a.packetId,
        createdAt: a.createdAt.toISOString(),
        source: "db" as const,
      }));
      return NextResponse.json({
        alerts,
        total,
        counts: { crit, warn, info },
        limit,
        offset,
      });
    } catch {
      return NextResponse.json(
        { error: "Журнал недоступен — БД не отвечает" },
        { status: 503 }
      );
    }
  }

  // ── Обычный режим: live ring + БД (как раньше) ─────────────────────────
  const limit = Math.min(
    Math.max(parseInt(sp.get("limit") ?? "100", 10) || 100, 1),
    500
  );

  const live = getLiveAlerts(limit);
  let persisted: {
    id: string;
    rule: string;
    severity: string;
    message: string;
    protocol: string | null;
    client: string | null;
    packetId: number | null;
    createdAt: Date;
  }[] = [];
  try {
    persisted = await db.snifferAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    // БД недоступна — отдаём только живой ring
  }

  // Дедупликация по (rule, packetId, createdAt-секунда)
  const seen = new Set(
    live.map((a) => `${a.rule}|${a.packetId ?? -1}|${a.createdAt.slice(0, 19)}`)
  );
  const merged = [
    ...live.map((a) => ({
      id: a.id,
      rule: a.rule,
      severity: a.severity,
      message: a.message,
      protocol: a.protocol ?? null,
      client: a.client ?? null,
      packetId: a.packetId ?? null,
      createdAt: a.createdAt,
      source: "live" as const,
    })),
    ...persisted
      .filter(
        (a) =>
          !seen.has(`${a.rule}|${a.packetId ?? -1}|${a.createdAt.toISOString().slice(0, 19)}`)
      )
      .map((a) => ({
        id: a.id,
        rule: a.rule,
        severity: a.severity,
        message: a.message,
        protocol: a.protocol,
        client: a.client,
        packetId: a.packetId,
        createdAt: a.createdAt.toISOString(),
        source: "db" as const,
      })),
  ]
    .sort(
      (x, y) =>
        new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
    )
    .slice(0, limit);

  return NextResponse.json({ alerts: merged, total: merged.length });
}
