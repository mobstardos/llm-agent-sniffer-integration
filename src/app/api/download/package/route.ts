import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PACKAGE_PATH = "/home/z/my-project/download/llm-agent-v2026-10-01-sniffer-integration.zip";

/**
 * GET /api/download/package — отдаёт zip-пакет интеграции.
 * Если файл отсутствует — 404 {available:false}.
 */
export async function GET() {
  try {
    const st = await stat(PACKAGE_PATH);
    if (!st.isFile()) throw new Error("not a file");
    const data = await readFile(PACKAGE_PATH);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(st.size),
        "Content-Disposition":
          'attachment; filename="llm-agent-v2026-10-01-sniffer-integration.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ available: false }, { status: 404 });
  }
}
