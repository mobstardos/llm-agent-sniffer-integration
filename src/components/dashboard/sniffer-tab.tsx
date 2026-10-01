"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  BellOff,
  Activity,
  HardDrive,
  Network,
  Siren,
  Pause,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Square,
  Download,
  Inbox,
  FileJson,
  FileSpreadsheet,
  Copy,
  FileSearch,
  Radio,
  Volume2,
  VolumeX,
  ChevronDown,
  X,
  ArrowDownToLine,
  Filter,
  Database,
  GitCompareArrows,
  CheckCircle2 as ScenarioDone,
  Camera,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pin,
  PinOff,
  Rows3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import {
  useSnifferStream,
  type Packet,
  type Alert,
  type Session,
  type SnifferStats,
  type ScenarioResult,
  type SeriesPoint,
} from "@/hooks/use-sniffer-stream";
import { PpsChart, type ChartMetric } from "@/components/dashboard/pps-chart";
import { ProtocolBreakdown } from "@/components/dashboard/protocol-breakdown";
import { Sparkline } from "@/components/dashboard/sparkline";
import { SessionInspector } from "@/components/dashboard/session-inspector";
import { AlertsJournal } from "@/components/dashboard/alerts-journal";
import { playCritBeep, playConfirmBlip } from "@/lib/sound";
import {
  fmtBytes,
  fmtClock,
  fmtTime,
  fmtCompact,
  fmtRate,
  fmtUptime,
  protocolColor,
  protocolDot,
} from "@/lib/format";

const MAX_TABLE_ROWS = 200;
const MAX_PINS = 5;

/** Ключи сортировки таблицы пакетов (по клику на заголовок). */
type SortKey = "ts" | "size" | "port" | "protocol";

const SORT_LABELS: Record<SortKey, string> = {
  ts: "время",
  size: "размер",
  port: "канал",
  protocol: "протокол",
};

/** Скачивание текстового файла, сгенерированного на клиенте (диф срезов живёт только в памяти UI). */
function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Лёгкий ответ counts=1 — счётчики строк для меню экспорта. */
interface ExportCounts {
  packets: number;
  filtered: number | null;
  sessions: number;
  alerts: number;
  alertsDb: number | null;
}

const SCENARIO_CATALOG = [
  { id: "azs_burst", label: "АЗС-всплеск", hint: "x4 пак/с, RemoteServer" },
  { id: "thrift_storm", label: "Thrift-шторм", hint: "поток EXCEPTION" },
  { id: "giant_attack", label: "Гигантские пакеты", hint: "> 1 МБ каждый" },
  { id: "rollback_loop", label: "Откаты оплаты", hint: "CASHLESS_ROLLBACK" },
] as const;

type ScenarioId = (typeof SCENARIO_CATALOG)[number]["id"];

interface SnifferTabProps {
  live: ReturnType<typeof useSnifferStream>;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  alert,
  critPulse,
  spark,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
  critPulse?: boolean;
  spark?: React.ReactNode;
  trend?: Trend | null;
}) {
  return (
    <Card
      className={`group border-slate-800 bg-slate-900/60 transition-all duration-200 hover:-translate-y-0.5 ${
        alert
          ? "border-red-500/40 hover:border-red-500/60 hover:shadow-[0_8px_28px_-14px] hover:shadow-red-500/45"
          : "hover:border-emerald-500/40 hover:shadow-[0_8px_28px_-14px] hover:shadow-emerald-500/40"
      } ${critPulse ? "shadow-[0_0_24px_-8px] shadow-red-500/50" : ""}`}
    >
      <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-105 sm:size-11 ${
            alert ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"
          } ${critPulse ? "animate-pulse" : ""}`}
        >
          <Icon className={`size-4 sm:size-5 ${alert ? "text-red-400" : "text-emerald-400"}`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="truncate text-base font-bold leading-tight tracking-tight text-slate-50 tabular-nums sm:text-lg">
              {value}
            </span>
            {trend && <TrendBadge trend={trend} />}
          </div>
          <div className="truncate text-[11px] text-slate-400 sm:text-xs">{label}</div>
          {sub && <div className="truncate text-[10px] text-slate-500">{sub}</div>}
        </div>
        {spark && <div className="hidden shrink-0 pl-1 sm:block">{spark}</div>}
      </CardContent>
    </Card>
  );
}

function DirBadge({ dir }: { dir: "TX" | "RX" }) {
  return (
    <Badge
      variant="outline"
      className={`px-1.5 py-0 font-mono text-[10px] font-semibold ${
        dir === "TX"
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
          : "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
      }`}
    >
      {dir === "TX" ? "↑ TX" : "↓ RX"}
    </Badge>
  );
}

/** Подсветка совпадений поиска (без мутаций — чистый split по regex). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let parts: string[];
  try {
    parts = text.split(new RegExp(`(${escaped})`, "ig"));
  } catch {
    return <>{text}</>;
  }
  const lower = q.toLowerCase();
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lower ? (
          <mark key={i} className="rounded-[3px] bg-emerald-500/25 px-0.5 text-emerald-200">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    crit: "border-red-500/50 bg-red-500/10 text-red-400",
    warn: "border-amber-500/50 bg-amber-500/10 text-amber-400",
    info: "border-slate-500/50 bg-slate-500/10 text-slate-300",
  };
  const label: Record<string, string> = { crit: "CRIT", warn: "WARN", info: "INFO" };
  return (
    <Badge variant="outline" className={`px-1.5 py-0 text-[10px] font-semibold ${map[severity] ?? map.info}`}>
      {label[severity] ?? severity.toUpperCase()}
    </Badge>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    active: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
    closing: "border-amber-500/50 bg-amber-500/10 text-amber-400",
    closed: "border-slate-600/50 bg-slate-600/10 text-slate-400",
  };
  const label: Record<string, string> = { active: "активна", closing: "закрывается", closed: "закрыта" };
  return (
    <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${map[state] ?? map.closed}`}>
      {label[state] ?? state}
    </Badge>
  );
}

/** Счётчик строк в пункте меню экспорта (появляется после лёгкого counts-запроса). */
function ExportCount({ n }: { n: number | null | undefined }) {
  if (n == null) return null;
  return (
    <span className="ml-auto animate-in pl-3 font-mono text-[10px] text-slate-500 tabular-nums fade-in duration-300">
      {fmtCompact(n)}
    </span>
  );
}

/** Тренд KPI: среднее последних 60 с против предыдущих 60 с (из series). */
interface Trend {
  pct: number;
  dir: "up" | "down" | "flat";
}

function computeTrend(values: number[]): Trend | null {
  if (values.length < 70) return null;
  const last = values.slice(-60);
  const prev = values.slice(-120, -60);
  if (prev.length < 30) return null;
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const now = avg(last);
  const before = avg(prev);
  if (before < 1e-9) return null;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 3) return { pct, dir: "flat" };
  return { pct, dir: pct > 0 ? "up" : "down" };
}

