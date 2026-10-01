import { NextRequest } from "next/server";
import {
  subscribe,
  getStats,
  getSessions,
  getRecentPackets,
  getLiveAlerts,
  getSeries,
  type HubEvent,
} from "@/lib/sniffer/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sniffer/stream — SSE-поток живых событий сниффера.
 * События: status (снимок при подписке), packet, session, alert, stats.
 * Heartbeat-комментарий каждые 15с для прокси/балансировщиков.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // 1) Начальный снимок состояния
      send("status", {
        ok: true,
        startedAt: getStats().startedAt,
        stats: getStats(),
        sessions: getSessions(),
        packets: getRecentPackets(200),
        alerts: getLiveAlerts(100),
        series: getSeries(),
      });

      // 2) Подписка на события хаба
      const unsubscribe = subscribe((ev: HubEvent) => {
        send(ev.type, ev.payload);
      });

      // 3) Heartbeat каждые 15с
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 15000);

      // 4) Очистка при разрыве соединения
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // уже закрыт
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
