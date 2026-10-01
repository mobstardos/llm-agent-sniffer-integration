"use client";

import { useMemo } from "react";
import { Snowflake } from "lucide-react";
import type { SeriesPoint } from "@/hooks/use-sniffer-stream";
import { fmtCompact } from "@/lib/format";

export type ChartMetric = "pps" | "bps";

interface PpsChartProps {
  series: SeriesPoint[];
  metric: ChartMetric;
  height?: number;
  /** График на паузе: маркер «снимок» и таймстамп заморозки */
  frozen?: boolean;
}

const METRIC_META: Record<ChartMetric, { color: string; label: string; unit: string }> = {
  pps: { color: "#10b981", label: "пакетов", unit: "п/с" },
  bps: { color: "#22d3ee", label: "байтов", unit: "Б/с" },
};

/**
 * Лёгкий SVG-график трафика без зависимостей:
 * линия + градиентная заливка, сетка, подписи осей.
 * metric = "pps" (пакетов/с, emerald) | "bps" (байт/с, cyan).
 */
export function PpsChart({ series, metric, height = 150, frozen = false }: PpsChartProps) {
  const W = 600;
  const H = 150;
  const meta = METRIC_META[metric];

  const { linePath, areaPath, maxVal, points, gridLines } = useMemo(() => {
    const data = series.slice(-120); // последние 2 минуты
    const values = data.map((d) => (metric === "pps" ? d.pps : d.bps));
    const maxLocal = Math.max(8, ...(values.length ? values : [8]));
    const pts = data.map((d, i) => {
      const v = metric === "pps" ? d.pps : d.bps;
      const x = data.length <= 1 ? W : (i / (data.length - 1)) * W;
      const y = H - 20 - (v / maxLocal) * (H - 34);
      return { x, y, v };
    });
    const fmt = (v: number) => (metric === "pps" ? String(Math.round(v)) : fmtCompact(v));
    const grid = [0.25, 0.5, 0.75].map((f) => ({
      y: 14 + f * (H - 34),
      value: fmt(maxLocal * (1 - f)),
    }));
    if (pts.length === 0) {
      return { linePath: "", areaPath: "", maxVal: maxLocal, points: [], gridLines: grid };
    }
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - 20} L${pts[0].x.toFixed(1)},${H - 20} Z`;
    return { linePath: line, areaPath: area, maxVal: maxLocal, points: pts, gridLines: grid };
  }, [series, metric]);

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
  const avg = Math.round(points.reduce((a, p) => a + p.v, 0) / points.length);

  return (
    <div className="relative" aria-label={`График ${meta.label} в секунду`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
      >
        <defs>
          <linearGradient id={`${metric}Fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={meta.color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={meta.color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Горизонтальная сетка + подписи значений */}
        {gridLines.map((g) => (
          <g key={g.y}>
            <line
              x1="0"
              x2={W}
              y1={g.y}
              y2={g.y}
              stroke="#334155"
              strokeDasharray="4 6"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text x="4" y={g.y - 3} className="fill-slate-600" style={{ fontSize: 9 }}>
              {g.value}
            </text>
          </g>
        ))}

        {/* Осевая линия (низ) */}
        <line
          x1="0"
          x2={W}
          y1={H - 20}
          y2={H - 20}
          stroke="#475569"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {areaPath && <path d={areaPath} fill={`url(#${metric}Fill)`} />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={meta.color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {last && (
          <circle cx={last.x} cy={last.y} r="3.5" fill={meta.color} stroke="#022c22" strokeWidth="1.5" />
        )}
      </svg>

      {frozen && (
        <div className="pointer-events-none absolute left-2 top-1 flex animate-in items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300 fade-in duration-300">
          <Snowflake className="size-3" aria-hidden />
          снимок графика
        </div>
      )}
      <div className="pointer-events-none absolute right-2 top-1 flex gap-1.5">
        <span
          className="rounded bg-slate-900/85 px-1.5 py-0.5 font-mono text-[10px]"
          style={{ color: meta.color }}
        >
          макс {metric === "pps" ? maxVal : fmtCompact(maxVal)} {meta.unit}
        </span>
        <span className="rounded bg-slate-900/85 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          сред {metric === "pps" ? avg : fmtCompact(avg)} {meta.unit}
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-1 left-2 rounded bg-slate-900/85 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
        {new Date(series[series.length - 1].ts).toLocaleTimeString("ru-RU")} · окно 2 мин
      </div>
    </div>
  );
}
