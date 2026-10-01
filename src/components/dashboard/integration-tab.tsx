"use client";

import { useState } from "react";
import {
  Download,
  FileCode2,
  FileText,
  ListChecks,
  Package,
  Terminal,
  Wrench,
  AlertTriangle,
  ShieldCheck,
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { IntegrationPayload } from "@/lib/sniffer/integration-data";

interface IntegrationTabProps {
  data: IntegrationPayload | null;
}

export function IntegrationTab({ data }: IntegrationTabProps) {
  const [pkgReady, setPkgReady] = useState<boolean | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [snippetIdx, setSnippetIdx] = useState(0);

  const downloadPackage = async () => {
    if (pkgReady === false) {
      toast.info("Пакет готовится", {
        description: "Архив ещё не собран — попробуйте позже или скачайте примечания.",
      });
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch("/api/download/package");
      if (res.status === 404) {
        setPkgReady(false);
        toast.info("Пакет готовится", {
          description: "Архив ещё не собран — попробуйте позже или скачайте примечания.",
        });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "llm-agent-v2026-10-01-sniffer-integration.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPkgReady(true);
      toast.success("Загрузка началась", {
        description: "llm-agent-v2026-10-01-sniffer-integration.zip",
      });
    } catch {
      toast.error("Ошибка загрузки пакета");
    } finally {
      setDownloading(false);
    }
  };

  const downloadNotes = async () => {
    try {
      const res = await fetch("/api/download/notes");
      if (res.status === 404) {
        toast.info("Примечания готовятся");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "INTEGRATION_NOTES.md";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Примечания скачаны", { description: "INTEGRATION_NOTES.md" });
    } catch {
      toast.error("Ошибка загрузки примечаний");
    }
  };

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-lg bg-slate-800/60" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-lg bg-slate-800/60" />
          <Skeleton className="h-80 rounded-lg bg-slate-800/60" />
        </div>
      </div>
    );
  }

  const snippet = data.codeSnippets[snippetIdx] ?? data.codeSnippets[0];

  return (
    <div className="space-y-4">
      {/* Скачивание + план */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
              <Package className="size-4 text-emerald-400" aria-hidden />
              Пакет интеграции
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Пропатченное дерево LLM-Agent + вендоренный UniversalSniffer (MCP-сервер,
              агент, конвейер OAC, документация).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 p-4 pt-2">
            <Button
              onClick={downloadPackage}
              disabled={downloading}
              className="min-h-[44px] flex-1 bg-emerald-600 text-white hover:bg-emerald-500 sm:flex-none sm:px-4"
            >
              <Download className="size-4" aria-hidden />
              {downloading ? "Загрузка…" : "Скачать llm-agent + Sniffer (zip)"}
            </Button>
            <Button
              onClick={downloadNotes}
              variant="outline"
              className="min-h-[44px] flex-1 border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-emerald-300 sm:flex-none sm:px-4"
            >
              <FileText className="size-4" aria-hidden />
              Примечания (MD)
            </Button>
            {pkgReady === false && (
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-400">
                архив ещё не собран
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
              <ListChecks className="size-4 text-emerald-400" aria-hidden />
              План интеграции — 8 шагов
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-3">
            <div className="max-h-52 overflow-y-auto custom-scroll" role="list">
              <ol className="space-y-2 px-4 pt-1">
                {data.integrationPlan.map((step, i) => (
                  <li key={step.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/10 font-mono text-[10px] text-emerald-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-200">
                        {step.title}
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-400"
                        >
                          готово
                        </Badge>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Дерево файлов + MCP tools */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
              <FileCode2 className="size-4 text-emerald-400" aria-hidden />
              Дерево файлов ({data.fileTree.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Все изменения в дереве llm-agent
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="max-h-96 overflow-y-auto custom-scroll" role="list">
              <ul className="space-y-1.5 px-4 py-2">
                {data.fileTree.map((f) => (
                  <li key={f.path} className="flex items-start gap-2 text-xs">
                    <FileCode2
                      className={`mt-0.5 size-3.5 shrink-0 ${
                        f.action === "added" ? "text-emerald-500" : "text-amber-500"
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="break-all font-mono text-[11px] text-slate-200">
                          {f.path}
                        </span>
                        <Badge
                          variant="outline"
                          className={`px-1 py-0 text-[9px] uppercase ${
                            f.action === "added"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {f.action}
                        </Badge>
                      </p>
                      <p className="text-[11px] leading-snug text-slate-500">{f.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
              <Wrench className="size-4 text-emerald-400" aria-hidden />
              MCP-инструменты sniffer ({data.mcpTools.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              tools → HTTP API :9500
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="max-h-96 overflow-y-auto custom-scroll">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-900">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] text-slate-500">Инструмент</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Risk</TableHead>
                    <TableHead className="text-[11px] text-slate-500">Описание</TableHead>
                    <TableHead className="pr-4 text-[11px] text-slate-500">HTTP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.mcpTools.map((t) => (
                    <TableRow key={t.name} className="border-slate-800/70">
                      <TableCell className="py-2 pl-4 font-mono text-[11px] text-emerald-300">
                        {t.name}
                      </TableCell>
                      <TableCell className="py-2">
                        {t.danger ? (
                          <Badge variant="outline" className="border-red-500/50 bg-red-500/10 px-1.5 py-0 text-[10px] text-red-400">
                            danger
                          </Badge>
                        ) : (
                          <ShieldCheck className="size-3.5 text-emerald-600" aria-label="безопасно" />
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] py-2 text-xs text-slate-300">
                        {t.description}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 pr-4 font-mono text-[10px] text-slate-500">
                        {t.httpMapping}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Просмотр кода */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-slate-100">
            <Terminal className="size-4 text-emerald-400" aria-hidden />
            Фрагменты интеграции
          </CardTitle>
          <Select
            value={String(snippetIdx)}
            onValueChange={(v) => setSnippetIdx(Number(v))}
          >
            <SelectTrigger className="h-10 w-full border-slate-700 bg-slate-950 text-sm text-slate-200 sm:w-[340px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-950 text-slate-200">
              {data.codeSnippets.map((s, i) => (
                <SelectItem key={s.title} value={String(i)} className="font-mono text-xs">
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {snippet && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-violet-500/40 bg-violet-500/10 font-mono text-[10px] uppercase text-violet-300"
                >
                  {snippet.lang}
                </Badge>
                <span className="font-mono text-[11px] text-slate-500">{snippet.title}</span>
              </div>
              <pre className="max-h-96 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-300 custom-scroll">
                {snippet.code}
              </pre>
            </>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-400/90">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Опасные инструменты (sniffer_start/stop/reload, vcexecutecode) требуют
            подтверждения оператора — human-in-the-loop.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
