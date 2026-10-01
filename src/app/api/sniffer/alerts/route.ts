import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLiveAlerts, ensureRunning } from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sniffer/alerts?limit=
 * Живой ring сниффера объединяется с персистентными записями Prisma
 * (аналог capture/alerts.jsonl в реальном сниффере). Новые первыми.
 */
export async function GET(req: NextRequest) {
  ensureRunning();
  const limit = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10) || 100, 1),
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
