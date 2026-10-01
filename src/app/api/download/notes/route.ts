import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTES_PATH = "/home/z/my-project/download/INTEGRATION_NOTES.md";

/** GET /api/download/notes — примечания по интеграции (text/plain/markdown). */
export async function GET() {
  try {
    const st = await stat(NOTES_PATH);
    if (!st.isFile()) throw new Error("not a file");
    const data = await readFile(NOTES_PATH, "utf8");
    return new Response(data, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="INTEGRATION_NOTES.md"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ available: false }, { status: 404 });
  }
}
