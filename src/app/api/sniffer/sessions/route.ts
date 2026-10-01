import { NextResponse } from "next/server";
import { getSessions, ensureRunning } from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sniffer/sessions — список TCP-сессий клиентов. */
export async function GET() {
  ensureRunning();
  return NextResponse.json({ sessions: getSessions() });
}
