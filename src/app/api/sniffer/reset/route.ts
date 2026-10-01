import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetHub } from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sniffer/reset — очистить буферы сниффера и таблицу алертов
 * (перезапуск демо). Генератор продолжает работать.
 */
export async function POST() {
  await resetHub();
  try {
    await db.snifferAlert.deleteMany({});
  } catch {
    // БД недоступна — буферы всё равно очищены
  }
  return NextResponse.json({ ok: true, message: "Сниффер перезапущен" });
}
