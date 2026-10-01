import { NextRequest, NextResponse } from "next/server";
import { getPacketById, getFullHexdump } from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sniffer/packet/[id] — детали пакета + полный hexdump (до 2КБ).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Некорректный id пакета" }, { status: 400 });
  }
  const packet = getPacketById(numericId);
  if (!packet) {
    return NextResponse.json(
      { error: "Пакет не найден в буфере (вытеснен или буфер очищен)" },
      { status: 404 }
    );
  }
  return NextResponse.json({
    packet,
    hexdump: getFullHexdump(packet),
  });
}
