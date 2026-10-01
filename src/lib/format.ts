/** Форматтеры для сниффер-панели (RU). */

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} МБ`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

export function fmtCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)} тыс.`;
  return `${(n / 1_000_000).toFixed(2)} млн`;
}

/** Скорость в байтах/с → «25.9 тыс. Б/с» */
export function fmtRate(bytesPerSec: number): string {
  return `${fmtCompact(Math.round(bytesPerSec))} Б/с`;
}

/** HH:MM:SS.mmm из ISO-строки */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (x: number, w = 2) => String(x).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** HH:MM:SS из ISO-строки */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

/** Цвета протоколов (без синих/индиго в качестве основы) */
export const PROTOCOL_COLORS: Record<string, string> = {
  REMOTE_SERVER: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  THRIFT: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  HTTP: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  JSON: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  MODBUS: "border-teal-500/40 bg-teal-500/10 text-teal-400",
  RAW: "border-slate-500/40 bg-slate-500/10 text-slate-400",
};

export function protocolColor(protocol: string): string {
  return PROTOCOL_COLORS[protocol] ?? PROTOCOL_COLORS.RAW;
}
