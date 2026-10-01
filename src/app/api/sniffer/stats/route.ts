import { NextResponse } from "next/server";
import { getStats, ensureRunning } from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sniffer/stats — сводные показатели сниффера. */
export async function GET() {
  ensureRunning();
  return NextResponse.json({ stats: getStats() });
}
