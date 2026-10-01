"use client";

import { useMemo } from "react";
import type { SeriesPoint } from "@/hooks/use-sniffer-stream";

interface PpsChartProps {
  series: SeriesPoint[];
  height?: number;
}

/**
 * Лёгкий SVG-график pps (пакетов/с) без зависимостей:
 * линия + градиентная заливка (emerald), пунктир — bps-масштаб.
 */
export function PpsChart({ series, height = 140 }: PpsChartProps) {
  const W = 600;
  const H = 140;

  const { linePath, areaPath, maxPps, points } = useMemo(() => {
    const data = series.slice(-120); // последние 2 минуты
    const maxPpsLocal = Math.max(6, ...data.map((d) => d.pps));
    const pts = data.map((d, i) => {
      const x = data.length <= 1 ? W : (i / (data.length - 1)) * W;
      const y = H - 8 - (d.pps / maxPpsLocal) * (H - 24);
      return { x, y, d };
    });
    if (pts.length === 0) {
      return { linePath: "", areaPath: "", maxPps: maxPpsLocal, points: [] };
    }
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
    return { linePath: line, areaPath: area, maxPps: maxPpsLocal, points: pts };
  }, [series]);

  if (series.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-500"
        style={{ height }}
      >
        Накопление статистики…
      </div>
    );
  }

  const last = points[points.length - 1];

  return (
    <div className="relative" aria-label="График пакетов в секунду">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
      >
        <defs>
          <linearGradient id="ppsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={W}
            y1={H * f}
            y2={H * f}
            stroke="#334155"
            strokeDasharray="4 6"
            strokeWidth="1"
          />
        ))}
        {areaPath && <path d={areaPath} fill="url(#ppsFill)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {last && (
          <circle cx={last.x} cy={last.y} r="3.5" fill="#10b981" stroke="#022c22" strokeWidth="1.5" />
        )}
      </svg>
      <div className="pointer-events-none absolute right-2 top-1 rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
        макс {maxPps} п/с
      </div>
      <div className="pointer-events-none absolute bottom-1 left-2 rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
        {series.length > 0 ? new Date(series[series.length - 1].ts).toLocaleTimeString("ru-RU") : ""}
      </div>
    </div>
  );
}
