import { NextResponse } from "next/server";
import { getSeries, ensureRunning } from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sniffer/series — посекундные серии {ts, pps, bps} (до 300 точек). */
export async function GET() {
  ensureRunning();
  return NextResponse.json({ series: getSeries() });
}
