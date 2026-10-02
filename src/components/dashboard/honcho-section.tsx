"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Boxes,
  BrainCircuit,
  Check,
  Cloud,
  Copy,
  ExternalLink,
  Eye,
  KeyRound,
  PenLine,
  Repeat,
  Save,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type {
  HonchoServerInfo,
  HonchoToolGroup,
} from "@/lib/sniffer/integration-data";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Вспомогательное: буфер обмена с легаси-фолбэком
// ---------------------------------------------------------------------------

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // нет Clipboard API или отказ в разрешении — пробуем легаси-путь
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 w-8 shrink-0 p-0 text-slate-400 hover:bg-slate-800 hover:text-emerald-300",
        className,
      )}
      aria-label="Копировать в буфер обмена"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          toast.success("Скопировано в буфер обмена");
          window.setTimeout(() => setCopied(false), 1500);
        } else {
          toast.error("Не удалось скопировать");
        }
      }}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Вспомогательное: бейджи, плитки концептов, чипы групп
// ---------------------------------------------------------------------------

function MonoBadge({
  children,
  title,
  accent,
}: {
  children: React.ReactNode;
  title?: string;
  accent?: "emerald" | "teal" | "amber";
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px]",
        accent === "emerald"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : accent === "teal"
            ? "border-teal-500/40 bg-teal-500/10 text-teal-300"
            : accent === "amber"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-slate-700 bg-slate-950 text-slate-300",
      )}
    >
      {children}
    </span>
  );
}

function ConceptTile({ term, desc }: { term: string; desc: string }) {
  return (
    <div
      title={desc}
      className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2 transition-colors hover:border-emerald-500/40"
    >
      <p className="truncate font-mono text-xs text-emerald-300">{term}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{desc}</p>
    </div>
  );
}

function GroupChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
        active
          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
          : "border-slate-700 bg-slate-950 text-slate-400 hover:border-emerald-500/40 hover:text-slate-200",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1 font-mono text-[9px] leading-4",
          active
            ? "bg-emerald-500/25 text-emerald-200"
            : "bg-slate-800 text-slate-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Служебные словари
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<HonchoToolGroup, string> = {
  recall: "Recall — чтение",
  store: "Запись",
  meta: "Служебные",
};

const MEMORY_CYCLE = [
  { id: "recall", label: "Recall", role: "дешёвые чтения памяти" },
  { id: "respond", label: "Respond", role: "ответ с контекстом пира" },
  { id: "record", label: "Record", role: "запись диалога в сессию" },
];

const MODE_META = {
  recall: {
    icon: Eye,
    border: "border-emerald-500/30 bg-emerald-500/[0.06]",
    iconColor: "text-emerald-400",
    titleColor: "text-emerald-300",
    title: "Recall — чтение памяти",
  },
  memory_store: {
    icon: Save,
    border: "border-teal-500/30 bg-teal-500/[0.06]",
    iconColor: "text-teal-400",
    titleColor: "text-teal-300",
    title: "Memory store — запись диалогов",
  },
} as const;

// ---------------------------------------------------------------------------
// Honcho-секция: карточка + концепты + инструменты + цикл + env + связь с OAC
// ---------------------------------------------------------------------------

interface HonchoSectionProps {
  honcho: HonchoServerInfo;
}