/** Бейдж тренда: рост нагрузки — янтарный, спад — изумрудный, ровно — серый. */
function TrendBadge({ trend }: { trend: Trend }) {
  const cfg =
    trend.dir === "up"
      ? { Icon: TrendingUp, cls: "border-amber-500/50 bg-amber-500/10 text-amber-400", sign: "+" }
      : trend.dir === "down"
        ? { Icon: TrendingDown, cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400", sign: "−" }
        : { Icon: Minus, cls: "border-slate-600/50 bg-slate-600/10 text-slate-400", sign: "" };
  const rounded = Math.abs(Math.round(trend.pct));
  return (
    <span
      title={`Тренд за минуту: среднее последних 60 с против предыдущих 60 с (${trend.pct > 0 ? "+" : trend.pct < 0 ? "−" : ""}${Math.abs(trend.pct).toFixed(0)}%)`}
      className={`hidden shrink-0 animate-in items-center gap-0.5 rounded border px-1 py-px font-mono text-[9px] leading-none fade-in duration-300 sm:inline-flex ${cfg.cls}`}
    >
      <cfg.Icon className="size-2.5" aria-hidden />
      {cfg.sign}
      {rounded}%
    </span>
  );
}

/** Ручной срез аналитики («снять срез») — для сравнения A → B. */
interface Snapshot {
  id: number;
  ts: string;
  totalPackets: number;
  totalBytes: number;
  alerts: number;
  invalid: number;
  activeSessions: number;
  perProtocol: Record<string, number>;
}

/** Сравнение двух ручных срезов: дельты счётчиков + рост по протоколам (violet-акцент). */
function SnapshotDiff({ a, b, onClear }: { a: Snapshot; b: Snapshot; onClear: () => void }) {
  const diff = useMemo(() => {
    const perProtocol: Record<string, number> = {};
    for (const [proto, now] of Object.entries(b.perProtocol)) {
      const delta = now - (a.perProtocol[proto] ?? 0);
      if (delta > 0) perProtocol[proto] = delta;
    }
    const durationSec = Math.max(
      1,
      Math.round((new Date(b.ts).getTime() - new Date(a.ts).getTime()) / 1000)
    );
    return {
      durationSec,
      packets: Math.max(0, b.totalPackets - a.totalPackets),
      bytes: Math.max(0, b.totalBytes - a.totalBytes),
      alerts: Math.max(0, b.alerts - a.alerts),
      invalid: Math.max(0, b.invalid - a.invalid),
      perProtocol: Object.entries(perProtocol).sort((x, y) => y[1] - x[1]),
    };
  }, [a, b]);
  const protoTotal = diff.perProtocol.reduce((acc, [, n]) => acc + n, 0);
  const pps = Math.round((diff.packets / diff.durationSec) * 10) / 10;

  // Экспорт сравнения: файл генерируется на клиенте — срезы существуют только в UI
  const exportDiff = (format: "csv" | "jsonl") => {
    const stamp = fmtClock(b.ts).replace(/:/g, "");
    if (format === "csv") {
      // Excel-CSV («;», BOM) — как серверные csv-экспорты
      const rows: string[] = [
        ["Сравнение срезов аналитики", `A → B`, `длительность ${diff.durationSec} с`].join(";"),
        ["Срез A", a.ts, "пакетов", a.totalPackets, "байт", a.totalBytes].join(";"),
        ["Срез B", b.ts, "пакетов", b.totalPackets, "байт", b.totalBytes].join(";"),
        ["Дельта", "пакетов", diff.packets, "пак/с", pps, "байт", diff.bytes, "тревог", diff.alerts, "невалидных", diff.invalid].join(";"),
        "",
        "Протокол;Рост пакетов",
        ...diff.perProtocol.map(([proto, n]) => `${proto};+${n}`),
      ];
      downloadText(`\uFEFF${rows.join("\n")}\n`, `snapshot_diff_${stamp}.csv`, "text/csv;charset=utf-8");
    } else {
      const lines = [
        JSON.stringify({ type: "meta", a: a.ts, b: b.ts, durationSec: diff.durationSec }),
        JSON.stringify({ type: "delta", packets: diff.packets, pps, bytes: diff.bytes, alerts: diff.alerts, invalid: diff.invalid }),
        ...diff.perProtocol.map(([proto, n]) => JSON.stringify({ type: "protocol", protocol: proto, delta: n })),
      ];
      downloadText(`${lines.join("\n")}\n`, `snapshot_diff_${stamp}.jsonl`, "application/jsonl");
    }
    toast.success(`Сравнение срезов выгружено — ${format.toUpperCase()}`, {
      description: `${fmtCompact(diff.packets)} пакетов за ${diff.durationSec} с, протоколов: ${diff.perProtocol.length}.`,
      duration: 2500,
    });
  };
  return (
    <div
      role="status"
      aria-label={`Сравнение срезов аналитики за ${diff.durationSec} с`}
      className="mt-3 animate-in rounded-lg border border-violet-500/25 bg-violet-500/[0.04] p-3 fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
          <GitCompareArrows className="size-3.5 text-violet-400" aria-hidden />
          Сравнение срезов A → B
          <Badge
            variant="outline"
            className="border-slate-700 px-1.5 py-0 font-mono text-[10px] text-slate-400"
          >
            {fmtUptime(diff.durationSec)}
          </Badge>
        </span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => exportDiff("csv")}
            aria-label="Экспорт сравнения срезов в CSV"
            title="Экспорт сравнения в CSV (Excel) — «;», сводка + протоколы"
            className="flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-violet-500/10 hover:text-violet-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
          >
            <FileSpreadsheet className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => exportDiff("jsonl")}
            aria-label="Экспорт сравнения срезов в JSONL"
            title="Экспорт сравнения в JSONL — meta, дельты, протоколы"
            className="flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-violet-500/10 hover:text-violet-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
          >
            <FileJson className="size-3.5" aria-hidden />
          </button>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-700" />
          <button
            type="button"
            onClick={onClear}
            aria-label="Сбросить сравнение срезов"
            title="Сбросить срезы"
            className="flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
          <Activity className="size-3 text-violet-400" aria-hidden />
          <span className="font-semibold text-violet-300 tabular-nums">+{fmtCompact(diff.packets)}</span> пакетов
          <span className="text-slate-500">· {pps}/с</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
          <HardDrive className="size-3 text-cyan-400" aria-hidden />
          <span className="font-semibold text-cyan-300 tabular-nums">+{fmtBytes(diff.bytes)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
          <Siren className="size-3 text-red-400" aria-hidden />
          <span className="font-semibold text-red-300 tabular-nums">+{diff.alerts}</span> тревог
        </span>
        {diff.invalid > 0 && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <XCircle className="size-3 text-amber-400" aria-hidden />
            <span className="tabular-nums">{diff.invalid}</span> невалидных
          </span>
        )}
      </div>
      {diff.perProtocol.length > 0 && (
        <div className="mt-2.5 border-t border-violet-500/15 pt-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Рост по протоколам — срез A → срез B
          </p>
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
            role="img"
            aria-label={`Дельты по протоколам между срезами: ${diff.perProtocol
              .map(([p, n]) => `${p} +${n}`)
              .join(", ")}`}
          >
            {diff.perProtocol.map(([proto, n]) => (
              <div
                key={proto}
                className={`${protocolDot(proto)} transition-[flex-basis] duration-700`}
                style={{ flexBasis: `${Math.max(2, (n / protoTotal) * 100)}%` }}
                title={`${proto}: +${n}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {diff.perProtocol.map(([proto, n]) => (
              <span
                key={proto}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] text-slate-300"
              >
                <span className={`size-1.5 rounded-full ${protocolDot(proto)}`} aria-hidden />
                {proto}
                <span className="font-semibold text-violet-300 tabular-nums">+{fmtCompact(n)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PacketDetailSheet({
  packet,
  pendingId,
  open,
  onOpenChange,
  detail,
  loading,
  pinned,
  onTogglePin,
}: {
  packet: Packet | null;
  pendingId: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: { hexdump: string } | null;
  loading: boolean;
  pinned: boolean;
  onTogglePin: (p: Packet) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  const rows: [string, string][] = packet
    ? [
        ["ID", `#${packet.id}`],
        ["Время", fmtTime(packet.ts)],
        ["Направление", packet.direction],
        ["Клиент", packet.client],
        ["Канал", packet.portName],
        ["Протокол", packet.protocol],
        ["msg_type", packet.msgType ?? "—"],
        ["method_type", packet.methodType ?? "—"],
        ["method", packet.method ?? "—"],
        ["cmd_type", packet.cmdType ?? "—"],
        ["cmd_class / cmd", packet.cmdClass != null ? `${packet.cmdClass} / ${packet.cmd ?? "—"}` : "—"],
        ["Размер", fmtBytes(packet.size)],
        ["Валидность", packet.valid ? "✓ корректный" : "✗ повреждён/некорректен"],
      ]
    : [];

  const packetJson = useMemo(() => {
    if (!packet) return "";
    const { hexPreview: _hex, ...rest } = packet;
    return JSON.stringify(rest, null, 2);
  }, [packet]);

  const hexdumpText = detail?.hexdump ?? packet?.hexPreview ?? "";

  const handleCopy = async () => {
    if (!hexdumpText) return;
    try {
      await navigator.clipboard.writeText(hexdumpText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard недоступен */
    }
  };

  const handleCopyJson = async () => {
    if (!packetJson) return;
    try {
      await navigator.clipboard.writeText(packetJson);
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 1500);
    } catch {
      /* clipboard недоступен */
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto border-slate-800 bg-slate-950 p-4 sm:max-w-lg custom-scroll"
      >
        <SheetHeader className="p-0 pb-2 text-left">
          <SheetTitle className="text-base text-slate-100">
            Пакет {packet ? `#${packet.id}` : pendingId ? `#${pendingId}` : ""}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-400">
            {packet ? packet.summary : pendingId ? "Загрузка пакета из буфера сервера…" : ""}
          </SheetDescription>
        </SheetHeader>
        {packet ? (
          <div className="mt-2 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Поля пакета
              </p>
              <div className="flex items-center gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onTogglePin(packet)}
                  className={
                    pinned
                      ? "h-7 gap-1 px-2 text-[11px] text-amber-300 hover:bg-amber-500/10"
                      : "h-7 gap-1 px-2 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-amber-300"
                  }
                  aria-label={pinned ? "Открепить пакет" : "Закрепить пакет"}
                  title={
                    pinned
                      ? "Убрать из закреплённых"
                      : `Закрепить в панели над таблицей (до ${MAX_PINS})`
                  }
                >
                  {pinned ? <PinOff className="size-3" aria-hidden /> : <Pin className="size-3" aria-hidden />}
                  {pinned ? "открепить" : "закрепить"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyJson}
                  className="h-7 gap-1 px-2 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-cyan-300"
                  aria-label="Скопировать поля пакета как JSON"
                >
                  <FileJson className="size-3" aria-hidden />
                  {jsonCopied ? "скопировано" : "JSON"}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-slate-800">
              <Table>
                <TableBody>
                  {rows.map(([k, v]) => (
                    <TableRow key={k} className="border-slate-800/70">
                      <TableCell className="py-1.5 pl-3 pr-2 font-mono text-[11px] text-slate-500">
                        {k}
                      </TableCell>
                      <TableCell className="py-1.5 pr-3 font-mono text-xs text-slate-200">
                        {v}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Hexdump {loading ? "" : detail ? "(до 2 КБ)" : ""}
                </p>
                {!loading && hexdumpText && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopy}
                    className="h-7 gap-1 px-2 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-emerald-300"
                    aria-label="Скопировать hexdump"
                  >
                    <Copy className="size-3" aria-hidden />
                    {copied ? "скопировано" : "копировать"}
                  </Button>
                )}
              </div>
              {loading ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Загрузка дампа…
                </div>
              ) : (
                <pre className="max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] leading-relaxed text-emerald-300 custom-scroll">
                  {hexdumpText}
                </pre>
              )}
            </div>
          </div>
        ) : pendingId ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Запрос GET /api/sniffer/packet/{pendingId}…
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function SnifferTab({ live }: SnifferTabProps) {
  const { connected, packets, sessions, alerts, stats, series, scenario, scenarioResult } = live;

  // Фильтры
  const [search, setSearch] = useState("");
  const [protocol, setProtocol] = useState("all");
  const [direction, setDirection] = useState("all");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [paused, setPaused] = useState(false);
  const [frozenPackets, setFrozenPackets] = useState<Packet[] | null>(null);
  const [frozenTopId, setFrozenTopId] = useState(0);
  const [frozenStats, setFrozenStats] = useState<SnifferStats | null>(null);
  const [chartPaused, setChartPaused] = useState(false);
  const [frozenSeries, setFrozenSeries] = useState<SeriesPoint[] | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [muted, setMuted] = useState(false);
  const [selected, setSelected] = useState<Packet | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detail, setDetail] = useState<{ hexdump: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [metric, setMetric] = useState<ChartMetric>("pps");
  const [scenarioBusy, setScenarioBusy] = useState<ScenarioId | "stop" | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [inspectorRaw, setInspectorRaw] = useState<Session | null>(null);
  const [inspectorId, setInspectorId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [showTrends, setShowTrends] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [pinned, setPinned] = useState<Packet[]>([]);
  const [dense, setDense] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MAX_TABLE_ROWS);
  const [exportCounts, setExportCounts] = useState<ExportCounts | null>(null);
  const exportCountsSeq = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableCardRef = useRef<HTMLDivElement>(null);
  const alertToastSeenRef = useRef<string | null>(null);
  const soundSeenRef = useRef<string | null>(null);

  // Тосты по живым алертам (если не в mute) — реагируем только на новые id
  useEffect(() => {
    if (muted || alerts.length === 0) return;
    const latest = alerts[0];
    if (alertToastSeenRef.current === latest.id) return;
    const t = new Date(latest.createdAt).getTime();
    if (Date.now() - t < 2500) {
      alertToastSeenRef.current = latest.id;
      if (latest.severity === "crit") {
        toast.error(latest.rule, { description: latest.message, duration: 3500 });
      } else {
        toast.warning(latest.rule, { description: latest.message, duration: 3000 });
      }
    }
  }, [alerts, muted]);

  // Звук критических тревог (WebAudio, если включён тумблером)
  useEffect(() => {
    if (!soundOn || alerts.length === 0) return;
    const latest = alerts[0];
    if (latest.severity !== "crit") return;
    if (soundSeenRef.current === latest.id) return;
    const t = new Date(latest.createdAt).getTime();
    if (Date.now() - t < 2500) {
      soundSeenRef.current = latest.id;
      playCritBeep();
    }
  }, [alerts, soundOn]);

  // Сброс пагинации при смене фильтров и сортировки
  useEffect(() => {
    setVisibleCount(MAX_TABLE_ROWS);
  }, [search, protocol, direction, minSize, maxSize, sort]);

  // Тикаем часы для обратного отсчёта сценария
  useEffect(() => {
    if (!scenario) return;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [scenario]);

  // Восстановление настроек из прошлой сессии (после гидрации): тренды, плотность таблицы
  useEffect(() => {
    try {
      const v = localStorage.getItem("sniffer.showTrends");
      if (v !== null) setShowTrends(v === "1");
      const d = localStorage.getItem("sniffer.dense");
      if (d !== null) setDense(d === "1");
    } catch {
      /* приватный режим — настройки просто остаются по умолчанию */
    }
  }, []);

  const scenarioRemaining = useMemo(() => {
    if (!scenario) return 0;
    return Math.max(0, Math.ceil((new Date(scenario.endsAt).getTime() - nowTick) / 1000));
  }, [scenario, nowTick]);

  const handleScenario = async (id: ScenarioId | "stop") => {
    setScenarioBusy(id);
    try {
      const res =
        id === "stop"
          ? await fetch("/api/sniffer/scenario", { method: "DELETE" })
          : await fetch("/api/sniffer/scenario", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (id === "stop") {
        toast("Сценарий остановлен", { duration: 2000 });
      } else {
        const def = SCENARIO_CATALOG.find((s) => s.id === id);
        toast.success(`Сценарий «${def?.label}» запущен`, {
          description: "Генератор трафика изменил профиль — следите за графиком и тревогами.",
          duration: 3000,
        });
      }
    } catch (e) {
      toast.error("Не удалось изменить сценарий", {
        description: e instanceof Error ? e.message : String(e),
        duration: 3000,
      });
    } finally {
      setScenarioBusy(null);
    }
  };

  const handlePause = () => {
    if (!paused) {
      setFrozenPackets(packets);
      setFrozenTopId(packets[0]?.id ?? 0);
      if (stats) setFrozenStats(stats);
      setPaused(true);
      toast.info("Таблица остановлена", {
        description: "Приём пакетов продолжается в фоне (буфер 3000). Аналитика зафиксирована.",
        duration: 2500,
      });
    } else {
      setFrozenPackets(null);
      setFrozenTopId(0);
      setFrozenStats(null);
      setPaused(false);
    }
  };

  // «Перейти к свежим» с плавающей пилюли — снять паузу и проскроллить к таблице
  const jumpToFresh = () => {
    setFrozenPackets(null);
    setFrozenTopId(0);
    setFrozenStats(null);
    setPaused(false);
    tableCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Пауза графика отдельно от таблицы: график заморожен, поток и счётчики живут
  const toggleChartPause = () => {
    if (!chartPaused) {
      setFrozenSeries(series);
      setChartPaused(true);
      toast.info("График заморожен", {
        description: "Таблица пакетов и счётчики продолжают обновляться в реальном времени.",
        duration: 2500,
      });
    } else {
      setFrozenSeries(null);
      setChartPaused(false);
    }
  };

  // Тумблер трендов на KPI-карточках — выбор сохраняется между сессиями
  const toggleTrends = () => {
    setShowTrends((v) => {
      const next = !v;
      try {
        localStorage.setItem("sniffer.showTrends", next ? "1" : "0");
      } catch {
        /* приватный режим */
      }
      return next;
    });
  };

  // Сортировка таблицы: клик по заголовку — desc → asc → сброс к порядку потока
  const cycleSort = (key: SortKey) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: "desc" } : s.dir === "desc" ? { key, dir: "asc" } : null));

  // Ручной срез аналитики для сравнения A → B (кнопка или хоткей S)
  const takeSnapshot = () => {
    if (!stats) return;
    const snap: Snapshot = {
      id: Date.now(),
      ts: new Date().toISOString(),
      totalPackets: stats.totalPackets,
      totalBytes: stats.totalBytes,
      alerts: stats.alertsCount,
      invalid: stats.invalidPackets,
      activeSessions: stats.activeSessions,
      perProtocol: { ...stats.perProtocol },
    };
    const count = snapshots.length;
    setSnapshots((prev) => (prev.length >= 2 ? [...prev.slice(1), snap] : [...prev, snap]));
    if (count === 0) {
      toast.success("Срез A зафиксирован", {
        description: "Снимите второй срез — панель посчитает дельты между ними.",
        duration: 2500,
      });
    } else if (count === 1) {
      toast.success("Срез B зафиксирован — сравнение готово", {
        description: "Дельты показаны в карточке «Аналитика трафика».",
        duration: 2500,
      });
    } else {
      toast("Срез B обновлён", {
        description: "Старый срез вытеснен — дельты пересчитаны от нового B.",
        duration: 2500,
      });
    }
  };

  // Закрепление пакетов: максимум MAX_PINS, при переполнении вытесняется самый старый
  const togglePin = (p: Packet) => {
    const exists = pinned.some((x) => x.id === p.id);
    if (exists) {
      setPinned(pinned.filter((x) => x.id !== p.id));
      toast(`Пакет #${p.id} откреплён`, { duration: 1800 });
      return;
    }
    const evicted = pinned.length >= MAX_PINS && pinned.length > 0 ? pinned[0] : null;
    setPinned((prev) => (prev.length >= MAX_PINS ? [...prev.slice(1), p] : [...prev, p]));
    toast.success(`Пакет #${p.id} закреплён`, {
      description: evicted
        ? `Максимум ${MAX_PINS} закреплений — пакет #${evicted.id} вытеснен.`
        : "Чип в панели над таблицей пакетов — быстрый доступ.",
      duration: 2200,
    });
  };

  // Плотность строк таблицы: компактные ↔ обычные (сохраняется в localStorage)
  const toggleDense = () => {
    setDense((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sniffer.dense", next ? "1" : "0");
      } catch {
        /* приватный режим */
      }
      return next;
    });
  };

  // Горячие клавиши вкладки: P — пауза таблицы, S — снять срез, / — фокус на поиск
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key.toLowerCase() === "p" || e.key === "з") {
        if (typing || sheetOpen) return;
        e.preventDefault();
        handlePause();
      } else if (e.key.toLowerCase() === "s" || e.key === "ы") {
        if (typing || sheetOpen) return;
        e.preventDefault();
        takeSnapshot();
      } else if (e.key === "/") {
        if (sheetOpen) return;
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, packets, paused, stats, snapshots]);

  const openPacketById = (id: number) => {
    const local = packets.find((p) => p.id === id);
    if (local) {
      onRowClick(local);
      return;
    }
    setPendingId(id);
    setSelected(null);
    setSheetOpen(true);
    setDetail(null);
    setDetailLoading(true);
    fetch(`/api/sniffer/packet/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? "notfound" : String(r.status)))))
      .then((d: { packet: Packet; hexdump: string }) => {
        setSelected(d.packet);
        setDetail({ hexdump: d.hexdump });
      })
      .catch(() => {
        toast.error(`Пакет #${id} недоступен`, {
          description: "Вытеснен из кольцевого буфера сниффера (5000 пакетов).",
          duration: 3000,
        });
        setSheetOpen(false);
      })
      .finally(() => {
        setPendingId(null);
        setDetailLoading(false);
      });
  };

  const filterByClient = (clientAddr: string) => {
    const ip = clientAddr.split(":")[0];
    setSearch(ip);
    setPaused(false);
    setFrozenPackets(null);
    tableCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast(`Фильтр по клиенту ${ip}`, {
      description: "Таблица пакетов отфильтрована по адресам этого клиента.",
      duration: 2500,
    });
  };

  const handleSoundToggle = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) {
      playConfirmBlip();
      toast("Звук критических тревог включён", {
        description: "Двухтональный сигнал при каждом CRIT-алерте.",
        duration: 2500,
      });
    } else {
      toast("Звук тревог выключен", { duration: 2000 });
    }
  };

  // Тренды KPI: дельта среднего за последнюю минуту против предыдущей (из series)
  const ppsTrend = useMemo(() => computeTrend(series.map((s) => s.pps)), [series]);
  const bpsTrend = useMemo(() => computeTrend(series.map((s) => s.bps)), [series]);

  // Видимый ряд графика: замораживается независимо от таблицы
  const chartSeries = chartPaused && frozenSeries ? frozenSeries : series;
  const filtered = useMemo(() => {
    const source = paused && frozenPackets ? frozenPackets : packets;
    const s = search.trim().toLowerCase();
    const min = parseInt(minSize, 10);
    const max = parseInt(maxSize, 10);
    return source.filter((p) => {
      if (protocol !== "all" && p.protocol !== protocol) return false;
      if (direction !== "all" && p.direction !== direction) return false;
      if (!Number.isNaN(min) && p.size < min) return false;
      if (!Number.isNaN(max) && p.size > max) return false;
      if (s) {
        const hay = `${p.summary} ${p.method ?? ""} ${p.methodType ?? ""} ${p.cmdType ?? ""} ${p.client}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [packets, frozenPackets, paused, search, protocol, direction, minSize, maxSize]);

  // Сортировка по клику на заголовок (по умолчанию — порядок потока, свежие сверху)
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((x, y) => {
      switch (sort.key) {
        case "size":
          return x.size - y.size;
        case "port":
          return x.portName.localeCompare(y.portName, undefined, { numeric: true });
        case "protocol":
          return x.protocol.localeCompare(y.protocol);
        default:
          return new Date(x.ts).getTime() - new Date(y.ts).getTime();
      }
    });
    if (sort.dir === "desc") arr.reverse();
    return arr;
  }, [filtered, sort]);

  // Новые пакеты, пришедшие в фоне, пока таблица на паузе
  const newWhilePaused = useMemo(() => {
    if (!paused) return 0;
    let n = 0;
    for (const p of packets) {
      if (p.id > frozenTopId) n += 1;
    }
    return n;
  }, [paused, packets, frozenTopId]);

  const display = sorted.slice(0, visibleCount);
  const latestAlerts = alerts.slice(0, 50);
  const sessionList = sessions.slice(0, 12);

  // Свежая сессия для инспектора (SSE обновляет счётчики/состояние), фолбэк на снимок
  const inspectorSession = useMemo(() => {
    if (!inspectorId) return null;
    return sessions.find((s) => s.id === inspectorId) ?? inspectorRaw;
  }, [inspectorId, sessions, inspectorRaw]);

  // Пульс тревожной карточки: был CRIT за последние 15с
  const critPulse = useMemo(() => {
    const lastCrit = alerts.find((a) => a.severity === "crit");
    if (!lastCrit) return false;
    return Date.now() - new Date(lastCrit.createdAt).getTime() < 15000;
  }, [alerts]);

  // Чипы быстрого фильтра протоколов (статистика замораживается на паузе вместе с аналитикой)
  const visibleStats = paused && frozenStats ? frozenStats : stats;
  const protoChips = useMemo(() => {
    if (!visibleStats) return [] as [string, number][];
    return Object.entries(visibleStats.perProtocol).sort((a, b) => b[1] - a[1]);
  }, [visibleStats]);

  // Распределение тревог по правилам — мини-бар в шапке карточки «Тревоги»
  const ruleDist = useMemo(() => {
    const latest = alerts.slice(0, 50);
    const m = new Map<string, number>();
    for (const a of latest) m.set(a.rule, (m.get(a.rule) ?? 0) + 1);
    const palette = ["bg-red-500/80", "bg-amber-500/80", "bg-violet-500/80"];
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const items = entries.slice(0, 3).map(([rule, n], i) => ({ rule, n, cls: palette[i] }));
    const rest = entries.slice(3).reduce((acc, [, n]) => acc + n, 0);
    if (rest > 0) items.push({ rule: "другие правила", n: rest, cls: "bg-slate-500/80" });
    return { items, total: latest.length };
  }, [alerts]);

  // Закреплённые id — янтарная метка строк в таблице
  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.id)), [pinned]);

  // Активные фильтры → чипы с быстрым сбросом
  const chips = useMemo(() => {
    const out: { key: string; label: string; clear: () => void }[] = [];
    if (search.trim()) out.push({ key: "search", label: `поиск: ${search.trim()}`, clear: () => setSearch("") });
    if (protocol !== "all") out.push({ key: "proto", label: `протокол: ${protocol}`, clear: () => setProtocol("all") });
    if (direction !== "all") out.push({ key: "dir", label: direction === "TX" ? "только TX" : "только RX", clear: () => setDirection("all") });
    if (minSize) out.push({ key: "min", label: `≥ ${minSize} Б`, clear: () => setMinSize("") });
    if (maxSize) out.push({ key: "max", label: `≤ ${maxSize} Б`, clear: () => setMaxSize("") });
    return out;
  }, [search, protocol, direction, minSize, maxSize]);

  // QS экспорта «только отфильтрованного» — те же условия, что у таблицы
  const filterQuery = useMemo(() => {
    const sp = new URLSearchParams();
    if (search.trim()) sp.set("search", search.trim());
    if (protocol !== "all") sp.set("protocol", protocol);
    if (direction !== "all") sp.set("direction", direction);
    if (minSize) sp.set("minSize", minSize);
    if (maxSize) sp.set("maxSize", maxSize);
    return sp.toString();
  }, [search, protocol, direction, minSize, maxSize]);

  // Счётчики строк экспорта — лёгкий counts-запрос при открытии меню (без генерации файлов)
  const loadExportCounts = () => {
    const seq = ++exportCountsSeq.current;
    fetch(`/api/sniffer/export?counts=1${filterQuery ? `&${filterQuery}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ExportCounts) => {
        if (seq === exportCountsSeq.current) setExportCounts(d);
      })
      .catch(() => undefined);
  };

  const onRowClick = (p: Packet) => {
    setSelected(p);
    setSheetOpen(true);
    setDetail(null);
    setDetailLoading(true);
    fetch(`/api/sniffer/packet/${p.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("404"))))
      .then((d: { hexdump: string }) => setDetail(d))
      .catch(() => setDetail({ hexdump: p.hexPreview }))
      .finally(() => setDetailLoading(false));
  };

  return (
    <div className="relative space-y-4">
      {/* Декоративное свечение вверху вкладки */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 z-0 h-44 bg-[radial-gradient(55%_60%_at_50%_0%,rgba(16,185,129,0.09),transparent_70%)]"
      />
      {/* Статбар */}
      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Пакеты всего"
          value={stats ? fmtCompact(stats.totalPackets) : "—"}
          sub={stats ? `${stats.lastPps} п/с · ${stats.invalidPackets} невалидных` : undefined}
          spark={<Sparkline data={series.map((s) => s.pps)} stroke="#10b981" />}
          trend={showTrends ? ppsTrend : undefined}
        />
        <StatCard
          icon={HardDrive}
          label="Байт перехвачено"
          value={stats ? fmtBytes(stats.totalBytes) : "—"}
          sub={stats ? fmtRate(stats.lastBps) : undefined}
          spark={<Sparkline data={series.map((s) => s.bps)} stroke="#22d3ee" />}
          trend={showTrends ? bpsTrend : undefined}
        />
        <StatCard
          icon={Network}
          label="Активные сессии"
          value={stats ? String(stats.activeSessions) : "—"}
          sub={stats ? `всего за сессию: ${stats.totalSessions}` : undefined}
        />
        <StatCard
          icon={Siren}
          label="Тревоги"
          value={stats ? String(stats.alertsCount) : "—"}
          sub="правила config.json"
          alert={(stats?.alertsCount ?? 0) > 0}
          critPulse={critPulse}
        />
      </div>

      {/* Сценарии трафика (демо-режимы генератора) */}
      <Card
        className={`border-slate-800 bg-slate-900/60 ${
          scenario ? "border-amber-500/50 shadow-[0_0_18px_-6px] shadow-amber-500/30" : ""
        }`}
      >
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
            <Zap className={`size-4 ${scenario ? "text-amber-400" : "text-emerald-400"}`} aria-hidden />
            Сценарии трафика
            {scenario && (
              <Badge
                variant="outline"
                className="border-amber-500/50 bg-amber-500/10 font-mono text-[10px] text-amber-300"
              >
                {scenario.label} · осталось {scenarioRemaining}с
              </Badge>
            )}
          </CardTitle>
          <span className="text-[11px] text-slate-500">
            демо-режимы генератора — как если бы АЗС начали массовый опрос
          </span>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
          {SCENARIO_CATALOG.map((s) => {
            const isActive = scenario?.id === s.id;
            const busy = scenarioBusy === s.id;
            return (
              <Button
                key={s.id}
                size="sm"
                variant="outline"
                disabled={scenarioBusy !== null}
                onClick={() => handleScenario(s.id)}
                aria-pressed={isActive}
                className={`min-h-[44px] flex-col items-start gap-0 border-slate-700 sm:min-h-[40px] ${
                  isActive
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                    : "bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
                  {s.label}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{s.hint}</span>
              </Button>
            );
          })}
          {scenario && (
            <Button
              size="sm"
              variant="outline"
              disabled={scenarioBusy !== null}
              onClick={() => handleScenario("stop")}
              className="ml-auto min-h-[44px] border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 sm:min-h-[40px]"
            >
              {scenarioBusy === "stop" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Square className="size-3.5" aria-hidden />
              )}
              Остановить
            </Button>
          )}
        </CardContent>
        {/* Итоги последнего сценария — дельты за окно генерации (key → новый сценарий сбрасывает скрытие) */}
        {scenarioResult && (
          <ScenarioResults key={scenarioResult.startedAt} result={scenarioResult} />
        )}
      </Card>

      {/* График (пауза графика — отдельно от паузы таблицы) */}
      <Card
        className={`border-slate-800 bg-slate-900/60 transition-colors ${
          chartPaused ? "border-amber-500/40 shadow-[0_0_18px_-8px] shadow-amber-500/30" : ""
        }`}
      >
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
            <span className="flex flex-wrap items-center gap-2">
              {metric === "pps" ? "Пакетов в секунду" : "Байтов в секунду"}
              {stats && (
                <Badge variant="outline" className="border-slate-700 font-mono text-[10px] text-slate-400">
                  uptime {Math.floor(stats.uptimeSec / 60)}м {stats.uptimeSec % 60}с
                </Badge>
              )}
              {chartPaused && (
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-400">
                  график на паузе
                </Badge>
              )}
            </span>
            <span className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleChartPause}
                aria-pressed={chartPaused}
                aria-label={chartPaused ? "Продолжить график" : "Пауза графика"}
                title={
                  chartPaused
                    ? "Продолжить график"
                    : "Пауза графика — таблица и счётчики продолжают обновляться"
                }
                className={`h-8 w-8 p-0 ${
                  chartPaused
                    ? "text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {chartPaused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleTrends}
                aria-pressed={showTrends}
                aria-label={showTrends ? "Скрыть бейджи трендов на KPI-карточках" : "Показать бейджи трендов на KPI-карточках"}
                title={
                  showTrends
                    ? "Бейджи трендов ▲▼ на KPI-карточках: вкл — скрыть, если шумят"
                    : "Бейджи трендов ▲▼ на KPI-карточках: выкл — включить"
                }
                className={`h-8 w-8 p-0 ${
                  showTrends
                    ? "text-amber-400/90 hover:bg-amber-500/10 hover:text-amber-300"
                    : "text-slate-600 hover:bg-slate-800 hover:text-slate-300"
                }`}
              >
                <TrendingUp className="size-4" aria-hidden />
              </Button>
              <ToggleGroup
                type="single"
                variant="outline"
                value={metric}
                onValueChange={(v) => v && setMetric(v as ChartMetric)}
              >
                <ToggleGroupItem
                  value="pps"
                  aria-label="Метрика: пакетов в секунду"
                  className="h-8 border-slate-700 px-2.5 text-[11px] text-slate-400 data-[state=on]:bg-emerald-500/15 data-[state=on]:text-emerald-300"
                >
                  пак/с
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="bps"
                  aria-label="Метрика: байтов в секунду"
                  className="h-8 border-slate-700 px-2.5 text-[11px] text-slate-400 data-[state=on]:bg-cyan-500/15 data-[state=on]:text-cyan-300"
                >
                  Б/с
                </ToggleGroupItem>
              </ToggleGroup>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <PpsChart series={chartSeries} metric={metric} frozen={chartPaused} />
        </CardContent>
      </Card>

      {/* Распределение протоколов + топы (аналитика замирает на паузе; срезы — ручные снимки) */}
      {visibleStats && (
        <Card
          className={`border-slate-800 bg-slate-900/60 transition-colors ${
            paused
              ? "border-amber-500/30"
              : snapshots.length > 0
                ? "border-violet-500/25"
                : ""
          }`}
        >
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
                Аналитика трафика
                {paused && (
                  <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-400">
                    снимок на паузе
                  </Badge>
                )}
              </CardTitle>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {paused ? "зафиксировано на момент паузы" : "живые счётчики буфера"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {snapshots.map((s, i) => (
                <span
                  key={s.id}
                  title={`Срез ${i === 0 ? "A" : "B"} — снят в ${fmtClock(s.ts)} · ${fmtCompact(s.totalPackets)} пакетов`}
                  className="inline-flex animate-in items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] text-violet-300 fade-in duration-300"
                >
                  <span
                    className={`size-1.5 rounded-full ${i === 0 ? "bg-violet-400" : "bg-fuchsia-400"}`}
                    aria-hidden
                  />
                  срез {i === 0 ? "A" : "B"} · {fmtClock(s.ts)}
                </span>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={takeSnapshot}
                disabled={!stats}
                title="Снять срез аналитики (S) — второй срез запускает сравнение"
                className="min-h-[36px] border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-violet-300"
              >
                <Camera className="size-3.5" aria-hidden />
                {snapshots.length === 0 ? "Снять срез" : snapshots.length === 1 ? "Снять срез B" : "Новый срез"}
                <kbd className="ml-1 hidden rounded border border-slate-700 bg-slate-900 px-1 font-mono text-[9px] text-slate-500 sm:inline">
                  S
                </kbd>
              </Button>
              {snapshots.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSnapshots([])}
                  aria-label="Сбросить срезы аналитики"
                  title="Сбросить срезы"
                  className="h-9 w-9 p-0 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ProtocolBreakdown
              perProtocol={visibleStats.perProtocol}
              totalPackets={visibleStats.totalPackets}
              topMethods={visibleStats.topMethods}
              topClients={visibleStats.topClients}
            />
            {snapshots.length === 2 && (
              <SnapshotDiff a={snapshots[0]} b={snapshots[1]} onClear={() => setSnapshots([])} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Фильтры */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto_auto] lg:grid-cols-[1.4fr_auto_auto_auto_auto_auto]">
          <div className="space-y-1">
            <Label htmlFor="pkt-search" className="text-[11px] text-slate-400">
              Поиск (метод, резюме, клиент)
            </Label>
            <Input
              id="pkt-search"
              ref={searchInputRef}
              placeholder="напр. sendTanksState или 10.8.0.51"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder:text-slate-600"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-400">Протокол</Label>
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger className="h-10 w-full min-w-[150px] border-slate-700 bg-slate-950 text-sm text-slate-200 md:w-[160px]">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-950 text-slate-200">
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="REMOTE_SERVER">REMOTE_SERVER</SelectItem>
                <SelectItem value="THRIFT">THRIFT</SelectItem>
                <SelectItem value="HTTP">HTTP</SelectItem>
                <SelectItem value="JSON">JSON</SelectItem>
                <SelectItem value="MODBUS">MODBUS</SelectItem>
                <SelectItem value="RAW">RAW</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-400">Направление</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={direction}
              onValueChange={(v) => v && setDirection(v)}
              className="border-slate-700"
            >
              <ToggleGroupItem
                value="all"
                aria-label="Все направления"
                className="h-10 border-slate-700 px-3 text-xs text-slate-300 data-[state=on]:bg-slate-800 data-[state=on]:text-emerald-300"
              >
                Все
              </ToggleGroupItem>
              <ToggleGroupItem
                value="TX"
                aria-label="Только TX"
                className="h-10 border-slate-700 px-3 font-mono text-xs text-emerald-400 data-[state=on]:bg-emerald-500/15 data-[state=on]:text-emerald-300"
              >
                TX
              </ToggleGroupItem>
              <ToggleGroupItem
                value="RX"
                aria-label="Только RX"
                className="h-10 border-slate-700 px-3 font-mono text-xs text-cyan-400 data-[state=on]:bg-cyan-500/15 data-[state=on]:text-cyan-300"
              >
                RX
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex gap-2">
            <div className="w-[92px] space-y-1">
              <Label htmlFor="min-size" className="text-[11px] text-slate-400">
                ≥ Байт
              </Label>
              <Input
                id="min-size"
                inputMode="numeric"
                placeholder="0"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value.replace(/\D/g, ""))}
                className="h-10 border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder:text-slate-600"
              />
            </div>
            <div className="w-[92px] space-y-1">
              <Label htmlFor="max-size" className="text-[11px] text-slate-400">
                ≤ Байт
              </Label>
              <Input
                id="max-size"
                inputMode="numeric"
                placeholder="∞"
                value={maxSize}
                onChange={(e) => setMaxSize(e.target.value.replace(/\D/g, ""))}
                className="h-10 border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder:text-slate-600"
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={handlePause}
              variant="outline"
              className={`min-h-[44px] border-slate-700 sm:min-h-[40px] ${
                paused
                  ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200"
                  : "bg-slate-950 text-slate-200 hover:bg-slate-800"
              }`}
              aria-pressed={paused}
            >
              {paused ? (
                <>
                  <Play className="size-4" aria-hidden /> Продолжить
                </>
              ) : (
                <>
                  <Pause className="size-4" aria-hidden /> Пауза
                </>
              )}
            </Button>
          </div>
          <div className="flex items-end">
            <span className="whitespace-nowrap rounded-md border border-slate-800 bg-slate-950 px-2.5 py-2 font-mono text-[11px] text-slate-400">
              отфильтровано: <span className="text-emerald-300">{fmtCompact(filtered.length)}</span> из{" "}
              {fmtCompact(packets.length)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Активные фильтры (чипы) */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="status" aria-label="Активные фильтры">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Фильтры:</span>
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 py-1 pl-2.5 pr-1 text-[11px] text-emerald-300"
            >
              <span className="truncate font-mono">{c.label}</span>
              <button
                type="button"
                onClick={c.clear}
                aria-label={`Сбросить фильтр ${c.label}`}
                className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-emerald-500/20"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setProtocol("all");
              setDirection("all");
              setMinSize("");
              setMaxSize("");
            }}
            className="h-7 px-2 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            сбросить всё
          </Button>
        </div>
      )}

      {/* Таблица пакетов */}
      <Card ref={tableCardRef} className="scroll-mt-20 border-slate-800 bg-slate-900/60">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
            <span className="flex items-center gap-2">
              Поток пакетов
              {paused && (
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-400">
                  пауза — показан снимок
                </Badge>
              )}
              {!connected && (
                <Badge variant="outline" className="border-red-500/50 bg-red-500/10 text-[10px] text-red-400">
                  офлайн
                </Badge>
              )}
            </span>
            {filtered.length > display.length && (
              <span className="text-[11px] font-normal text-slate-500">
                показаны {display.length} из {fmtCompact(filtered.length)}
              </span>
            )}
            {sort && (
              <span className="inline-flex animate-in items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 py-0.5 pl-2 pr-1 font-mono text-[10px] text-emerald-300 fade-in duration-300">
                сортировка: {SORT_LABELS[sort.key]} {sort.dir === "desc" ? "↓" : "↑"}
                <button
                  type="button"
                  onClick={() => setSort(null)}
                  aria-label="Сбросить сортировку таблицы"
                  title="Вернуть порядок потока (свежие сверху)"
                  className="flex size-4 items-center justify-center rounded-full hover:bg-emerald-500/25"
                >
                  <X className="size-2.5" aria-hidden />
                </button>
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleDense}
              aria-pressed={dense}
              title={dense ? "Обычная плотность строк" : "Компактные строки — больше пакетов без прокрутки"}
              className="min-h-[36px] w-9 justify-center border-slate-700 bg-slate-950 px-0 text-slate-400 hover:bg-slate-800 hover:text-slate-100 aria-pressed:border-emerald-500/50 aria-pressed:text-emerald-300"
            >
              <Rows3 className="size-3.5" aria-hidden />
            </Button>
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) {
                setExportCounts(null);
                loadExportCounts();
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[36px] border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                <Download className="size-3.5" aria-hidden />
                Экспорт
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-slate-700 bg-slate-950 text-slate-200">
              <DropdownMenuLabel className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-wide text-slate-500">
                <span>как в реальном сниффере</span>
                {exportCounts && (
                  <span className="font-mono text-[10px] normal-case tracking-normal text-slate-600">
                    буфер: {fmtCompact(exportCounts.packets)} пак.
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a href="/api/sniffer/export?format=jsonl" download className="cursor-pointer">
                  <FileJson className="mr-2 size-3.5 text-emerald-400" aria-hidden />
                  traffic.jsonl — пакеты
                  <ExportCount n={exportCounts?.packets} />
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/sniffer/export?format=csv" download className="cursor-pointer">
                  <FileSpreadsheet className="mr-2 size-3.5 text-emerald-400" aria-hidden />
                  отчёт CSV — сводка + пакеты
                  <ExportCount n={exportCounts?.packets} />
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/sniffer/export?format=sessions" download className="cursor-pointer">
                  <FileSpreadsheet className="mr-2 size-3.5 text-emerald-400" aria-hidden />
                  sessions.csv — сессии
                  <ExportCount n={exportCounts?.sessions} />
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/sniffer/export?format=alerts" download className="cursor-pointer">
                  <FileJson className="mr-2 size-3.5 text-amber-400" aria-hidden />
                  alerts.jsonl — журнал тревог
                  <ExportCount n={exportCounts?.alerts} />
                </a>
              </DropdownMenuItem>
              {filterQuery && (
                <>
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    className="my-1 h-px bg-slate-800"
                  />
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-400/80">
                    <Filter className="size-3" aria-hidden />
                    по текущему фильтру
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <a
                      href={`/api/sniffer/export?format=jsonl&${filterQuery}`}
                      download
                      className="cursor-pointer"
                    >
                      <FileJson className="mr-2 size-3.5 text-emerald-300" aria-hidden />
                      filtered.jsonl — срез по фильтру
                      <ExportCount n={exportCounts?.filtered} />
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href={`/api/sniffer/export?format=csv&${filterQuery}`}
                      download
                      className="cursor-pointer"
                    >
                      <FileSpreadsheet className="mr-2 size-3.5 text-emerald-300" aria-hidden />
                      filtered.csv — срез по фильтру
                      <ExportCount n={exportCounts?.filtered} />
                    </a>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {/* Быстрые фильтры каналов с живыми счётчиками */}
          {protoChips.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/60 px-4 py-2"
              role="toolbar"
              aria-label="Быстрый фильтр по протоколам"
            >
              <span className="mr-1 text-[10px] uppercase tracking-wider text-slate-500">
                Каналы:
              </span>
              {protoChips.map(([name, count]) => {
                const active = protocol === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setProtocol(active ? "all" : name)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                      active
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                        : "border-slate-700/70 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${protocolDot(name)}`} aria-hidden />
                    {name}
                    <span className="tabular-nums text-slate-500">{fmtCompact(count)}</span>
                  </button>
                );
              })}
            </div>
          )}
          {/* Закреплённые пакеты — быстрая панель доступа */}
          {pinned.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/60 px-4 py-2"
              role="toolbar"
              aria-label="Закреплённые пакеты"
            >
              <span className="mr-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                <Pin className="size-3 text-amber-400" aria-hidden />
                Закреплено:
              </span>
              {pinned.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex animate-in items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/[0.07] py-0.5 pl-2 pr-1 font-mono text-[10px] text-amber-200 fade-in duration-300"
                >
                  <button
                    type="button"
                    onClick={() => openPacketById(p.id)}
                    title={`Открыть пакет #${p.id} — ${p.portName}`}
                    className="inline-flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    #{p.id}
                    <span className="max-w-[110px] truncate text-amber-200/70">{p.portName}</span>
                    <span className="tabular-nums text-amber-200/50">{fmtBytes(p.size)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePin(p)}
                    aria-label={`Открепить пакет #${p.id}`}
                    className="flex size-4 items-center justify-center rounded-full hover:bg-amber-500/25"
                  >
                    <X className="size-2.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className={`max-h-[60vh] overflow-y-auto custom-scroll ${dense ? "[&_td]:py-1 [&_th]:py-1.5" : ""}`}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-900 shadow-[0_1px_0_0_theme(colors.slate.800)]">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead aria-sort={sort?.key === "ts" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="pl-4">
                    <button
                      type="button"
                      onClick={() => cycleSort("ts")}
                      title="Сортировка по времени: свежие → старые → старые → свежие → порядок потока"
                      className={`inline-flex items-center gap-1 rounded font-mono text-[11px] transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 ${
                        sort?.key === "ts" ? "text-emerald-300" : "text-slate-500"
                      }`}
                    >
                      Время
                      {sort?.key === "ts" ? (
                        sort.dir === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-[11px] text-slate-500">↕</TableHead>
                  <TableHead aria-sort={sort?.key === "port" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button
                      type="button"
                      onClick={() => cycleSort("port")}
                      title="Сортировка по каналу: А→Я → Я→А → порядок потока"
                      className={`inline-flex items-center gap-1 rounded text-[11px] transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 ${
                        sort?.key === "port" ? "text-emerald-300" : "text-slate-500"
                      }`}
                    >
                      Канал
                      {sort?.key === "port" ? (
                        sort.dir === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead aria-sort={sort?.key === "protocol" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button
                      type="button"
                      onClick={() => cycleSort("protocol")}
                      title="Сортировка по протоколу: А→Я → Я→А → порядок потока"
                      className={`inline-flex items-center gap-1 rounded text-[11px] transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 ${
                        sort?.key === "protocol" ? "text-emerald-300" : "text-slate-500"
                      }`}
                    >
                      Протокол
                      {sort?.key === "protocol" ? (
                        sort.dir === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-[11px] text-slate-500">Тип / метод</TableHead>
                  <TableHead aria-sort={sort?.key === "size" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="text-right">
                    <button
                      type="button"
                      onClick={() => cycleSort("size")}
                      title="Сортировка по размеру: крупные → мелкие → мелкие → крупные → порядок потока"
                      className={`inline-flex items-center gap-1 rounded text-[11px] transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 ${
                        sort?.key === "size" ? "text-emerald-300" : "text-slate-500"
                      }`}
                    >
                      Размер
                      {sort?.key === "size" ? (
                        sort.dir === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-[11px] text-slate-500">Валид</TableHead>
                  <TableHead className="pr-4 text-[11px] text-slate-500">Резюме</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {display.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Inbox className="size-8 text-slate-600" aria-hidden />
                        <span className="text-sm text-slate-400">
                          {connected ? "Пакетов по фильтру не найдено" : "Нет соединения с потоком сниффера"}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {connected
                            ? "Ослабьте фильтры или дождитесь новых пакетов — поток живёт"
                            : "Переподключение к /api/sniffer/stream…"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  display.map((p, idx) => (
                    <TableRow
                      key={p.id}
                      onClick={() => onRowClick(p)}
                      className={`cursor-pointer border-slate-800/70 hover:bg-slate-800/60 ${
                        !p.valid
                          ? "bg-red-500/[0.05]"
                          : idx % 2 === 1
                            ? "bg-slate-950/40"
                            : ""
                      } ${pinnedIds.has(p.id) ? "border-l-2 border-l-amber-400/70" : ""}`}
                    >
                      <TableCell className="whitespace-nowrap py-2 pl-4 font-mono text-[11px] text-slate-400 tabular-nums">
                        {fmtTime(p.ts)}
                      </TableCell>
                      <TableCell className="py-2">
                        <DirBadge dir={p.direction} />
                      </TableCell>
                      <TableCell className="max-w-[130px] truncate py-2 text-xs text-slate-300" title={`${p.portName} · ${p.client}`}>
                        {p.portName}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`px-1.5 py-0 font-mono text-[10px] ${protocolColor(p.protocol)}`}
                        >
                          {p.protocol}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate py-2 font-mono text-xs text-slate-200">
                        <Highlight text={p.methodType ?? p.method ?? p.msgType ?? "—"} query={search} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 text-right font-mono text-xs text-slate-300 tabular-nums">
                        {fmtBytes(p.size)}
                      </TableCell>
                      <TableCell className="py-2">
                        {p.valid ? (
                          <CheckCircle2 className="size-4 text-emerald-500" aria-label="валидный" />
                        ) : (
                          <XCircle className="size-4 text-red-500" aria-label="невалидный" />
                        )}
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate py-2 pr-4 text-xs text-slate-400" title={p.summary}>
                        <Highlight text={p.summary} query={search} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Подгрузка истории пакетов */}
          {filtered.length > display.length && (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-800/60 px-4 py-2.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setVisibleCount((c) => Math.min(c + MAX_TABLE_ROWS, filtered.length))
                }
                className="min-h-[36px] border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-emerald-300"
              >
                <ChevronDown className="size-3.5" aria-hidden />
                Показать ещё {Math.min(MAX_TABLE_ROWS, filtered.length - display.length)}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setVisibleCount(filtered.length)}
                className="min-h-[36px] px-2 text-[11px] text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              >
                показать все ({fmtCompact(filtered.length)})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Сессии + Тревоги */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
              Сессии
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 font-mono text-[10px] text-emerald-400"
              >
                активных: {sessions.filter((s) => s.state === "active").length}
              </Badge>
            </CardTitle>
            <span className="text-[10px] text-slate-500">клик — инспектор сессии</span>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="max-h-64 overflow-y-auto custom-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] text-slate-500">Клиент</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Канал</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Протокол</TableHead>
                    <TableHead className="text-right text-[11px] text-slate-500">TX/RX пак.</TableHead>
                    <TableHead className="text-right text-[11px] text-slate-500">Байты</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Время</TableHead>
                    <TableHead className="pr-4 text-[11px] text-slate-500">Состояние</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-xs text-slate-500">
                        Нет сессий
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessionList.map((s) => (
                      <TableRow
                        key={s.id}
                        onClick={() => {
                          setInspectorRaw(s);
                          setInspectorId(s.id);
                        }}
                        title="Открыть инспектор сессии — все пакеты в одном листе"
                        className="cursor-pointer border-slate-800/70 transition-colors hover:bg-emerald-500/5"
                      >
                        <TableCell className="py-2 pl-4 font-mono text-xs text-slate-200">
                          <span className="inline-flex items-center gap-1.5">
                            {s.client}
                            <Radio className="size-3 text-slate-600" aria-hidden />
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate py-2 text-xs text-slate-300">
                          {s.portName}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={`px-1.5 py-0 font-mono text-[10px] ${protocolColor(s.protocol)}`}
                          >
                            {s.protocol}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 text-right font-mono text-[11px]">
                          <span className="text-emerald-400">{s.txPackets}</span>
                          <span className="text-slate-600"> / </span>
                          <span className="text-cyan-400">{s.rxPackets}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 text-right font-mono text-[11px] text-slate-400">
                          {fmtBytes(s.txBytes + s.rxBytes)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 font-mono text-[11px] text-slate-400">
                          {fmtClock(s.startedAt)}
                        </TableCell>
                        <TableCell className="py-2 pr-4">
                          <StateBadge state={s.state} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
              Тревоги
              {latestAlerts.some((a) => a.severity === "crit") && (
                <Badge
                  variant="outline"
                  className="border-red-500/40 bg-red-500/10 px-1.5 py-0 font-mono text-[10px] text-red-400"
                >
                  crit: {latestAlerts.filter((a) => a.severity === "crit").length}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setJournalOpen(true)}
                title="Персистентный журнал тревог из SQLite — история, переживающая сброс буфера"
                className="h-8 gap-1.5 px-2 text-[11px] text-cyan-400/90 hover:bg-cyan-500/10 hover:text-cyan-300"
              >
                <Database className="size-3.5" aria-hidden />
                Журнал
                {stats && (
                  <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                    {stats.alertsCount}
                  </span>
                )}
              </Button>
              <span
                role="separator"
                aria-orientation="vertical"
                className="h-5 w-px bg-slate-800"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSoundToggle}
                aria-pressed={soundOn}
                aria-label={soundOn ? "Выключить звук критических тревог" : "Включить звук критических тревог"}
                title={soundOn ? "Звук CRIT-тревог: вкл" : "Звук CRIT-тревог: выкл"}
                className={`h-8 w-8 p-0 ${
                  soundOn
                    ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                    : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                }`}
              >
                {soundOn ? (
                  <Volume2 className="size-4" aria-hidden />
                ) : (
                  <VolumeX className="size-4" aria-hidden />
                )}
              </Button>
              <span
                role="separator"
                aria-orientation="vertical"
                className="h-5 w-px bg-slate-800"
              />
              {muted ? (
                <BellOff className="size-4 text-slate-500" aria-hidden />
              ) : (
                <Bell className="size-4 text-emerald-400" aria-hidden />
              )}
              <Switch
                checked={muted}
                onCheckedChange={(v) => {
                  setMuted(v);
                  toast(v ? "Уведомления тревог выключены" : "Уведомления тревог включены", {
                    description: v
                      ? "Алерты по-прежнему фиксируются в журнале и БД."
                      : "Критические тревоги будут всплывать как уведомления.",
                    duration: 2500,
                  });
                }}
                aria-label="Выключить уведомления тревог"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {/* Распределение тревог по правилам */}
            {ruleDist.items.length > 0 && (
              <div className="border-b border-slate-800/60 px-4 py-2.5">
                <div
                  className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
                  role="img"
                  aria-label={`Распределение последних ${ruleDist.total} тревог по правилам: ${ruleDist.items
                    .map((it) => `${it.rule} — ${it.n}`)
                    .join(", ")}`}
                >
                  {ruleDist.items.map((it) => (
                    <div
                      key={it.rule}
                      className={`${it.cls} transition-[flex-basis] duration-700`}
                      style={{ flexBasis: `${Math.max(2, (it.n / ruleDist.total) * 100)}%` }}
                      title={`${it.rule}: ${it.n}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {ruleDist.items.map((it) => (
                    <span key={it.rule} className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className={`size-1.5 rounded-full ${it.cls}`} aria-hidden />
                      <span className="max-w-[150px] truncate">{it.rule}</span>
                      <span className="tabular-nums text-slate-500">{it.n}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto custom-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] text-slate-500">Ур.</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Правило</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Сообщение</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Клиент</TableHead>
                    <TableHead className="pr-4 text-[11px] text-slate-500">Время</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestAlerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-xs text-slate-500">
                        Тревог пока нет — трафик штатный
                      </TableCell>
                    </TableRow>
                  ) : (
                    latestAlerts.map((a) => (
                      <AlertRow key={a.id} alert={a} onOpenPacket={openPacketById} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Плавающая пилюля «новые пакеты» при паузе — портал в body, чтобы fixed
          не ломался transform-предком (framer-motion на вкладке) */}
      {paused &&
        newWhilePaused > 0 &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
            <div className="pointer-events-auto flex animate-in items-center gap-3 rounded-full border border-emerald-500/50 bg-slate-950/95 py-1.5 pl-4 pr-1.5 shadow-[0_10px_36px_-8px] shadow-emerald-500/45 fade-in slide-in-from-bottom-3 duration-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <span className="whitespace-nowrap text-xs text-slate-200">
                <span className="font-semibold text-emerald-300 tabular-nums">
                  {fmtCompact(newWhilePaused)}
                </span>{" "}
                новых пакетов в фоне
              </span>
              <Button
                size="sm"
                onClick={jumpToFresh}
                className="h-7 gap-1 rounded-full bg-emerald-500 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-400"
              >
                <ArrowDownToLine className="size-3.5" aria-hidden />
                Перейти к свежим
              </Button>
            </div>
          </div>,
          document.body
        )}

      <PacketDetailSheet
        packet={selected}
        pendingId={pendingId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        detail={detail}
        loading={detailLoading}
        pinned={selected ? pinnedIds.has(selected.id) : false}
        onTogglePin={togglePin}
      />

      <SessionInspector
        key={inspectorId ?? "none"}
        session={inspectorSession}
        open={inspectorSession !== null}
        onOpenChange={(v) => {
          if (!v) {
            setInspectorId(null);
            setInspectorRaw(null);
          }
        }}
        livePackets={packets}
        onFilterByClient={filterByClient}
      />

      <AlertsJournal
        open={journalOpen}
        onOpenChange={setJournalOpen}
        onOpenPacket={openPacketById}
      />
    </div>
  );
}

/** Итоги сценария: дельты счётчиков за окно генерации + сравнение срезов по протоколам.
 *  Скрытие — локальное состояние, сбрасывается сменой key. */
function ScenarioResults({ result }: { result: ScenarioResult }) {
  const [hidden, setHidden] = useState(false);
  // «Сравнить срезы»: perProtocol на старте → на финише; показываем только выросшие
  const protoDeltas = useMemo(
    () => Object.entries(result.perProtocol).sort((a, b) => b[1] - a[1]),
    [result.perProtocol]
  );
  const protoTotal = protoDeltas.reduce((acc, [, n]) => acc + n, 0);
  const pps = Math.round((result.packets / result.durationSec) * 10) / 10;
  // Экспорт итогов сценария: файл генерируется на клиенте — итоги живут только в UI
  const exportScenario = (format: "csv" | "jsonl") => {
    const stamp = fmtClock(result.startedAt).replace(/:/g, "");
    if (format === "csv") {
      // Excel-CSV («;», BOM) — как серверные csv-экспорты
      const rows: string[] = [
        ["Итоги сценария", result.label, `длительность ${result.durationSec} с`].join(";"),
        ["Пакетов", result.packets, "пак/с", pps].join(";"),
        ["Байт", result.bytes, "Тревог", result.alerts, "Невалидных", result.invalid].join(";"),
        "",
        "Протокол;Рост пакетов",
        ...protoDeltas.map(([proto, n]) => `${proto};+${n}`),
      ];
      downloadText(`\uFEFF${rows.join("\n")}\n`, `scenario_${result.id}_${stamp}.csv`, "text/csv;charset=utf-8");
    } else {
      const lines = [
        JSON.stringify({ type: "meta", id: result.id, label: result.label, startedAt: result.startedAt, durationSec: result.durationSec }),
        JSON.stringify({ type: "delta", packets: result.packets, pps, bytes: result.bytes, alerts: result.alerts, invalid: result.invalid }),
        ...protoDeltas.map(([proto, n]) => JSON.stringify({ type: "protocol", protocol: proto, delta: n })),
      ];
      downloadText(`${lines.join("\n")}\n`, `scenario_${result.id}_${stamp}.jsonl`, "application/jsonl");
    }
    toast.success(`Итоги сценария выгружены — ${format.toUpperCase()}`, {
      description: `${fmtCompact(result.packets)} пакетов за ${result.durationSec} с, протоколов: ${protoDeltas.length}.`,
      duration: 2500,
    });
  };
  if (hidden) return null;
  return (
    <div
      role="status"
      aria-label={`Итоги сценария ${result.label}`}
      className="mx-4 mb-4 animate-in rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-3 fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
          <ScenarioDone className="size-3.5 text-emerald-400" aria-hidden />
          Итоги сценария «{result.label}»
          <Badge
            variant="outline"
            className="border-slate-700 px-1.5 py-0 font-mono text-[10px] text-slate-400"
          >
            {result.durationSec}с
          </Badge>
        </span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => exportScenario("csv")}
            aria-label="Экспорт итогов сценария в CSV"
            title="Экспорт итогов сценария в CSV (Excel) — «;», дельты + протоколы"
            className="flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
          >
            <FileSpreadsheet className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => exportScenario("jsonl")}
            aria-label="Экспорт итогов сценария в JSONL"
            title="Экспорт итогов сценария в JSONL — meta, дельты, протоколы"
            className="flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
          >
            <FileJson className="size-3.5" aria-hidden />
          </button>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-700" />
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Скрыть итоги сценария"
            className="flex size-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
          <Activity className="size-3 text-emerald-400" aria-hidden />
          <span className="font-semibold text-emerald-300 tabular-nums">+{fmtCompact(result.packets)}</span> пакетов
          <span className="text-slate-500">· {pps}/с</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
          <HardDrive className="size-3 text-cyan-400" aria-hidden />
          <span className="font-semibold text-cyan-300 tabular-nums">+{fmtBytes(result.bytes)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
          <Siren className="size-3 text-red-400" aria-hidden />
          <span className="font-semibold text-red-300 tabular-nums">+{result.alerts}</span> тревог
        </span>
        {result.invalid > 0 && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <XCircle className="size-3 text-amber-400" aria-hidden />
            <span className="tabular-nums">{result.invalid}</span> невалидных
          </span>
        )}
      </div>
      {protoDeltas.length > 0 && (
        <div className="mt-2.5 border-t border-emerald-500/15 pt-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <GitCompareArrows className="size-3" aria-hidden />
            Сравнение срезов по протоколам — срез на старте → срез на финише
          </p>
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
            role="img"
            aria-label={`Дельты по протоколам за окно сценария: ${protoDeltas
              .map(([p, n]) => `${p} +${n}`)
              .join(", ")}`}
          >
            {protoDeltas.map(([proto, n]) => (
              <div
                key={proto}
                className={`${protocolDot(proto)} transition-[flex-basis] duration-700`}
                style={{ flexBasis: `${Math.max(2, (n / protoTotal) * 100)}%` }}
                title={`${proto}: +${n}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {protoDeltas.map(([proto, n]) => (
              <span
                key={proto}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] text-slate-300"
              >
                <span className={`size-1.5 rounded-full ${protocolDot(proto)}`} aria-hidden />
                {proto}
                <span className="font-semibold text-emerald-300 tabular-nums">+{fmtCompact(n)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert, onOpenPacket }: { alert: Alert; onOpenPacket: (id: number) => void }) {
  const clickable = alert.packetId != null;
  return (
    <TableRow
      onClick={clickable ? () => onOpenPacket(alert.packetId!) : undefined}
      title={clickable ? `Открыть пакет #${alert.packetId}` : undefined}
      className={`border-slate-800/70 ${clickable ? "cursor-pointer transition-colors hover:bg-amber-500/5" : ""}`}
    >
      <TableCell className="py-2 pl-4">
        <SeverityBadge severity={alert.severity} />
      </TableCell>
      <TableCell className="max-w-[140px] truncate py-2 text-xs font-medium text-slate-200">
        <span className="inline-flex items-center gap-1.5">
          {alert.rule}
          {clickable && <FileSearch className="size-3 shrink-0 text-slate-600" aria-hidden />}
        </span>
      </TableCell>
      <TableCell className="max-w-[280px] truncate py-2 text-xs text-slate-400">
        {alert.message}
      </TableCell>
      <TableCell className="max-w-[130px] truncate py-2 font-mono text-[11px] text-slate-400">
        {alert.client ?? "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap py-2 pr-4 font-mono text-[11px] text-slate-400 tabular-nums">
        {fmtTime(alert.createdAt)}
      </TableCell>
    </TableRow>
  );
}

export function SnifferTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-lg bg-slate-800/60" />
        ))}
      </div>
      <Skeleton className="h-[200px] rounded-lg bg-slate-800/60" />
      <Skeleton className="h-[120px] rounded-lg bg-slate-800/60" />
      <Skeleton className="h-[320px] rounded-lg bg-slate-800/60" />
    </div>
  );
}
