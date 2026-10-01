"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Database,
  FileSearch,
  Loader2,
  ChevronDown,
  Inbox,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { fmtTime, protocolColor } from "@/lib/format";

const PAGE_SIZE = 50;

interface JournalRow {
  id: string;
  rule: string;
  severity: string;
  message: string;
  protocol: string | null;
  client: string | null;
  packetId: number | null;
  createdAt: string;
}

interface JournalData {
  alerts: JournalRow[];
  total: number;
  counts: { crit: number; warn: number; info: number };
}

const SEV_BADGE: Record<string, string> = {
  crit: "border-red-500/50 bg-red-500/10 text-red-400",
  warn: "border-amber-500/50 bg-amber-500/10 text-amber-400",
  info: "border-slate-500/50 bg-slate-500/10 text-slate-300",
};

/**
 * Журнал тревог — персистентная история из SQLite (Prisma).
 * Переживает перезагрузку страницы и сброс демо-буфера; очищается только Reset.
 */
export function AlertsJournal({
  open,
  onOpenChange,
  onOpenPacket,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenPacket: (id: number) => void;
}) {
  const [data, setData] = useState<JournalData | null>(null);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [severity, setSeverity] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (sev: string, offset: number, append: boolean) => {
      const qs = new URLSearchParams({
        history: "1",
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (sev !== "all") qs.set("severity", sev);
      const res = await fetch(`/api/sniffer/alerts?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as JournalData & { alerts: JournalRow[] };
      if (append) {
        setRows((prev) => [...prev, ...d.alerts]);
      } else {
        setRows(d.alerts);
        setData({ alerts: d.alerts, total: d.total, counts: d.counts });
      }
      return d;
    },
    []
  );

  // Первая страница при открытии листа (mount/open-only — без sync setState в эффекте на каждый рендер)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(severity, 0, false)
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, severity]);

  const handleMore = async () => {
    if (!data) return;
    setLoadingMore(true);
    try {
      await fetchPage(severity, rows.length, true);
    } catch (e) {
      toast.error("Не удалось загрузить ещё записи", {
        description: e instanceof Error ? e.message : String(e),
        duration: 3000,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpenPacket = (id: number) => {
    onOpenChange(false);
    onOpenPacket(id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col border-slate-800 bg-slate-950 p-4 sm:max-w-lg"
      >
        <SheetHeader className="p-0 pb-2 text-left">
          <SheetTitle className="flex items-center gap-2 text-base text-slate-100">
            <Database className="size-4 text-cyan-400" aria-hidden />
            Журнал тревог
            {data && (
              <Badge
                variant="outline"
                className="border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0 font-mono text-[10px] text-cyan-300"
              >
                SQLite: {data.total}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-400">
            Персистентная история в БД — переживает перезагрузку страницы и сброс буфера.
            Клик по записи с пакетом откроет его дамп.
          </SheetDescription>
        </SheetHeader>

        {/* Фильтр по уровню + счётчики */}
        <div
          className="flex flex-wrap items-center gap-2 border-y border-slate-800/70 py-2.5"
          role="toolbar"
          aria-label="Фильтр журнала по уровню"
        >
          <ToggleGroup
            type="single"
            variant="outline"
            value={severity}
            onValueChange={(v) => v && setSeverity(v)}
            className="gap-1.5"
          >
            <ToggleGroupItem
              value="all"
              aria-label="Все уровни"
              className="h-8 border-slate-700 px-2.5 text-[11px] text-slate-300 data-[state=on]:bg-slate-800 data-[state=on]:text-slate-100"
            >
              все
            </ToggleGroupItem>
            <ToggleGroupItem
              value="crit"
              aria-label="Только критические"
              className="h-8 border-slate-700 px-2.5 text-[11px] text-red-400 data-[state=on]:border-red-500/60 data-[state=on]:bg-red-500/15 data-[state=on]:text-red-300"
            >
              crit{data ? ` ${data.counts.crit}` : ""}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="warn"
              aria-label="Только предупреждения"
              className="h-8 border-slate-700 px-2.5 text-[11px] text-amber-400 data-[state=on]:border-amber-500/60 data-[state=on]:bg-amber-500/15 data-[state=on]:text-amber-300"
            >
              warn{data ? ` ${data.counts.warn}` : ""}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="info"
              aria-label="Только информационные"
              className="h-8 border-slate-700 px-2.5 text-[11px] text-slate-400 data-[state=on]:bg-slate-800 data-[state=on]:text-slate-200"
            >
              info{data ? ` ${data.counts.info}` : ""}
            </ToggleGroupItem>
          </ToggleGroup>
          {data && (
            <span className="ml-auto font-mono text-[11px] text-slate-500">
              показано {rows.length} из {data.total}
            </span>
          )}
        </div>

        {/* Список записей */}
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 custom-scroll">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-400">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Чтение журнала из SQLite…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <ShieldAlert className="size-8 text-red-500/70" aria-hidden />
              <span className="text-sm text-slate-300">Журнал недоступен</span>
              <span className="text-[11px] text-slate-500">{error}</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Inbox className="size-8 text-slate-600" aria-hidden />
              <span className="text-sm text-slate-400">Записей нет</span>
              <span className="text-[11px] text-slate-600">
                Тревоги появляются по правилам config.json и пишутся в БД
              </span>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/60" aria-label="Записи журнала тревог">
              {rows.map((a, idx) => (
                <li
                  key={a.id}
                  className={`py-2.5 transition-colors ${
                    a.packetId != null
                      ? "cursor-pointer hover:bg-slate-900/70"
                      : ""
                  } ${idx % 2 === 1 ? "bg-slate-900/30" : ""}`}
                  onClick={a.packetId != null ? () => handleOpenPacket(a.packetId!) : undefined}
                  title={
                    a.packetId != null
                      ? `Открыть пакет #${a.packetId}`
                      : undefined
                  }
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex w-14 shrink-0 flex-col items-start gap-1">
                      <Badge
                        variant="outline"
                        className={`px-1.5 py-0 text-[10px] font-semibold ${SEV_BADGE[a.severity] ?? SEV_BADGE.info}`}
                      >
                        {a.severity.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {fmtTime(a.createdAt)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-slate-200">
                          {a.rule}
                        </span>
                        {a.protocol && (
                          <Badge
                            variant="outline"
                            className={`hidden px-1.5 py-0 font-mono text-[9px] sm:inline-flex ${protocolColor(a.protocol)}`}
                          >
                            {a.protocol}
                          </Badge>
                        )}
                        {a.packetId != null && (
                          <FileSearch className="ml-auto size-3 shrink-0 text-slate-600" aria-hidden />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400">
                        {a.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-slate-500">
                        {a.client && <span className="truncate">{a.client}</span>}
                        {a.packetId != null && <span>пакет #{a.packetId}</span>}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Пагинация */}
          {data && rows.length < data.total && !loading && (
            <div className="flex justify-center border-t border-slate-800/60 py-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleMore}
                disabled={loadingMore}
                className="min-h-[36px] border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-emerald-300"
              >
                {loadingMore ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <ChevronDown className="size-3.5" aria-hidden />
                )}
                Показать ещё {Math.min(PAGE_SIZE, data.total - rows.length)}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
