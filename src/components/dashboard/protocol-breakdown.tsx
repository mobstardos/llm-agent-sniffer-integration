"use client";

import { useMemo } from "react";

/** Свечение сегментов доната по протоколам */
const SEGMENT_HEX: Record<string, string> = {
  REMOTE_SERVER: "#10b981", // emerald
  THRIFT: "#8b5cf6", // violet
  HTTP: "#f97316", // orange
  JSON: "#eab308", // yellow
  MODBUS: "#14b8a6", // teal
  RAW: "#64748b", // slate
};

function segColor(protocol: string): string {
  return SEGMENT_HEX[protocol] ?? "#64748b";
}

interface ProtocolBreakdownProps {
  perProtocol: Record<string, number>;
  totalPackets: number;
  topMethods: { name: string; count: number }[];
  topClients: { name: string; count: number }[];
}

/**
 * Распределение протоколов (SVG-донат без зависимостей)
 * + топ методов/команд и топ клиентов (горизонтальные бары).
 */
export function ProtocolBreakdown({
  perProtocol,
  totalPackets,
  topMethods,
  topClients,
}: ProtocolBreakdownProps) {
  const segments = useMemo(() => {
    const entries = Object.entries(perProtocol).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((acc, [, v]) => acc + v, 0) || 1;
    const fracs = entries.map(([proto, count]) => ({
      proto,
      count,
      frac: count / total,
    }));
    // Кумулятивные доли чистым способом (без мутаций)
    const prefix = fracs.map((_, i) =>
      fracs.slice(0, i + 1).reduce((a, x) => a + x.frac, 0)
    );
    return fracs.map((s, i) => ({
      ...s,
      start: i === 0 ? 0 : prefix[i - 1],
      end: prefix[i],
    }));
  }, [perProtocol]);

  const R = 52;
  const C = 2 * Math.PI * R;

  const maxMethod = Math.max(1, ...topMethods.map((t) => t.count));
  const maxClient = Math.max(1, ...topClients.map((t) => t.count));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Донат протоколов */}
      <div className="flex items-center gap-4">
        <svg
          viewBox="0 0 140 140"
          className="size-[132px] shrink-0"
          role="img"
          aria-label="Распределение пакетов по протоколам"
        >
          <circle cx="70" cy="70" r={R} fill="none" stroke="#1e293b" strokeWidth="16" />
          {segments.map((s) => {
            const len = s.frac * C;
            const offset = -s.start * C;
            return (
              <circle
                key={s.proto}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={segColor(s.proto)}
                strokeWidth="16"
                strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
                strokeDashoffset={offset.toFixed(2)}
                transform="rotate(-90 70 70)"
                className="transition-all duration-700"
              >
                <title>
                  {s.proto}: {s.count} ({(s.frac * 100).toFixed(1)}%)
                </title>
              </circle>
            );
          })}
          <text
            x="70"
            y="66"
            textAnchor="middle"
            className="fill-slate-100 font-mono"
            style={{ fontSize: 15, fontWeight: 700 }}
          >
            {totalPackets >= 10000
              ? `${(totalPackets / 1000).toFixed(1)}к`
              : totalPackets}
          </text>
          <text
            x="70"
            y="82"
            textAnchor="middle"
            className="fill-slate-500"
            style={{ fontSize: 9 }}
          >
            пакетов
          </text>
        </svg>
        <div className="min-w-0 flex-1 space-y-1.5">
          {segments.map((s) => (
            <div key={s.proto} className="flex items-center gap-2 text-[11px]">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: segColor(s.proto) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate font-mono text-slate-300">
                {s.proto}
              </span>
              <span className="shrink-0 font-mono text-slate-500">
                {(s.frac * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Топ методов/команд */}
      <div className="min-w-0">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Топ команд / методов
        </div>
        <div className="space-y-1.5">
          {topMethods.slice(0, 6).map((t) => (
            <div key={t.name} className="group">
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-[11px] text-slate-300">
                  {t.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {t.count}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
                  style={{ width: `${Math.max(3, (t.count / maxMethod) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Топ клиентов */}
      <div className="min-w-0">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Активность клиентов
        </div>
        <div className="space-y-1.5">
          {topClients.slice(0, 6).map((t) => (
            <div key={t.name} className="group">
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-[11px] text-slate-300">
                  {t.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {t.count}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-700"
                  style={{ width: `${Math.max(3, (t.count / maxClient) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
