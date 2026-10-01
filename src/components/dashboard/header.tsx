"use client";

import { useState } from "react";
import { Radar, RotateCcw, Loader2, Keyboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface HeaderProps {
  connected: boolean;
  connecting: boolean;
  retrySec: number | null;
}

export function DashboardHeader({ connected, connecting, retrySec }: HeaderProps) {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/sniffer/reset", { method: "POST" });
      if (res.ok) {
        toast.success("Сниффер перезапущен", {
          description: "Буферы пакетов, сессии и таблица алертов очищены.",
        });
      } else {
        toast.error("Не удалось перезапустить сниффер");
      }
    } catch {
      toast.error("Сервер недоступен");
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="header-hairline sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10">
            <Radar className="size-5 text-emerald-400" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
              LLM-Agent × UniversalSniffer
            </h1>
            <p className="truncate text-xs text-slate-400">
              Анализ интеграции · сниффер-панель · v3.1
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge
            variant="outline"
            className="min-h-[28px] gap-2 border-slate-700 bg-slate-900 px-2.5 font-mono text-xs"
          >
            <span className="relative flex size-2">
              {connected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              )}
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  connected ? "bg-emerald-400" : connecting ? "bg-amber-400" : "bg-red-500"
                }`}
              />
            </span>
            {connected ? (
              <span className="text-emerald-400">LIVE</span>
            ) : connecting ? (
              <span className="text-amber-400">
                {retrySec ? `переподключение ${retrySec}с` : "подключение…"}
              </span>
            ) : (
              <span className="text-red-400">офлайн</span>
            )}
          </Badge>

          <Separator orientation="vertical" className="hidden h-6 bg-slate-800 sm:block" />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Горячие клавиши"
                className="min-h-[44px] border-slate-700 bg-slate-900 px-2.5 text-slate-400 hover:bg-slate-800 hover:text-emerald-300 sm:min-h-[36px]"
              >
                <Keyboard className="size-4" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 border-slate-700 bg-slate-950 p-3 text-slate-200"
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Горячие клавиши
              </p>
              <ul className="space-y-1.5 text-xs">
                {[
                  ["1–4", "переключение вкладок"],
                  ["P", "пауза таблицы (вкладка «Сниффер»)"],
                  ["S", "снять срез аналитики — сравнение"],
                  ["/", "фокус на поиск пакетов"],
                  ["Esc", "закрыть панель пакета"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <kbd className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                      {k}
                    </kbd>
                    <span className="text-right text-slate-400">{v}</span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={resetting}
                className="min-h-[44px] border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-emerald-300 sm:min-h-[36px]"
              >
                {resetting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RotateCcw className="size-4" aria-hidden />
                )}
                <span className="ml-1.5 hidden sm:inline">Reset</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Очистить буферы сниффера и таблицу алертов (перезапуск демо)
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
