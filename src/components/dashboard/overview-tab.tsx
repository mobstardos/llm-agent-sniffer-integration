"use client";

import {
  Archive,
  Boxes,
  ExternalLink,
  GitBranch,
  KeyRound,
  ServerCog,
  Wrench,
  Database,
  RadioTower,
  Cpu,
  FileDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { IntegrationPayload } from "@/lib/sniffer/integration-data";
import { fmtCompact } from "@/lib/format";

interface OverviewTabProps {
  data: IntegrationPayload | null;
}

const KPI_ICONS = [Archive, GitBranch, Wrench, KeyRound];

function KpiCard({
  label,
  value,
  icon: Icon,
  index,
}: {
  label: string;
  value: string;
  icon: (typeof KPI_ICONS)[number];
  index: number;
}) {
  return (
    <Card
      className="border-slate-800 bg-slate-900/60"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
          <Icon className="size-5 text-emerald-400" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-xl font-bold leading-tight text-slate-50">{value}</div>
          <div className="truncate text-xs text-slate-400">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FlowNode({
  title,
  subtitle,
  icon: Icon,
  accent = "slate",
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "slate" | "emerald" | "cyan" | "violet";
}) {
  const accents: Record<string, string> = {
    slate: "border-slate-700 bg-slate-900 text-slate-200",
    emerald: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
    cyan: "border-cyan-500/50 bg-cyan-500/10 text-cyan-300",
    violet: "border-violet-500/50 bg-violet-500/10 text-violet-300",
  };
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-center ${accents[accent]}`}
    >
      {Icon && <Icon className="mb-0.5 size-4 shrink-0 opacity-80" aria-hidden />}
      <span className="text-xs font-medium leading-tight sm:text-sm">{title}</span>
      {subtitle && (
        <span className="font-mono text-[10px] leading-tight text-slate-400">{subtitle}</span>
      )}
    </div>
  );
}

function FlowArrow() {
  return <span aria-hidden className="shrink-0 select-none text-slate-500">→</span>;
}

export function OverviewTab({ data }: OverviewTabProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-lg bg-slate-800/60" />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg bg-slate-800/60" />
          ))}
        </div>
      </div>
    );
  }

  const llmAgent = data.archives[0];
  const sniffer = data.snifferArchive;

  return (
    <div className="space-y-6">
      {/* KPI */}
      <section aria-label="Ключевые показатели">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard index={0} icon={Archive} label="архива в анализе" value="3" />
          <KpiCard index={1} icon={GitBranch} label="репозитория подключено" value="2" />
          <KpiCard index={2} icon={Wrench} label="MCP-инструментов сниффера" value="15" />
          <KpiCard index={3} icon={KeyRound} label="новых зависимостей" value="0" />
        </div>
      </section>

      {/* Архивы */}
      <section aria-label="Архивы">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Архивы
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                <Boxes className="size-4 text-emerald-400" aria-hidden />
                {llmAgent.title}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {llmAgent.kind} · ~{fmtCompact(llmAgent.filesCount)} файлов
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <ul className="list-inside list-disc space-y-1.5 text-xs leading-relaxed text-slate-300">
                {llmAgent.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                <RadioTower className="size-4 text-emerald-400" aria-hidden />
                {sniffer.title}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {sniffer.kind} · {sniffer.filesCount} файлов
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="mb-2 flex flex-wrap gap-1">
                {sniffer.parsers.map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 font-mono text-[10px] text-emerald-300"
                  >
                    {p}
                  </Badge>
                ))}
              </div>
              <ul className="list-inside list-disc space-y-1.5 text-xs leading-relaxed text-slate-300">
                {sniffer.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                <FileDown className="size-4 text-emerald-400" aria-hidden />
                {data.fullPackage.title}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {data.fullPackage.note}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-4 pt-2 text-xs text-slate-300">
              <p>
                Готовая exe-сборка сниффера для Windows (PyInstaller, launcher.c,
                version.rc): запускается на кассовом сервере без Python.
              </p>
              <Separator className="bg-slate-800" />
              <p>
                В zip-пакет интеграции входит исходная сборка <span className="font-mono text-emerald-300">sources/</span>{" "}
                — совместима с вендорингом в LLM-Agent.
              </p>
              <Separator className="bg-slate-800" />
              <p className="text-slate-400">
                Вкладка «Интеграция» содержит ссылки на скачивание пакета и примечаний.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Репозитории */}
      <section aria-label="Репозитории">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Репозитории
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {data.repos.map((repo) => (
            <Card key={repo.id} className="border-slate-800 bg-slate-900/60">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                  <GitBranch className="size-4 text-emerald-400" aria-hidden />
                  <span className="truncate font-mono">{repo.url.replace("https://", "")}</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5 text-xs text-slate-400">
                  автор: <span className="font-mono text-slate-300">{repo.author}</span>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[24px] items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline"
                    aria-label={`Открыть репозиторий ${repo.author} на GitHub`}
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    GitHub
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <p className="text-xs leading-relaxed text-slate-300">{repo.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Архитектура */}
      <section aria-label="Схема архитектуры">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Архитектура интеграции
        </h2>
        <Card className="border-slate-800 bg-slate-900/60">
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Трафик АЗС через сниффер-прокси
              </p>
              <div className="flex flex-wrap items-stretch gap-1.5 sm:gap-2">
                <FlowNode title="АЗС / клиенты" subtitle="10.8.0.x · 172.16.4.x" icon={Database} />
                <FlowArrow />
                <FlowNode
                  title="Сниффер-прокси"
                  subtitle=":9000 → :9001 · :9010 → :9011"
                  icon={RadioTower}
                  accent="emerald"
                />
                <FlowArrow />
                <FlowNode
                  title="RemoteServer / Thrift"
                  subtitle="ядро АЗС · thrift-методы"
                  icon={ServerCog}
                />
              </div>
            </div>
            <Separator className="bg-slate-800" />
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                LLM-Agent поверх HTTP API сниффера (:9500)
              </p>
              <div className="flex flex-wrap items-stretch gap-1.5 sm:gap-2">
                <FlowNode title="Агент sniffer" subtitle="intent-роутинг" icon={Cpu} accent="cyan" />
                <FlowArrow />
                <FlowNode
                  title="Оркестратор"
                  subtitle="LLM-роутер · DAG планов"
                  icon={Cpu}
                  accent="cyan"
                />
                <FlowArrow />
                <FlowNode
                  title="MCP sniffer (stdio)"
                  subtitle="15 tools"
                  icon={Wrench}
                  accent="violet"
                />
                <FlowArrow />
                <FlowNode title="HTTP API" subtitle=":9500 /api/*" icon={ServerCog} accent="emerald" />
                <FlowArrow />
                <FlowNode title="Engine" subtitle="фреймеры · detection" icon={Cpu} />
                <FlowArrow />
                <FlowNode
                  title="Экспорт"
                  subtitle="JSONL · SQLite · PCAP · CSV"
                  icon={FileDown}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
