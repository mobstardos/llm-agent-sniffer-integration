"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileSearch,
  Inbox,
  Loader2,
  ChevronDown,
  ChevronUp,
  Radio,
  Download,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Packet, Session } from "@/hooks/use-sniffer-stream";
import { fmtBytes, fmtTime, protocolColor } from "@/lib/format";

const MAX_INSPECTOR_PACKETS = 400;
const PAGE_SIZE = 150;

interface SessionInspectorProps {
  session: Session | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Живой клиентский буфер пакетов (новые первыми) — для live-дополнения. */
  livePackets: Packet[];
  /** Старое поведение «клик по сессии» — фильтр таблицы пакетов по IP. */
  onFilterByClient: (client: string) => void;
}

/**
 * Инспектор сессии: все пакеты сессии (client + канал) в одном листе.
 * История — из серверного буфера (deep-scan до 5000), новые — из SSE-потока
 * (чистый useMemo-мерж, без sync-setState в эффектах).
 * Клик по пакету раскрывает hexdump inline.
 * Монтируется с key={sessionId} — состояние сбрасывается сменой сессии.
 */
export function SessionInspector({
  session,
  open,
  onOpenChange,
  livePackets,
  onFilterByClient,
}: SessionInspectorProps) {
  const [serverPackets, setServerPackets] = useState<Packet[] | null>(null);
  const [serverTotal, setServerTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // История сессии из серверного буфера (mount-only: компонент key- remountится)
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const params = new URLSearchParams({
      client: session.client,
      port: session.portName,
      limit: "400",
    });
    fetch(`/api/sniffer/packets?${params}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      )
      .then((d: { packets: Packet[]; total: number }) => {
        if (cancelled) return;
        setServerPackets(d.packets);
        setServerTotal(d.total);
      })
      .catch(() => {
        if (!cancelled) setServerPackets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Тикер длительности, пока лист открыт
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Мерж: свежие SSE-пакеты сессии + история серверного буфера (без мутаций)
  const merged = useMemo(() => {
    if (!session || serverPackets === null) return [] as Packet[];
    const serverIds = new Set(serverPackets.map((p) => p.id));
    const live = livePackets.filter(
      (p) =>
        p.client === session.client &&
        p.portName === session.portName &&
        !serverIds.has(p.id)
    );
    return [...live, ...serverPackets].slice(0, MAX_INSPECTOR_PACKETS);
  }, [session, serverPackets, livePackets]);

  const stats = useMemo(() => {
    let tx = 0;
    let rx = 0;
    let bytes = 0;
    for (const p of merged) {
      if (p.direction === "TX") tx += 1;
      else rx += 1;
      bytes += p.size;
    }
    return {
      tx,
      rx,
      bytes,
      avg: merged.length ? Math.round(bytes / merged.length) : 0,
    };
  }, [merged]);

  const totalSeen = serverTotal + Math.max(0, merged.length - (serverPackets?.length ?? 0));

  const durationSec = useMemo(() => {
    if (!session) return 0;
    const start = new Date(session.startedAt).getTime();
    const end =
      session.state === "active"
        ? nowTick
        : merged.length > 0
          ? new Date(merged[0].ts).getTime()
          : nowTick;
    return Math.max(0, Math.round((end - start) / 1000));
  }, [session, nowTick, merged]);

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}м ${sec}с` : `${sec}с`;
  };

  const visible = merged.slice(0, visibleCount);
  const evicted = Math.max(0, totalSeen - merged.length);

  // Экспорт этой сессии — сервер сам фильтрует буфер 5000 по client+port
  const sessionExportParams = session
    ? `client=${encodeURIComponent(session.client)}&port=${encodeURIComponent(session.portName)}`
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col gap-0 overflow-hidden border-slate-800 bg-slate-950 p-4 sm:max-w-lg"
      >
        <SheetHeader className="p-0 pb-3 text-left">
          <SheetTitle className="flex items-center gap-2 text-base text-slate-100">
            <Radio className="size-4 text-emerald-400" aria-hidden />
            Инспектор сессии
          </SheetTitle>
          <SheetDescription className="font-mono text-xs text-slate-400">
            {session ? `${session.client} · ${session.portName}` : ""}
          </SheetDescription>
        </SheetHeader>

        {session && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {/* Бейджи + сводка */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={`px-1.5 py-0 font-mono text-[10px] ${protocolColor(session.protocol)}`}
              >
                {session.protocol}
              </Badge>
              <Badge
                variant="outline"
                className={`px-1.5 py-0 text-[10px] ${
                  session.state === "active"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : session.state === "closing"
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                      : "border-slate-600/50 bg-slate-600/10 text-slate-400"
                }`}
              >
                {session.state === "active"
                  ? "активна"
                  : session.state === "closing"
                    ? "закрывается"
                    : "закрыта"}
              </Badge>
              {session.state === "active" && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                  </span>
                  live
                </span>
              )}
              <span className="ml-auto font-mono text-[10px] text-slate-500">
                длительность {fmtDur(durationSec)}
              </span>
            </div>

            {/* Мини-статистика сессии */}
            <div className="grid grid-cols-4 gap-2">
              {[
                ["TX пак.", String(session.txPackets), "text-emerald-400"],
                ["RX пак.", String(session.rxPackets), "text-cyan-400"],
                ["Байты", fmtBytes(session.txBytes + session.rxBytes), "text-slate-200"],
                ["Ср. разм.", fmtBytes(stats.avg), "text-slate-200"],
              ].map(([label, value, color]) => (
                <div
                  key={label}
                  className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1.5"
                >
                  <div
                    className={`truncate font-mono text-xs font-semibold tabular-nums ${color}`}
                  >
                    {value}
                  </div>
                  <div className="text-[10px] text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Список пакетов сессии */}
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-slate-800 bg-slate-900/40">
              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Пакеты сессии
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-[10px] text-slate-500">
                      в буферах: {merged.length} пак. · {fmtBytes(stats.bytes)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0 gap-1 px-2 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-emerald-300"
                          aria-label="Экспорт сессии"
                          title="Экспорт пакетов этой сессии из серверного буфера (до 5000)"
                        >
                          <Download className="size-3" aria-hidden />
                          Экспорт
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-slate-700 bg-slate-950 text-slate-200">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-slate-500">
                          только эта сессия
                        </DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <a
                            href={`/api/sniffer/export?format=jsonl&${sessionExportParams}`}
                            download
                            className="cursor-pointer"
                          >
                            <FileJson className="mr-2 size-3.5 text-emerald-400" aria-hidden />
                            session.jsonl — пакеты
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={`/api/sniffer/export?format=csv&${sessionExportParams}`}
                            download
                            className="cursor-pointer"
                          >
                            <FileSpreadsheet className="mr-2 size-3.5 text-emerald-400" aria-hidden />
                            отчёт CSV — сводка сессии
                          </a>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto custom-scroll">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Запрос буфера сервера…
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <Inbox className="size-7 text-slate-600" aria-hidden />
                      <span className="text-xs text-slate-400">
                        Пакеты сессии вытеснены из буферов
                      </span>
                      <span className="text-[10px] text-slate-600">
                        Новые пакеты этой сессии появятся здесь автоматически
                      </span>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-800/60">
                      {visible.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId((cur) => (cur === p.id ? null : p.id))
                            }
                            aria-expanded={expandedId === p.id}
                            className="w-full px-3 py-1.5 text-left transition-colors hover:bg-slate-800/50"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={`font-mono text-[10px] font-semibold ${
                                  p.direction === "TX" ? "text-emerald-400" : "text-cyan-400"
                                }`}
                              >
                                {p.direction === "TX" ? "↑" : "↓"}
                              </span>
                              <span className="font-mono text-[11px] tabular-nums text-slate-400">
                                {fmtTime(p.ts)}
                              </span>
                              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-200">
                                {p.methodType ?? p.method ?? p.msgType ?? p.protocol}
                              </span>
                              <span className="font-mono text-[10px] tabular-nums text-slate-500">
                                {fmtBytes(p.size)}
                              </span>
                              {expandedId === p.id ? (
                                <ChevronUp className="size-3 text-slate-500" aria-hidden />
                              ) : (
                                <ChevronDown className="size-3 text-slate-600" aria-hidden />
                              )}
                            </span>
                          </button>
                          {expandedId === p.id && (
                            <pre className="mx-3 mb-2 max-h-44 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] leading-relaxed text-emerald-300 custom-scroll">
                              {p.hexPreview || "(нет данных)"}
                            </pre>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {visible.length < merged.length && (
                  <div className="border-t border-slate-800 p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="w-full border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-emerald-300"
                    >
                      Показать ещё {Math.min(PAGE_SIZE, merged.length - visible.length)} из{" "}
                      {merged.length - visible.length}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {evicted > 0 && (
              <p className="text-[10px] text-slate-600">
                ~{evicted} старых пакетов сессии вытеснено из кольцевого буфера (5000).
              </p>
            )}

            <Button
              variant="outline"
              onClick={() => {
                onFilterByClient(session.client);
                onOpenChange(false);
              }}
              className="min-h-[44px] border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800 hover:text-emerald-300 sm:min-h-[40px]"
            >
              <FileSearch className="size-4" aria-hidden />
              Фильтровать таблицу пакетов по клиенту
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
