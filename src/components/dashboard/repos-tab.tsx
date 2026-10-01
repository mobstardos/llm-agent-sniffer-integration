"use client";

import {
  ExternalLink,
  GitBranch,
  Lightbulb,
  BrainCircuit,
  ShieldAlert,
  Workflow,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { IntegrationPayload } from "@/lib/sniffer/integration-data";

interface ReposTabProps {
  data: IntegrationPayload | null;
}

const PIPELINE_STEPS = [
  { id: "analysis", label: "Анализ", role: "ContextScout" },
  { id: "plan", label: "План", role: "TaskManager" },
  { id: "confirm", label: "Подтверждение", role: "оператор" },
  { id: "execute", label: "Выполнение", role: "OpenCoder" },
  { id: "verify", label: "Проверка", role: "TestEngineer" },
];

export function ReposTab({ data }: ReposTabProps) {
  if (!data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-96 rounded-lg bg-slate-800/60" />
        ))}
      </div>
    );
  }

  const [designer, oac] = data.repos;

  return (
    <div className="space-y-4">
      {/* mcp_designer_tools */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base text-slate-100">
            <GitBranch className="size-4 text-emerald-400" aria-hidden />
            <span className="font-mono">comol/mcp_designer_tools</span>
            <a
              href={designer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[28px] items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              aria-label="Открыть репозиторий mcp_designer_tools"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              GitHub
            </a>
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed text-slate-400">
            {designer.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <div className="max-h-80 overflow-y-auto custom-scroll">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-900">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="pl-4 text-[11px] text-slate-500">Инструмент</TableHead>
                  <TableHead className="text-[11px] text-slate-500">Параметры</TableHead>
                  <TableHead className="text-[11px] text-slate-500">Назначение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(designer.tools ?? []).map((t) => (
                  <TableRow key={t.name} className="border-slate-800/70">
                    <TableCell className="py-2 pl-4 font-mono text-xs text-emerald-300">
                      {t.name}
                    </TableCell>
                    <TableCell className="py-2 font-mono text-[11px] text-slate-400">
                      {t.params.length > 0 ? t.params.join(", ") : "—"}
                    </TableCell>
                    <TableCell className="max-w-[320px] py-2 pr-4 text-xs text-slate-300">
                      {t.description}
                      {t.risk && (
                        <span className="mt-1 flex items-start gap-1 text-[11px] text-red-400/90">
                          <ShieldAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                          {t.risk}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="px-4 pb-3 pt-2 text-[11px] leading-relaxed text-amber-400/90">
            ⚠ Риск: vcexecutecode исполняет произвольный код 1С под учётной записью
            httpd-сервиса Конструктора. В интеграции инструмент помечен danger и
            включён в список require_confirm агента — выполнение только после явного
            подтверждения оператора и на dev-стендах.
          </p>
        </CardContent>
      </Card>

      {/* OAC */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base text-slate-100">
            <GitBranch className="size-4 text-emerald-400" aria-hidden />
            <span className="font-mono">alexeyk222/Agents</span>
            <Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 text-[10px] text-violet-300">
              OpenAgents Control
            </Badge>
            <a
              href={oac.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[28px] items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              aria-label="Открыть репозиторий Agents (OAC)"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              GitHub
            </a>
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed text-slate-400">
            {oac.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-2">
          {/* Конвейер */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Workflow className="size-3.5" aria-hidden />
              Конвейер разработки (loops/oac_pipeline.yaml)
            </p>
            <div className="flex flex-wrap items-stretch gap-1.5">
              {PIPELINE_STEPS.map((step, i) => (
                <div key={step.id} className="flex items-center gap-1.5">
                  <div
                    className={`flex min-w-0 flex-col rounded-lg border px-3 py-2 text-center ${
                      step.id === "confirm"
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-slate-700 bg-slate-900"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        step.id === "confirm" ? "text-amber-300" : "text-slate-200"
                      }`}
                    >
                      {i + 1}. {step.label}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{step.role}</span>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <span aria-hidden className="shrink-0 text-slate-500">
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-slate-800" />

          {/* Роли */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Ролевые агенты
            </p>
            <div className="max-h-72 overflow-y-auto custom-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-[11px] text-slate-500">Агент</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Роль</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Когда используется</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(oac.roles ?? []).map((r) => (
                    <TableRow key={r.name} className="border-slate-800/70">
                      <TableCell className="whitespace-nowrap py-2 font-mono text-xs text-violet-300">
                        {r.name}
                      </TableCell>
                      <TableCell className="max-w-[300px] py-2 text-xs text-slate-300">
                        {r.role}
                      </TableCell>
                      <TableCell className="max-w-[260px] py-2 text-xs text-slate-400">
                        {r.when}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <Separator className="bg-slate-800" />

          {/* MVI + Honcho */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <Lightbulb className="size-4" aria-hidden />
                Принцип MVI
              </p>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Minimal Viable Information — каждый шаг конвейера получает минимальный
                достаточный контекст: только релевантные файлы, диффы и резюме памяти.
                Это удерживает расход токенов и снижает шум при ревью.
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <BrainCircuit className="size-4 text-violet-400" aria-hidden />
                Память Honcho
              </p>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Конвейер ведёт долгосрочную память через Honcho (scope: pipeline):
                планы, подтверждения оператора и результаты проверок возвращаются в
                контекст следующих запусков — интеграция сохранена в oac_pipeline.yaml.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
