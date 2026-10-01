"use client";

import { useEffect, useRef, useState } from "react";

// Типы, зеркалят серверные из src/lib/sniffer/hub.ts
export interface Packet {
  id: number;
  ts: string;
  direction: "TX" | "RX";
  client: string;
  portName: string;
  protocol: string;
  msgType?: string;
  methodType?: string;
  method?: string;
  cmdType?: string;
  cmdClass?: number;
  cmd?: number;
  size: number;
  valid: boolean;
  summary: string;
  hexPreview: string;
}

export interface Session {
  id: string;
  client: string;
  portName: string;
  protocol: string;
  startedAt: string;
  txPackets: number;
  rxPackets: number;
  txBytes: number;
  rxBytes: number;
  state: "active" | "closing" | "closed";
}

export interface Alert {
  id: string;
  rule: string;
  severity: "info" | "warn" | "crit";
  message: string;
  protocol?: string;
  client?: string;
  packetId?: number;
  createdAt: string;
}

export interface SeriesPoint {
  ts: string;
  pps: number;
  bps: number;
}

export interface SnifferStats {
  startedAt: string;
  uptimeSec: number;
  totalPackets: number;
  totalBytes: number;
  activeSessions: number;
  totalSessions: number;
  alertsCount: number;
  perProtocol: Record<string, number>;
  topMethods: { name: string; count: number }[];
  topClients: { name: string; count: number }[];
  lastPps: number;
  lastBps: number;
  invalidPackets: number;
}

const CLIENT_PACKETS_CAP = 3000; // как в реальной панели
const CLIENT_ALERTS_CAP = 200;
const SERIES_CAP = 300;

const MAX_RETRY_MS = 15000;

export interface SnifferLiveState {
  connected: boolean;
  connecting: boolean;
  packets: Packet[]; // новые первыми
  sessions: Session[];
  alerts: Alert[]; // новые первыми
  stats: SnifferStats | null;
  series: SeriesPoint[];
  retrySec: number | null;
}

/**
 * SSE-подключение к /api/sniffer/stream.
 * - события: status, packet, session, alert, stats;
 * - пакетный буфер клиента 3000;
 * - реконнект с задержкой 3с (экспоненциально до 15с);
 * - батчинг обновлений 500мс для плавности.
 */
export function useSnifferStream(): SnifferLiveState {
  const [state, setState] = useState<SnifferLiveState>({
    connected: false,
    connecting: true,
    packets: [],
    sessions: [],
    alerts: [],
    stats: null,
    series: [],
    retrySec: null,
  });

  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  // Буферы-аккумуляторы (флаш раз в 500мс)
  const pktBufRef = useRef<Packet[]>([]);
  const sessBufRef = useRef<Map<string, Session>>(new Map());
  const alertBufRef = useRef<Alert[]>([]);
  const statsBufRef = useRef<SnifferStats | null>(null);
  const seriesBufRef = useRef<SeriesPoint[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const flush = () => {
      if (!mountedRef.current || !dirtyRef.current) return;
      dirtyRef.current = false;
      setState((prev) => {
        let packets = prev.packets;
        if (pktBufRef.current.length > 0) {
          const incoming = pktBufRef.current;
          pktBufRef.current = [];
          packets = [...incoming.reverse(), ...prev.packets].slice(
            0,
            CLIENT_PACKETS_CAP
          );
        }
        let sessions = prev.sessions;
        if (sessBufRef.current.size > 0) {
          const map = new Map(prev.sessions.map((s) => [s.id, s]));
          for (const s of sessBufRef.current.values()) map.set(s.id, s);
          sessBufRef.current.clear();
          sessions = [...map.values()].slice(0, 24);
        }
        let alerts = prev.alerts;
        if (alertBufRef.current.length > 0) {
          alerts = [
            ...alertBufRef.current.reverse(),
            ...prev.alerts,
          ].slice(0, CLIENT_ALERTS_CAP);
          alertBufRef.current = [];
        }
        const stats = statsBufRef.current ?? prev.stats;
        let series = prev.series;
        if (seriesBufRef.current.length > 0) {
          series = [...prev.series, ...seriesBufRef.current].slice(-SERIES_CAP);
          seriesBufRef.current = [];
        }
        return { ...prev, packets, sessions, alerts, stats, series };
      });
    };

    flushTimerRef.current = setInterval(flush, 500);

    const connect = () => {
      if (!mountedRef.current) return;
      const es = new EventSource("/api/sniffer/stream");
      esRef.current = es;

      const apply = (fn: (prev: SnifferLiveState) => SnifferLiveState) => {
        attemptRef.current = 0;
        setState((prev) => {
          const next = fn(prev);
          next.connected = true;
          next.connecting = false;
          next.retrySec = null;
          return next;
        });
      };

      es.addEventListener("open", () => {
        attemptRef.current = 0;
        setState((prev) => ({
          ...prev,
          connected: true,
          connecting: false,
          retrySec: null,
        }));
      });

      es.addEventListener("status", (e) => {
        try {
          const snap = JSON.parse((e as MessageEvent).data) as {
            stats: SnifferStats;
            sessions: Session[];
            packets: Packet[];
            alerts: Alert[];
            series: SeriesPoint[];
          };
          apply((prev) => ({
            ...prev,
            packets: [...snap.packets].reverse().slice(0, CLIENT_PACKETS_CAP),
            sessions: snap.sessions,
            alerts: [...snap.alerts].reverse().slice(0, CLIENT_ALERTS_CAP),
            stats: snap.stats,
            series: snap.series.slice(-SERIES_CAP),
          }));
        } catch {
          /* игнорируем битый кадр */
        }
      });

      es.addEventListener("packet", (e) => {
        try {
          pktBufRef.current.push(JSON.parse((e as MessageEvent).data) as Packet);
          dirtyRef.current = true;
        } catch {
          /* noop */
        }
      });

      es.addEventListener("session", (e) => {
        try {
          const s = JSON.parse((e as MessageEvent).data) as Session;
          sessBufRef.current.set(s.id, s);
          dirtyRef.current = true;
        } catch {
          /* noop */
        }
      });

      es.addEventListener("alert", (e) => {
        try {
          alertBufRef.current.push(JSON.parse((e as MessageEvent).data) as Alert);
          dirtyRef.current = true;
        } catch {
          /* noop */
        }
      });

      es.addEventListener("stats", (e) => {
        try {
          const st = JSON.parse((e as MessageEvent).data) as SnifferStats;
          statsBufRef.current = st;
          seriesBufRef.current.push({
            ts: new Date().toISOString(),
            pps: st.lastPps,
            bps: st.lastBps,
          });
          dirtyRef.current = true;
        } catch {
          /* noop */
        }
      });

      es.addEventListener("error", () => {
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
        if (!mountedRef.current) return;
        attemptRef.current += 1;
        const delay = Math.min(3000 * attemptRef.current, MAX_RETRY_MS);
        setState((prev) => ({
          ...prev,
          connected: false,
          connecting: true,
          retrySec: Math.round(delay / 1000),
        }));
        retryRef.current = setTimeout(connect, delay);
      });
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (retryRef.current) clearTimeout(retryRef.current);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, []);

  return state;
}
