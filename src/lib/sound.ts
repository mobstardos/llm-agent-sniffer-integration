/**
 * WebAudio-сигналы панели сниффера (клиентская часть).
 *
 * AudioContext создаётся лениво и только по жесту пользователя
 * (включение тумблера) — иначе браузеры блокируют автоплей.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Короткий однотонный сигнал. */
function tone(
  c: AudioContext,
  freq: number,
  startMs: number,
  durMs: number,
  vol = 0.06
): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, c.currentTime + startMs / 1000);
  const t0 = c.currentTime + startMs / 1000;
  const t1 = t0 + durMs / 1000;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

/**
 * Тревожный двухтональный сигнал для критических алертов
 * (нисходящий интервал — «внимание»).
 */
export function playCritBeep(): void {
  const c = getCtx();
  if (!c) return;
  tone(c, 880, 0, 110, 0.07);
  tone(c, 620, 130, 160, 0.07);
}

/** Короткий подтверждающий блип (включение звука, ручные действия). */
export function playConfirmBlip(): void {
  const c = getCtx();
  if (!c) return;
  tone(c, 660, 0, 70, 0.05);
  tone(c, 990, 90, 90, 0.05);
}
