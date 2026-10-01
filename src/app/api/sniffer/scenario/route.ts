import { NextRequest, NextResponse } from "next/server";
import {
  SCENARIOS,
  getScenario,
  startScenario,
  stopScenario,
  type ScenarioId,
  type ScenarioDef,
  type ScenarioState,
} from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/sniffer/scenario — активный сценарий + каталог сценариев
 * POST { id: ScenarioId }    — запустить сценарий
 * DELETE                     — остановить активный сценарий
 */
export async function GET() {
  return NextResponse.json({
    scenario: getScenario(),
    catalog: SCENARIOS satisfies ScenarioDef[],
  });
}

export async function POST(req: NextRequest) {
  let body: { id?: string };
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const id = body.id as ScenarioId | undefined;
  if (!id) {
    return NextResponse.json({ error: "Не указан id сценария" }, { status: 400 });
  }
  const state: ScenarioState | null = startScenario(id);
  if (!state) {
    return NextResponse.json(
      { error: `Неизвестный сценарий: ${id}`, catalog: SCENARIOS },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, scenario: state });
}

export async function DELETE() {
  const stopped = stopScenario();
  return NextResponse.json({ ok: true, stopped: stopped?.id ?? null });
}