export function HonchoSection({ honcho }: HonchoSectionProps) {
  const [group, setGroup] = useState<"all" | HonchoToolGroup>("all");

  const countByGroup = useMemo(() => {
    const map = new Map<HonchoToolGroup, number>();
    for (const t of honcho.tools) map.set(t.group, (map.get(t.group) ?? 0) + 1);
    return map;
  }, [honcho.tools]);

  const filteredTools = useMemo(
    () =>
      group === "all"
        ? honcho.tools
        : honcho.tools.filter((t) => t.group === group),
    [honcho.tools, group],
  );

  return (
    <motion.section
      aria-label="Honcho — межсессионная память агентов"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className="border-emerald-500/25 bg-slate-900/60">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base text-slate-100">
            <BrainCircuit className="size-4 text-emerald-400" aria-hidden />
            <span>{honcho.name}</span>
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-300"
            >
              {honcho.vendor}
            </Badge>
            <a
              href={honcho.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[28px] items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              aria-label="Открыть документацию Honcho (honcho.dev)"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              honcho.dev
            </a>
            <a
              href={honcho.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[28px] items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              aria-label="Открыть репозиторий plastic-labs/honcho на GitHub"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              GitHub
            </a>
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed text-slate-400">
            Open-source AI-память для агентов от Plastic Labs (SOTA на LongMem,
            AGPL-3.0): облако api.honcho.dev или self-hosted. В пакете — stdio
            MCP-прокси src/mcp_servers/honcho к официальному Honcho MCP и агент
            honcho_memory с циклом recall → respond → record. Инструментов
            прокси: {honcho.tools.length}.
          </CardDescription>
          <div className="mt-1 flex flex-wrap items-center gap-1.5" role="list" aria-label="Параметры Honcho">
            <MonoBadge accent="emerald" title="Официальный hosted MCP-сервер">
              <Cloud className="size-3" aria-hidden />
              hosted MCP · {honcho.hostedMcpUrl}
            </MonoBadge>
            <MonoBadge accent="teal" title="Транспорт Honcho MCP">
              Streamable HTTP
            </MonoBadge>
            <MonoBadge title="Авторизация облака — ключ hch-...">
              <KeyRound className="size-3" aria-hidden />
              Bearer hch-...
            </MonoBadge>
            <MonoBadge title="Лицензия">{honcho.license}</MonoBadge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 pt-2">
          {/* Концепты памяти */}
          <div className="min-w-0">
            <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Boxes className="size-3.5" aria-hidden />
              Концепты памяти ({honcho.concepts.length})
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {honcho.concepts.map((c) => (
                <ConceptTile key={c.term} term={c.term} desc={c.desc} />
              ))}
            </div>
          </div>

          <Separator className="bg-slate-800" />

          {/* Инструменты с фильтром по группам */}
          <div className="min-w-0">
            <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Wrench className="size-3.5" aria-hidden />
              Инструменты прокси ({filteredTools.length}
              {" из "}
              {honcho.tools.length})
              <span className="font-normal normal-case tracking-normal text-slate-600">
                · ⚡ reasoned-ответ 5+ сек · «пишет» — изменяет память
              </span>
            </p>
            <div
              role="toolbar"
              aria-label="Фильтр инструментов Honcho по группе"
              className="mb-2 flex flex-wrap gap-1.5"
            >
              <GroupChip
                active={group === "all"}
                onClick={() => setGroup("all")}
                label="все"
                count={honcho.tools.length}
              />
              {(Object.keys(GROUP_LABELS) as HonchoToolGroup[]).map((g) => (
                <GroupChip
                  key={g}
                  active={group === g}
                  onClick={() => setGroup(group === g ? "all" : g)}
                  label={GROUP_LABELS[g]}
                  count={countByGroup.get(g) ?? 0}
                />
              ))}
            </div>
            <div className="max-h-96 overflow-y-auto custom-scroll rounded-md border border-slate-800">
              {/* Десктоп/планшет: таблица с зеброй и hover */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-slate-900">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="pl-3 text-[11px] text-slate-500">
                        Инструмент
                      </TableHead>
                      <TableHead className="text-[11px] text-slate-500">
                        Группа
                      </TableHead>
                      <TableHead className="text-[11px] text-slate-500">
                        Назначение
                      </TableHead>
                      <TableHead className="pr-3 text-[11px] text-slate-500">
                        Пометки
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTools.map((t, i) => (
                      <TableRow
                        key={t.name}
                        className={cn(
                          "border-slate-800/70 hover:bg-emerald-500/[0.08]",
                          i % 2 === 1 && "bg-slate-950/40",
                        )}
                      >
                        <TableCell className="py-2 pl-3 font-mono text-xs text-emerald-300">
                          {t.name}
                        </TableCell>
                        <TableCell className="whitespace-normal py-2 text-[11px] leading-snug text-slate-400">
                          {GROUP_LABELS[t.group]}
                        </TableCell>
                        <TableCell
                          className="min-w-0 whitespace-normal py-2 pr-3 text-xs leading-snug text-slate-300 [overflow-wrap:anywhere]"
                          title={t.desc}
                        >
                          {t.desc}
                        </TableCell>
                        <TableCell className="py-2 pr-3">
                          <span className="flex flex-wrap items-center gap-1">
                            {t.slow && (
                              <Badge
                                variant="outline"
                                className="border-amber-500/50 bg-amber-500/10 px-1.5 py-0 font-mono text-[10px] text-amber-400"
                                title="Reasoned-ответ — заметно дольше дешёвых чтений (5+ сек)"
                              >
                                <Zap className="size-3" aria-hidden />
                                медленно
                              </Badge>
                            )}
                            {t.mutating && (
                              <Badge
                                variant="outline"
                                className="border-amber-500/50 bg-amber-500/10 px-1.5 py-0 font-mono text-[10px] text-amber-400"
                                title="Изменяет состояние памяти (запись)"
                              >
                                <PenLine className="size-3" aria-hidden />
                                пишет
                              </Badge>
                            )}
                            {!t.slow && !t.mutating && (
                              <span className="text-slate-600" aria-hidden>
                                —
                              </span>
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Мобильный (390px): карточная раскладка вместо таблицы */}
              <ul className="space-y-2 p-2 sm:hidden" role="list">
                {filteredTools.map((t) => (
                  <li
                    key={t.name}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-emerald-300">
                        {t.name}
                      </span>
                      {t.slow && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 bg-amber-500/10 px-1.5 py-0 font-mono text-[10px] text-amber-400"
                        >
                          <Zap className="size-3" aria-hidden />
                          медленно
                        </Badge>
                      )}
                      {t.mutating && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 bg-amber-500/10 px-1.5 py-0 font-mono text-[10px] text-amber-400"
                        >
                          <PenLine className="size-3" aria-hidden />
                          пишет
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                      {GROUP_LABELS[t.group]}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-300">
                      {t.desc}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="bg-slate-800" />

          {/* Цикл памяти + режимы */}
          <div className="min-w-0 space-y-3">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <Repeat className="size-3.5" aria-hidden />
                Цикл памяти агента
              </p>
              <div className="flex flex-wrap items-stretch gap-1.5">
                {MEMORY_CYCLE.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-1.5">
                    <div
                      className={`flex min-w-0 flex-col rounded-lg border px-3 py-2 text-center ${
                        step.id === "recall"
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : step.id === "record"
                            ? "border-teal-500/50 bg-teal-500/10"
                            : "border-slate-700 bg-slate-900"
                      }`}
                    >
                      <span
                        className={`text-xs font-medium ${
                          step.id === "recall"
                            ? "text-emerald-300"
                            : step.id === "record"
                              ? "text-teal-300"
                              : "text-slate-200"
                        }`}
                      >
                        {i + 1}. {step.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {step.role}
                      </span>
                    </div>
                    {i < MEMORY_CYCLE.length - 1 && (
                      <span aria-hidden className="shrink-0 text-slate-500">
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {honcho.modes.map((m) => {
                const meta = MODE_META[m.mode];
                const Icon = meta.icon;
                return (
                  <div
                    key={m.mode}
                    className={cn("min-w-0 rounded-lg border p-3", meta.border)}
                  >
                    <p
                      className={cn(
                        "mb-1 flex items-center gap-1.5 text-xs font-semibold",
                        meta.titleColor,
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", meta.iconColor)} aria-hidden />
                      {meta.title}
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      {m.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Best practices */}
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Best practices из официальной доки
            </p>
            <ul className="space-y-1.5" role="list">
              {honcho.bestPractices.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-300">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-hidden />
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <Separator className="bg-slate-800" />

          {/* env-переменные + mcp.json */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <KeyRound className="size-3.5" aria-hidden />
                Переменные окружения прокси ({honcho.envVars.length})
              </p>
              <div className="overflow-y-auto custom-scroll rounded-md border border-slate-800">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-slate-900">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="pl-3 text-[11px] text-slate-500">
                        Переменная
                      </TableHead>
                      <TableHead className="pr-3 text-[11px] text-slate-500">
                        Назначение
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {honcho.envVars.map((v, i) => (
                      <TableRow
                        key={v.key}
                        className={cn(
                          "border-slate-800/70 hover:bg-slate-800/40",
                          i % 2 === 1 && "bg-slate-950/40",
                        )}
                      >
                        <TableCell className="whitespace-nowrap py-2 pl-3 font-mono text-[11px] text-emerald-300/90">
                          <span
                            title={v.key}
                            className="block max-w-[170px] truncate"
                          >
                            {v.key}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-normal pr-3 text-[11px] leading-snug text-slate-300 [overflow-wrap:anywhere]">
                          {v.desc}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Ключ hch-... живёт только в env серверного прокси — на клиент не
                передаётся.
              </p>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  mcp.json — прямое подключение honcho
                </p>
                <CopyButton text={honcho.mcpJson} />
              </div>
              <pre
                aria-label="Содержимое mcp.json для Honcho"
                className="overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300 custom-scroll"
              >
                {honcho.mcpJson}
              </pre>
            </div>
          </div>

          {/* Связь с OAC */}
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/[0.06] p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-300">
              <Workflow className="size-4 shrink-0 text-violet-400" aria-hidden />
              Связь с OAC — OpenAgents Control
            </p>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {honcho.oacTieIn}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}
