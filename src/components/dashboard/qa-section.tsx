"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CameraOff,
  Check,
  Container,
  Copy,
  ExternalLink,
  FileJson,
  FlaskConical,
  ListOrdered,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Unplug,
  Wrench,
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
  QaSafetyLevel,
  QaServerInfo,
  QaToolGroup,
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
// Вспомогательное: бейджи и плитки фактов
// ---------------------------------------------------------------------------

function MonoBadge({
  children,
  title,
  accent,
}: {
  children: React.ReactNode;
  title?: string;
  accent?: "violet" | "emerald";
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px]",
        accent === "violet"
          ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
          : accent === "emerald"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : "border-slate-700 bg-slate-950 text-slate-300",
      )}
    >
      {children}
    </span>
  );
}

function FactTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className="mt-0.5 truncate font-mono text-xs text-slate-200"
        title={value}
      >
        {value}
      </p>
      {note && (
        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{note}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Вспомогательное: чипы групп инструментов
// ---------------------------------------------------------------------------

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
        "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
        active
          ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
          : "border-slate-700 bg-slate-950 text-slate-400 hover:border-violet-500/40 hover:text-slate-200",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1 font-mono text-[9px] leading-4",
          active
            ? "bg-violet-500/25 text-violet-200"
            : "bg-slate-800 text-slate-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Стили callout'ов безопасности
// ---------------------------------------------------------------------------

const SAFETY_STYLES: Record<
  QaSafetyLevel,
  {
    border: string;
    bg: string;
    iconColor: string;
    titleColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  amber: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/[0.07]",
    iconColor: "text-amber-400",
    titleColor: "text-amber-300",
    icon: ShieldAlert,
  },
  red: {
    border: "border-red-500/40",
    bg: "bg-red-500/[0.07]",
    iconColor: "text-red-400",
    titleColor: "text-red-300",
    icon: Unplug,
  },
  slate: {
    border: "border-slate-600/60",
    bg: "bg-slate-800/40",
    iconColor: "text-slate-400",
    titleColor: "text-slate-300",
    icon: CameraOff,
  },
};

// ---------------------------------------------------------------------------
// QA-секция: карточка + таблица инструментов + первая сессия + env + mcp.json
// ---------------------------------------------------------------------------

interface QaSectionProps {
  qa: QaServerInfo;
}

export function QaSection({ qa }: QaSectionProps) {
  const [group, setGroup] = useState<"all" | QaToolGroup>("all");

  const countByGroup = useMemo(() => {
    const map = new Map<QaToolGroup, number>();
    for (const t of qa.tools) map.set(t.group, (map.get(t.group) ?? 0) + 1);
    return map;
  }, [qa.tools]);

  const filteredTools = useMemo(
    () => (group === "all" ? qa.tools : qa.tools.filter((t) => t.group === group)),
    [qa.tools, group],
  );

  return (
    <motion.section
      aria-label="MCP QA — тестирование 1С"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className="border-violet-500/25 bg-slate-900/60">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base text-slate-100">
            <FlaskConical className="size-4 text-violet-400" aria-hidden />
            <span>{qa.name}</span>
            <Badge
              variant="outline"
              className="border-violet-500/40 bg-violet-500/10 text-[10px] text-violet-300"
            >
              автор: {qa.author}
            </Badge>
            <a
              href={qa.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[28px] items-center gap-1 text-xs text-violet-400 hover:text-violet-300 hover:underline"
              aria-label="Открыть документацию MCP QA (docs.onerpa.ru)"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              документация
            </a>
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed text-slate-400">
            MCP-сервер тестирования 1С от автора comol (mcp_designer_tools): ИИ
            управляет тестовой базой через логическую модель форм — читает окна и
            поля, находит элементы, вводит значения, нажимает кнопки и проверяет
            результат. Всего {qa.toolsTotal} инструментов; в прокси пакета
            курируется {qa.tools.length}.
          </CardDescription>
          <div className="mt-1 flex flex-wrap items-center gap-1.5" role="list" aria-label="Параметры сервера">
            <MonoBadge title={qa.image} accent="violet">
              <Container className="size-3" aria-hidden />
              {qa.image}
            </MonoBadge>
            <MonoBadge accent="emerald" title="Версия образа">
              v{qa.version}
            </MonoBadge>
            <MonoBadge title="Порт HTTP-сервера">:{qa.port}</MonoBadge>
            <MonoBadge title="MCP-эндпоинт">{qa.mcpUrl}</MonoBadge>
            <MonoBadge title="Liveness-проба">GET {qa.healthz}</MonoBadge>
            <MonoBadge accent="violet" title="Имя подключения в mcp.json">
              {qa.connectionName}
            </MonoBadge>
            <MonoBadge title="Транспорт">{qa.transport}</MonoBadge>
            <MonoBadge title="Платформа образа">{qa.platform}</MonoBadge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 pt-2">
          {/* Факты об исполнении */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <FactTile
              label="Исполнитель"
              value={qa.executor}
              note="контейнер сам работает менеджером тестирования — платформы 1С в образе нет"
            />
            <FactTile
              label="Сеанс"
              value={qa.sessionMode}
              note="подключение к уже запущенному тест-клиенту 1cv8c /TestClient"
            />
            <FactTile
              label="Инструменты"
              value={`${qa.toolsTotal} всего · ${qa.tools.length} курируемых`}
              note="stdio-прокси в пакете экспонирует курируемый набор qa_*/ui_*"
            />
          </div>

          <Separator className="bg-slate-800" />

          {/* Таблица инструментов с фильтром по группам */}
          <div className="min-w-0">
            <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Wrench className="size-3.5" aria-hidden />
              Курируемые инструменты ({filteredTools.length}
              {" из "}
              {qa.tools.length})
              <span className="font-normal normal-case tracking-normal text-slate-600">
                · «hook» — нужен хук-расширение прокси
              </span>
            </p>
            <div
              role="toolbar"
              aria-label="Фильтр инструментов по группе"
              className="mb-2 flex flex-wrap gap-1.5"
            >
              <GroupChip
                active={group === "all"}
                onClick={() => setGroup("all")}
                label="все"
                count={qa.tools.length}
              />
              {qa.toolGroups.map((g) => (
                <GroupChip
                  key={g}
                  active={group === g}
                  onClick={() => setGroup(group === g ? "all" : g)}
                  label={g}
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
                        Hook
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTools.map((t, i) => (
                      <TableRow
                        key={t.name}
                        className={cn(
                          "border-slate-800/70 hover:bg-violet-500/[0.08]",
                          i % 2 === 1 && "bg-slate-950/40",
                        )}
                      >
                        <TableCell className="py-2 pl-3 font-mono text-xs text-violet-300">
                          {t.name}
                        </TableCell>
                        <TableCell className="whitespace-normal py-2 text-[11px] leading-snug text-slate-400">
                          {t.group}
                        </TableCell>
                        <TableCell
                          className="min-w-0 whitespace-normal py-2 pr-3 text-xs leading-snug text-slate-300 [overflow-wrap:anywhere]"
                          title={t.desc}
                        >
                          {t.desc}
                        </TableCell>
                        <TableCell className="py-2 pr-3">
                          {t.needsHook ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 bg-amber-500/10 px-1.5 py-0 font-mono text-[10px] text-amber-400"
                            >
                              hook
                            </Badge>
                          ) : (
                            <span className="text-slate-600" aria-hidden>
                              —
                            </span>
                          )}
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
                      <span className="font-mono text-xs text-violet-300">
                        {t.name}
                      </span>
                      {t.needsHook && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 bg-amber-500/10 px-1.5 py-0 font-mono text-[10px] text-amber-400"
                        >
                          hook
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                      {t.group}
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

          {/* Первая сессия */}
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <ListOrdered className="size-3.5" aria-hidden />
              Первая сессия — от запуска тест-клиента до qa_stop
            </p>
            <ol className="space-y-2.5">
              {qa.firstSession.map((step, i) => (
                <li key={step.title} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-violet-500/50 bg-violet-500/10 font-mono text-[10px] text-violet-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-200">
                      {step.title}
                    </p>
                    {step.note && (
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                        {step.note}
                      </p>
                    )}
                    {step.command && (
                      <div className="mt-1 flex items-stretch gap-1 rounded-md border border-slate-800 bg-slate-950 pr-1">
                        <code className="min-w-0 flex-1 break-all px-2 py-1.5 font-mono text-[11px] leading-relaxed text-emerald-300">
                          {step.command}
                        </code>
                        <CopyButton
                          text={step.command}
                          className="mt-0.5 h-8 w-8 self-center"
                        />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Callout'ы безопасности */}
          <div className="grid gap-2 md:grid-cols-3">
            {qa.safetyRules.map((rule) => {
              const s = SAFETY_STYLES[rule.level];
              const Icon = s.icon;
              return (
                <div
                  key={rule.title}
                  className={cn("rounded-lg border p-3", s.border, s.bg)}
                >
                  <p
                    className={cn(
                      "mb-1 flex items-center gap-1.5 text-xs font-semibold",
                      s.titleColor,
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", s.iconColor)} aria-hidden />
                    {rule.title}
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    {rule.text}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Контракты и лимиты */}
          <div
            className="flex flex-wrap gap-1.5"
            role="list"
            aria-label="Контракты и лимиты"
          >
            {qa.guarantees.map((g) => (
              <span
                key={g}
                role="listitem"
                title={g}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/[0.07] px-2 py-0.5 text-[10px] text-emerald-300/90"
              >
                <ShieldCheck className="size-3 shrink-0" aria-hidden />
                {g}
              </span>
            ))}
          </div>

          <Separator className="bg-slate-800" />

          {/* env-переменные + mcp.json */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <Settings2 className="size-3.5" aria-hidden />
                Переменные окружения ({qa.envVars.length})
              </p>
              <div className="max-h-64 overflow-y-auto custom-scroll rounded-md border border-slate-800">
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
                    {qa.envVars.map((v, i) => (
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
                            className="block max-w-[150px] truncate"
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
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <FileJson className="size-3.5" aria-hidden />
                  mcp.json — подключение {qa.connectionName}
                </p>
                <CopyButton text={qa.mcpJson} />
              </div>
              <pre
                aria-label="Содержимое mcp.json"
                className="max-h-64 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300 custom-scroll"
              >
                {qa.mcpJson}
              </pre>
              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
                <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
                <span className="min-w-0 break-all">
                  Источник:{" "}
                  <a
                    href={qa.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-violet-400 hover:text-violet-300 hover:underline"
                  >
                    {qa.docsUrl}
                  </a>
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}
