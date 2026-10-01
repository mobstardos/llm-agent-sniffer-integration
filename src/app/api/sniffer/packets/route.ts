import { NextRequest, NextResponse } from "next/server";
import { getRecentPackets } from "@/lib/sniffer/hub";
import { filterPackets, packetFilterFromSearchParams } from "@/lib/sniffer/packet-filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sniffer/packets
 * Параметры: limit, search, protocol, direction, minSize, maxSize,
 *            client (точный ip:port), port (точное имя канала) — для инспектора сессий
 * Возвращает отфильтрованные последние пакеты (новые первыми).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "200", 10) || 200, 1), 1000);
  const client = (sp.get("client") ?? "").trim();
  const port = (sp.get("port") ?? "").trim();

  // для инспектора сессий расширяем выборку до всего буфера
  const deepScan = Boolean(client || port);
  const all = getRecentPackets(deepScan ? 5000 : 1000);
  const filtered = filterPackets(all, packetFilterFromSearchParams(sp));

  return NextResponse.json({
    packets: filtered.slice(0, limit),
    total: filtered.length,
    buffered: all.length,
  });
}
