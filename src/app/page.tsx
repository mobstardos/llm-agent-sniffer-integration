"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { motion } from "framer-motion";
import { ExternalLink, LayoutDashboard, Radar, Blocks, Github } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { useSnifferStream } from "@/hooks/use-sniffer-stream";
import type { IntegrationPayload } from "@/lib/sniffer/integration-data";
import { DashboardHeader } from "@/components/dashboard/header";
import { OverviewTab } from "@/components/dashboard/overview-tab";
import { SnifferTab, SnifferTabSkeleton } from "@/components/dashboard/sniffer-tab";
import { IntegrationTab } from "@/components/dashboard/integration-tab";
import { ReposTab } from "@/components/dashboard/repos-tab";

const TAB_IDS = ["overview", "sniffer", "integration", "repos"] as const;
type TabId = (typeof TAB_IDS)[number];

const TAB_META: Record<TabId, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  overview: { label: "Обзор", icon: LayoutDashboard },
  sniffer: { label: "Сниффер (демо)", icon: Radar },
  integration: { label: "Интеграция", icon: Blocks },
  repos: { label: "Репозитории", icon: Github },
};

export default function HomePage() {
  const live = useSnifferStream();
  const [integration, setIntegration] = useState<IntegrationPayload | null>(null);
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integration")
      .then((r) => r.json())
      .then((d: IntegrationPayload) => {
        if (!cancelled) setIntegration(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Глобальные горячие клавиши: 1–4 — переключение вкладок
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      )
        return;
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0) setTab(TAB_IDS[idx]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
      <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
        <DashboardHeader
          connected={live.connected}
          connecting={live.connecting}
          retrySec={live.retrySec}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="w-full">
            <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-slate-800 bg-slate-900/70 p-1">
              {TAB_IDS.map((id) => {
                const Icon = TAB_META[id].icon;
                return (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="min-h-[44px] rounded-md px-3 text-sm text-slate-400 transition-colors data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 sm:px-4"
                  >
                    <Icon className="size-4 sm:mr-1.5" aria-hidden />
                    <span className="hidden sm:inline">{TAB_META[id].label}</span>
                    <span className="sm:hidden">{TAB_META[id].label.split(" ")[0]}</span>
                    {id === "sniffer" && live.connected && (
                      <span className="ml-1.5 inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="overview">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <OverviewTab data={integration} />
              </motion.div>
            </TabsContent>

            <TabsContent value="sniffer">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {live.stats === null ? <SnifferTabSkeleton /> : <SnifferTab live={live} />}
              </motion.div>
            </TabsContent>

            <TabsContent value="integration">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <IntegrationTab data={integration} />
              </motion.div>
            </TabsContent>

            <TabsContent value="repos">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <ReposTab data={integration} />
              </motion.div>
            </TabsContent>
          </Tabs>
        </main>

        <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
            <p className="min-w-0">
              Интеграция UniversalSniffer v3.1 → LLM-Agent v2026-10-01 · демо-генератор
              трафика имитирует parsers реального сниффера · © 2026
            </p>
            <nav aria-label="Репозитории проекта" className="flex flex-wrap items-center gap-4">
              <a
                href="https://github.com/comol/mcp_designer_tools"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[28px] items-center gap-1 hover:text-emerald-400"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                comol/mcp_designer_tools
              </a>
              <a
                href="https://github.com/alexeyk222/Agents"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[28px] items-center gap-1 hover:text-emerald-400"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                alexeyk222/Agents
              </a>
            </nav>
          </div>
        </footer>

        <Toaster position="bottom-right" richColors closeButton duration={3000} />
      </div>
    </ThemeProvider>
  );
}
