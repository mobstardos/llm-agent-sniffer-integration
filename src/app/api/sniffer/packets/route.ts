import { NextRequest, NextResponse } from "next/server";
import { getRecentPackets } from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sniffer/packets
 * Параметры: limit, search, protocol, direction, minSize, maxSize
 * Возвращает отфильтрованные последние пакеты (новые первыми).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "200", 10) || 200, 1), 1000);
  const search = (sp.get("search") ?? "").trim().toLowerCase();
  const protocol = sp.get("protocol") ?? "";
  const direction = sp.get("direction") ?? "";
  const minSize = parseInt(sp.get("minSize") ?? "", 10);
  const maxSize = parseInt(sp.get("maxSize") ?? "", 10);

  const all = getRecentPackets(1000); // фильтруем по последним 1000 в буфере
  const filtered = all.filter((p) => {
    if (protocol && p.protocol !== protocol) return false;
    if (direction && p.direction !== direction) return false;
    if (!Number.isNaN(minSize) && p.size < minSize) return false;
    if (!Number.isNaN(maxSize) && p.size > maxSize) return false;
    if (search) {
      const hay = `${p.summary} ${p.method ?? ""} ${p.methodType ?? ""} ${p.client} ${p.protocol} ${p.portName}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  return NextResponse.json({
    packets: filtered.slice(0, limit),
    total: filtered.length,
    buffered: all.length,
  });
}
