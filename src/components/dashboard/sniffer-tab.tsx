"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "@/hooks/use-sniffer-stream";
import { PpsChart } from "@/components/dashboard/pps-chart";
import { ProtocolBreakdown } from "@/components/dashboard/protocol-breakdown";
import { fmtBytes, fmtClock, fmtTime, fmtCompact, protocolColor } from "@/lib/format";

const MAX_TABLE_ROWS = 200;

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
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
}) {
  return (
    <Card className={`border-slate-800 bg-slate-900/60 ${alert ? "border-red-500/40" : ""}`}>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg border ${
            alert ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"
          }`}
        >
          <Icon className={`size-5 ${alert ? "text-red-400" : "text-emerald-400"}`} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold leading-tight text-slate-50">{value}</div>
          <div className="truncate text-xs text-slate-400">{label}</div>
          {sub && <div className="truncate text-[10px] text-slate-500">{sub}</div>}
        </div>
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

function PacketDetailSheet({
  packet,
  open,
  onOpenChange,
  detail,
  loading,
}: {
  packet: Packet | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: { hexdump: string } | null;
  loading: boolean;
}) {
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto border-slate-800 bg-slate-950 p-4 sm:max-w-lg custom-scroll"
      >
        <SheetHeader className="p-0 pb-2 text-left">
          <SheetTitle className="text-base text-slate-100">
            Пакет {packet ? `#${packet.id}` : ""}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-400">
            {packet ? packet.summary : ""}
          </SheetDescription>
        </SheetHeader>
        {packet && (
          <div className="mt-2 space-y-3">
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
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Hexdump {loading ? "" : detail ? "(до 2 КБ)" : ""}
              </p>
              {loading ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Загрузка дампа…
                </div>
              ) : (
                <pre className="max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] leading-relaxed text-emerald-300 custom-scroll">
                  {detail?.hexdump ?? packet.hexPreview}
                </pre>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function SnifferTab({ live }: SnifferTabProps) {
  const { connected, packets, sessions, alerts, stats, series, scenario } = live;

  // Фильтры
  const [search, setSearch] = useState("");
  const [protocol, setProtocol] = useState("all");
  const [direction, setDirection] = useState("all");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [paused, setPaused] = useState(false);
  const [frozenPackets, setFrozenPackets] = useState<Packet[] | null>(null);
  const [muted, setMuted] = useState(false);
  const [selected, setSelected] = useState<Packet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detail, setDetail] = useState<{ hexdump: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scenarioBusy, setScenarioBusy] = useState<ScenarioId | "stop" | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const alertToastSeenRef = useRef<string | null>(null);

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

  // Тикаем часы для обратного отсчёта сценария
  useEffect(() => {
    if (!scenario) return;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [scenario]);

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
      setPaused(true);
      toast.info("Таблица остановлена", {
        description: "Приём пакетов продолжается в фоне (буфер 3000).",
        duration: 2500,
      });
    } else {
      setFrozenPackets(null);
      setPaused(false);
    }
  };

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

  const display = filtered.slice(0, MAX_TABLE_ROWS);
  const latestAlerts = alerts.slice(0, 50);
  const sessionList = sessions.slice(0, 12);

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
    <div className="space-y-4">
      {/* Статбар */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Пакеты всего"
          value={stats ? fmtCompact(stats.totalPackets) : "—"}
          sub={stats ? `${stats.lastPps} п/с · ${stats.invalidPackets} невалидных` : undefined}
        />
        <StatCard
          icon={HardDrive}
          label="Байт перехвачено"
          value={stats ? fmtBytes(stats.totalBytes) : "—"}
          sub={stats ? `${fmtCompact(stats.lastBps)} Б/с` : undefined}
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
      </Card>

      {/* График */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
            <span>Пакетов в секунду (pps)</span>
            {stats && (
              <Badge variant="outline" className="border-slate-700 font-mono text-[10px] text-slate-400">
                uptime {Math.floor(stats.uptimeSec / 60)}м {stats.uptimeSec % 60}с
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <PpsChart series={series} />
        </CardContent>
      </Card>

      {/* Распределение протоколов + топы */}
      {stats && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-sm text-slate-200">Аналитика трафика</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ProtocolBreakdown
              perProtocol={stats.perProtocol}
              totalPackets={stats.totalPackets}
              topMethods={stats.topMethods}
              topClients={stats.topClients}
            />
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

      {/* Таблица пакетов */}
      <Card className="border-slate-800 bg-slate-900/60">
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
            {filtered.length > MAX_TABLE_ROWS && (
              <span className="text-[11px] font-normal text-slate-500">
                показаны последние {MAX_TABLE_ROWS} из {fmtCompact(filtered.length)}
              </span>
            )}
          </CardTitle>
          <DropdownMenu>
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
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-slate-500">
                как в реальном сниффере
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a href="/api/sniffer/export?format=jsonl" download className="cursor-pointer">
                  <FileJson className="mr-2 size-3.5 text-emerald-400" aria-hidden />
                  traffic.jsonl — пакеты
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/sniffer/export?format=csv" download className="cursor-pointer">
                  <FileSpreadsheet className="mr-2 size-3.5 text-emerald-400" aria-hidden />
                  отчёт CSV — сводка + пакеты
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/sniffer/export?format=sessions" download className="cursor-pointer">
                  <FileSpreadsheet className="mr-2 size-3.5 text-emerald-400" aria-hidden />
                  sessions.csv — сессии
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/sniffer/export?format=alerts" download className="cursor-pointer">
                  <FileJson className="mr-2 size-3.5 text-amber-400" aria-hidden />
                  alerts.jsonl — журнал тревог
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <div className="max-h-[60vh] overflow-y-auto custom-scroll">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-900 shadow-[0_1px_0_0_theme(colors.slate.800)]">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="pl-4 font-mono text-[11px] text-slate-500">Время</TableHead>
                  <TableHead className="text-[11px] text-slate-500">↕</TableHead>
                  <TableHead className="text-[11px] text-slate-500">Канал</TableHead>
                  <TableHead className="text-[11px] text-slate-500">Протокол</TableHead>
                  <TableHead className="text-[11px] text-slate-500">Тип / метод</TableHead>
                  <TableHead className="text-right text-[11px] text-slate-500">Размер</TableHead>
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
                        idx % 2 === 1 ? "bg-slate-950/40" : ""
                      }`}
                    >
                      <TableCell className="whitespace-nowrap py-2 pl-4 font-mono text-[11px] text-slate-400">
                        {fmtTime(p.ts)}
                      </TableCell>
                      <TableCell className="py-2">
                        <DirBadge dir={p.direction} />
                      </TableCell>
                      <TableCell className="max-w-[130px] truncate py-2 text-xs text-slate-300">
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
                        {p.methodType ?? p.method ?? p.msgType ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 text-right font-mono text-xs text-slate-300">
                        {fmtBytes(p.size)}
                      </TableCell>
                      <TableCell className="py-2">
                        {p.valid ? (
                          <CheckCircle2 className="size-4 text-emerald-500" aria-label="валидный" />
                        ) : (
                          <XCircle className="size-4 text-red-500" aria-label="невалидный" />
                        )}
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate py-2 pr-4 text-xs text-slate-400">
                        {p.summary}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Сессии + Тревоги */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-slate-200">Сессии</CardTitle>
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
                      <TableRow key={s.id} className="border-slate-800/70">
                        <TableCell className="py-2 pl-4 font-mono text-xs text-slate-200">{s.client}</TableCell>
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
            <CardTitle className="text-sm text-slate-200">Тревоги</CardTitle>
            <div className="flex items-center gap-2">
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
                    latestAlerts.map((a) => <AlertRow key={a.id} alert={a} />)
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <PacketDetailSheet
        packet={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        detail={detail}
        loading={detailLoading}
      />
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <TableRow className="border-slate-800/70">
      <TableCell className="py-2 pl-4">
        <SeverityBadge severity={alert.severity} />
      </TableCell>
      <TableCell className="max-w-[140px] truncate py-2 text-xs font-medium text-slate-200">
        {alert.rule}
      </TableCell>
      <TableCell className="max-w-[280px] truncate py-2 text-xs text-slate-400">
        {alert.message}
      </TableCell>
      <TableCell className="max-w-[130px] truncate py-2 font-mono text-[11px] text-slate-400">
        {alert.client ?? "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap py-2 pr-4 font-mono text-[11px] text-slate-400">
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
