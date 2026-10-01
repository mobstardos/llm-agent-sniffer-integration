import { NextResponse } from "next/server";
import { integrationPayload } from "@/lib/sniffer/integration-data";

export const runtime = "nodejs";

/** GET /api/integration — статический анализ интеграции LLM-Agent × UniversalSniffer. */
export async function GET() {
  return NextResponse.json(integrationPayload);
}
