"use client";

import { useId, useMemo } from "react";

interface SparklineProps {
  /** Числовой ряд (последние N значений) */
  data: number[];
  /** Цвет линии (hex) */
  stroke?: string;
  className?: string;
}

/**
 * Мини-спарклайн без зависимостей: полилиния + мягкая заливка.
 * Используется в KPI-карточках сниффер-панели.
 */
export function Sparkline({ data, stroke = "#10b981", className }: SparklineProps) {
  const W = 120;
  const H = 36;
  const gid = useId();

  const { line, area, lastPt } = useMemo(() => {
    const pts = data.slice(-48);
    if (pts.length < 2) return { line: "", area: "", lastPt: null as { x: number; y: number } | null };
    const max = Math.max(...pts);
    const min = Math.min(...pts);
    const span = Math.max(1e-9, max - min);
    const coords = pts.map((v, i) => ({
      x: (i / (pts.length - 1)) * (W - 4) + 2,
      y: H - 4 - ((v - min) / span) * (H - 10),
    }));
    const l = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const a = `${l} L${coords[coords.length - 1].x.toFixed(1)},${H} L${coords[0].x.toFixed(1)},${H} Z`;
    return { line: l, area: a, lastPt: coords[coords.length - 1] };
  }, [data]);

  if (!line) {
    return <div className={className} aria-hidden style={{ width: W / 2, height: H / 2 }} />;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: W / 2, height: H / 2 }}
      role="img"
      aria-label="Динамика за последние ~50 секунд"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill={stroke} />}
    </svg>
  );
}
