"use client";

import { useMemo } from "react";
import type { SeriesPoint } from "@/hooks/use-sniffer-stream";

interface PpsChartProps {
  series: SeriesPoint[];
  height?: number;
}

/**
 * Лёгкий SVG-график pps (пакетов/с) без зависимостей:
 * линия + градиентная заливка (emerald), сетка, подписи осей.
 */
export function PpsChart({ series, height = 150 }: PpsChartProps) {
  const W = 600;
  const H = 150;

  const { linePath, areaPath, maxPps, points, gridLines } = useMemo(() => {
    const data = series.slice(-120); // последние 2 минуты
    const maxPpsLocal = Math.max(8, ...data.map((d) => d.pps));
    const pts = data.map((d, i) => {
      const x = data.length <= 1 ? W : (i / (data.length - 1)) * W;
      const y = H - 20 - (d.pps / maxPpsLocal) * (H - 34);
      return { x, y, d };
    });
    const grid = [0.25, 0.5, 0.75].map((f) => ({
      y: 14 + f * (H - 34),
      value: Math.round(maxPpsLocal * (1 - f)),
    }));
    if (pts.length === 0) {
      return { linePath: "", areaPath: "", maxPps: maxPpsLocal, points: [], gridLines: grid };
    }
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - 20} L${pts[0].x.toFixed(1)},${H - 20} Z`;
    return { linePath: line, areaPath: area, maxPps: maxPpsLocal, points: pts, gridLines: grid };
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
  const avg = Math.round(points.reduce((a, p) => a + p.d.pps, 0) / points.length);

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

      <div className="pointer-events-none absolute right-2 top-1 flex gap-1.5">
        <span className="rounded bg-slate-900/85 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
          макс {maxPps}
        </span>
        <span className="rounded bg-slate-900/85 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          сред {avg}
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-1 left-2 rounded bg-slate-900/85 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
        {new Date(series[series.length - 1].ts).toLocaleTimeString("ru-RU")} · окно 2 мин
      </div>
    </div>
  );
}
