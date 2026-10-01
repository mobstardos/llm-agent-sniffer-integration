/**
 * Synthetic Sniffer Hub — in-memory имитация UniversalSniffer v3.1.
 *
 * Полностью повторяет архитектуру реального сниффера:
 *  - кольцевые буферы пакетов/алертов, сессии, посекундная статистика;
 *  - генератор трафика ~5 pps с направлениями TX/RX;
 *  - движок алертов с правилами из config.json (cooldown 30с, пороги);
 *  - персистентность алертов в Prisma (SQLite).
 *
 * Синглтон на globalThis — переживает HMR при разработке.
 * Используется ТОЛЬКО на сервере (route handlers).
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

export type Direction = "TX" | "RX";

export type Protocol =
  | "REMOTE_SERVER"
  | "THRIFT"
  | "HTTP"
  | "JSON"
  | "MODBUS"
  | "RAW";

export type PortName =
  | "RemoteServer TCP"
  | "Thrift RPC"
  | "HTTP API"
  | "Modbus TCP"
  | "RAW";

export interface Packet {
  id: number;
  ts: string; // ISO
  direction: Direction;
  client: string; // "10.8.0.51:41234"
  portName: PortName; // канал (listener реального сниффера)
  protocol: Protocol;
  msgType?: string; // CALL | REPLY | EXCEPTION | REQUEST | RESPONSE | ...
  methodType?: string; // DB_REQUEST | CASHLESS_PAY | CASHLESS_ROLLBACK | ...
  method?: string; // имя thrift-метода, напр. sendTanksState
  cmdType?: string;
  cmdClass?: number;
  cmd?: number;
  size: number;
  valid: boolean;
  summary: string; // человекочитаемое резюме
  hexPreview: string; // hexdump первых 128 байт
}

export interface Session {
  id: string;
  client: string;
  portName: PortName;
  protocol: Protocol;
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

export type HubEvent =
  | { type: "packet"; payload: Packet }
  | { type: "session"; payload: Session }
  | { type: "alert"; payload: Alert }
  | { type: "stats"; payload: SnifferStats };

export type HubListener = (ev: HubEvent) => void;

// ---------------------------------------------------------------------------
// Константы, отражающие config.json реального сниффера
// ---------------------------------------------------------------------------

const PACKETS_CAP = 5000;
const ALERTS_CAP = 500;
const SERIES_CAP = 300;
const GEN_INTERVAL_MS = 200; // тик генератора (~5 пакетов/с)

const ALERT_COOLDOWN_MS = 30_000;
const ROLLBACK_WINDOW_MS = 60_000;
const ROLLBACK_THRESHOLD = 2;
const GIANT_SIZE = 1_000_000;

const CMD_TYPES: Record<string, string> = {
  "0:1": "HANDSHAKE",
  "0:2": "SERVICE",
  "50:5": "REPL_UP_1",
  "50:6": "REPL_UP_2",
  "200:1": "SESSION_VAR",
  "200:2": "EXTRA_REQ",
  "200:3": "QUICK_NO_DB",
  "200:4": "EXTRA_REQ_2",
  "200:5": "EXTRA_REQ_3",
  "200:100": "DB_REQUEST",
  "200:110": "CASHLESS_PAY",
  "200:111": "CASHLESS_ROLLBACK",
  "200:120": "SEND_TANKS_STATE",
  "200:130": "GET_CONFIG",
};

const REMOTE_CMD_POOL: { c: number; d: number }[] = [
  { c: 0, d: 1 },
  { c: 0, d: 2 },
  { c: 200, d: 1 },
  { c: 200, d: 2 },
  { c: 200, d: 3 },
  { c: 200, d: 100 },
  { c: 200, d: 110 },
  { c: 200, d: 111 },
  { c: 200, d: 120 },
  { c: 200, d: 130 },
  { c: 50, d: 5 },
];

const THRIFT_METHODS = [
  "sendTanksState",
  "getPrices",
  "sendShiftReport",
  "getNozzlesState",
  "sendCounterState",
  "getDiscountCards",
];

const HTTP_PATHS = [
  "/api/v1/tanks",
  "/api/v1/nozzles",
  "/api/v1/prices",
  "/api/v1/shifts",
  "/api/v1/payments",
  "/api/v1/health",
  "/api/v1/sessions",
];

const KNOWN_TABLES = [
  "dcTanks",
  "dcAzs",
  "dcNozzles",
  "rgPrices",
  "opOperations",
  "sysSessions",
  "sysExchangeLog",
];

const JSON_EVENTS = [
  "tank.state",
  "price.changed",
  "shift.opened",
  "payment.accepted",
  "counter.update",
];

const CLIENT_POOL = [
  "10.8.0.51",
  "10.8.0.52",
  "10.8.0.77",
  "172.16.4.20",
  "172.16.4.21",
  "192.168.10.5",
];

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(entries: readonly [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Классический hexdump в стиле xxd/hd (как parsers/hexdump.py) */
export function hexdump(data: Uint8Array, maxBytes?: number): string {
  const limit = maxBytes ? Math.min(data.length, maxBytes) : data.length;
  const lines: string[] = [];
  const HEX = "0123456789abcdef";
  for (let off = 0; off < limit; off += 16) {
    const chunk = data.subarray(off, Math.min(off + 16, limit));
    let hex = "";
    let ascii = "";
    for (let i = 0; i < 16; i++) {
      if (i < chunk.length) {
        const b = chunk[i];
        hex += HEX[(b >> 4) & 0xf] + HEX[b & 0xf] + (i === 7 ? "  " : " ");
        ascii += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".";
      } else {
        hex += "   ";
        ascii += " ";
      }
    }
    lines.push(
      off.toString(16).padStart(8, "0") + "  " + hex + " |" + ascii + "|"
    );
  }
  if (data.length > limit) {
    lines.push(
      `... (${data.length - limit} байт обрезано; всего ${data.length} Б)`
    );
  }
  return lines.join("\n");
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Генерация пакетов по протоколам (формат вывода parsers реального сниффера)
// ---------------------------------------------------------------------------

interface PacketDraft {
  packet: Omit<Packet, "id" | "ts" | "hexPreview">;
  body: Uint8Array; // тело для hexdump
}

function draftRemoteServer(
  client: string,
  direction: Direction,
  force?: { c: number; d: number }
): PacketDraft {
  const cmd = force ?? pick(REMOTE_CMD_POOL);
  const key = `${cmd.c}:${cmd.d}`;
  const cmdType = CMD_TYPES[key] ?? "UNKNOWN";
  const session = randInt(100000, 999999);
  const txid = randInt(1000, 99999);
  const valid = Math.random() > 0.03;

  // Реальный заголовок: len(4LE) + MAGIC AA AA 00 00 + версия
  const header = new Uint8Array([
    randInt(0, 255),
    randInt(0, 255),
    randInt(0, 255),
    randInt(0, 255),
    0xaa,
    0xaa,
    0x00,
    0x00,
    0x02,
  ]);
  let bodyStr = `RequestCmdClass${cmd.c}RequestCmd${cmd.d}SessionNum${session}TransactionID${txid}`;
  if (cmdType === "DB_REQUEST" && Math.random() < 0.07) {
    bodyStr += ` query=SELECT * FROM ${pick(KNOWN_TABLES)}; -- error: table locked`;
  } else if (cmdType === "DB_REQUEST") {
    bodyStr += ` query=SELECT id,name FROM ${pick(KNOWN_TABLES)} LIMIT 50`;
  }
  if (cmdType === "SEND_TANKS_STATE") {
    bodyStr += ` tanks=[{tank:1,fuel:AI-95,level:${randInt(1000, 5000)}}]`;
  }
  bodyStr += ` ${pick(KNOWN_TABLES)}`;
  const body = new TextEncoder().encode(bodyStr.slice(0, 900));
  const full = new Uint8Array(header.length + body.length);
  full.set(header, 0);
  full.set(body, header.length);

  const parts: string[] = [
    `[RemoteServer TCP] REMOTE_SERVER ${cmdType} (C=${cmd.c},D=${cmd.d})`,
  ];
  if (Math.random() < 0.7) parts.push(`S=${session}`);
  if (Math.random() < 0.5) parts.push(`TX=${txid}`);
  if (Math.random() < 0.25) parts.push("zlib");

  return {
    packet: {
      direction,
      client,
      portName: "RemoteServer TCP",
      protocol: "REMOTE_SERVER",
      cmdType,
      cmdClass: cmd.c,
      cmd: cmd.d,
      size: full.length + randInt(60, 8000),
      valid,
      summary: parts.join(" "),
    },
    body: full,
  };
}

function draftThrift(
  client: string,
  direction: Direction,
  seqRef: { seq: number }
): PacketDraft {
  const method = pick(THRIFT_METHODS);
  const roll = Math.random();
  const msgType =
    roll < 0.94 ? (direction === "TX" ? "CALL" : "REPLY") : "EXCEPTION";
  seqRef.seq += 1;
  const seq = seqRef.seq;
  const valid = msgType !== "EXCEPTION";

  let payload = "";
  if (msgType === "CALL") {
    payload = `${method} seq=${seq} args={stationId:${randInt(1, 250)}, strict:true}`;
  } else if (msgType === "REPLY") {
    payload = `${method} seq=${seq} success=true result={items:${randInt(0, 120)}}`;
  } else {
    payload = `${method} seq=${seq} TApplicationException: Internal error processing ${method} (tank ${randInt(1, 8)} timeout)`;
  }
  const body = new TextEncoder().encode(payload);

  return {
    packet: {
      direction,
      client,
      portName: "Thrift RPC",
      protocol: "THRIFT",
      msgType,
      method,
      size: body.length + randInt(80, 6000),
      valid,
      summary: `[Thrift RPC] THRIFT ${msgType} ${method} (seq=${seq})`,
    },
    body,
  };
}

function draftHttp(client: string, direction: Direction): PacketDraft {
  const method = Math.random() < 0.6 ? "GET" : "POST";
  const path = pick(HTTP_PATHS);
  const status = pick([200, 200, 200, 204, 400, 404, 500]);
  const isResp = direction === "RX";
  const firstLine = isResp
    ? `HTTP/1.1 ${status} ${status === 200 ? "OK" : status === 204 ? "No Content" : status === 400 ? "Bad Request" : status === 404 ? "Not Found" : "Internal Server Error"}`
    : `${method} ${path} HTTP/1.1`;
  const body = new TextEncoder().encode(
    `${firstLine}\r\nHost: azs-core.local\r\nContent-Type: application/json\r\n\r\n{"ok":${status < 400}}`
  );
  return {
    packet: {
      direction,
      client,
      portName: "HTTP API",
      protocol: "HTTP",
      msgType: isResp ? "RESPONSE" : "REQUEST",
      method: isResp ? `HTTP ${status}` : method,
      size: body.length + randInt(120, 12000),
      valid: status < 500,
      summary: `[HTTP API] HTTP ${isResp ? `RESPONSE ${status}` : `REQUEST ${method} ${path}`}`,
    },
    body,
  };
}

function draftJson(client: string, direction: Direction): PacketDraft {
  const ev = pick(JSON_EVENTS);
  const station = randInt(1, 250);
  const body = new TextEncoder().encode(
    `{"event":"${ev}","ts":${Date.now()},"station":${station},"value":${randInt(1, 9999)},"unit":"L"}`
  );
  return {
    packet: {
      direction,
      client,
      portName: "HTTP API",
      protocol: "JSON",
      msgType: "EVENT",
      method: ev,
      size: body.length + randInt(50, 3000),
      valid: Math.random() > 0.02,
      summary: `[HTTP API] JSON ${ev} (station=${station})`,
    },
    body,
  };
}

function draftModbus(client: string, direction: Direction): PacketDraft {
  const func = pick([3, 4, 6]);
  const unit = randInt(1, 24);
  const addr = randInt(0x0000, 0x0fff);
  const qty = randInt(1, 32);
  const value = randInt(0, 65535);
  const isResp = direction === "RX";
  const body =
    isResp && func === 6
      ? new Uint8Array([
          unit,
          func,
          (addr >> 8) & 0xff,
          addr & 0xff,
          (value >> 8) & 0xff,
          value & 0xff,
        ])
      : new Uint8Array([
          unit,
          func,
          (addr >> 8) & 0xff,
          addr & 0xff,
          (qty >> 8) & 0xff,
          qty & 0xff,
        ]);
  const msgType = isResp ? "RESPONSE" : "REQUEST";
  const detail =
    func === 3 || func === 4
      ? `read ${isResp ? `${qty} reg` : "holding"} addr=0x${addr
          .toString(16)
          .padStart(4, "0")}`
      : `write addr=0x${addr.toString(16).padStart(4, "0")} value=${value}`;
  return {
    packet: {
      direction,
      client,
      portName: "Modbus TCP",
      protocol: "MODBUS",
      msgType,
      methodType: `FUNC_${func}`,
      method: `func=${func}`,
      size: body.length + randInt(0, 300),
      valid: Math.random() > 0.05,
      summary: `[Modbus TCP] MODBUS ${msgType} func=${func} ${detail} unit=${unit}`,
    },
    body,
  };
}

function draftRaw(client: string, direction: Direction): PacketDraft {
  const body = new Uint8Array(randInt(40, 400));
  for (let i = 0; i < body.length; i++) body[i] = randInt(0, 255);
  return {
    packet: {
      direction,
      client,
      portName: "RAW",
      protocol: "RAW",
      msgType: "UNKNOWN",
      size: body.length,
      valid: Math.random() > 0.15,
      summary: `[RAW] HEXDUMP неопознанный трафик (${body.length} Б)`,
    },
    body,
  };
}

// ---------------------------------------------------------------------------
// Состояние хаба (синглтон на globalThis)
// ---------------------------------------------------------------------------

interface HubState {
  packets: Packet[];
  sessions: Map<string, Session>;
  alerts: Alert[];
  series: SeriesPoint[];
  listeners: Set<HubListener>;
  genTimer: ReturnType<typeof setInterval> | null;
  statsTimer: ReturnType<typeof setInterval> | null;
  sessionTimer: ReturnType<typeof setInterval> | null;
  epoch: number; // версия кода генератора (для перезапуска таймеров после HMR)
  nextPacketId: number;
  totalPackets: number;
  totalBytes: number;
  totalSessions: number;
  invalidPackets: number;
  perProtocol: Record<string, number>;
  methodCounter: Map<string, number>;
  clientCounter: Map<string, number>;
  secondPackets: number;
  secondBytes: number;
  rollbackTimes: number[];
  thriftSeq: number;
  startedAt: string;
  lastPps: number;
  lastBps: number;
  alertCooldown: Map<string, number>;
}

function createHubState(): HubState {
  return {
    packets: [],
    sessions: new Map(),
    alerts: [],
    series: [],
    listeners: new Set(),
    genTimer: null,
    statsTimer: null,
    sessionTimer: null,
    epoch: 0,
    nextPacketId: 1,
    totalPackets: 0,
    totalBytes: 0,
    totalSessions: 0,
    invalidPackets: 0,
    perProtocol: {},
    methodCounter: new Map(),
    clientCounter: new Map(),
    secondPackets: 0,
    secondBytes: 0,
    rollbackTimes: [],
    thriftSeq: 0,
    startedAt: new Date().toISOString(),
    lastPps: 0,
    lastBps: 0,
    alertCooldown: new Map(),
  };
}

const globalForHub = globalThis as unknown as {
  __snifferHubState?: HubState;
};

const S: HubState = globalForHub.__snifferHubState ?? createHubState();
globalForHub.__snifferHubState = S;

// Если состояние пережило HMR от предыдущей версии кода — останавливаем
// таймеры старых замыканий, чтобы новые версии tick()/makePacket() вступили в силу
const MODULE_EPOCH = 4;
if (S.epoch !== MODULE_EPOCH) {
  if (S.genTimer) {
    clearInterval(S.genTimer);
    S.genTimer = null;
  }
  if (S.statsTimer) {
    clearInterval(S.statsTimer);
    S.statsTimer = null;
  }
  if (S.sessionTimer) {
    clearInterval(S.sessionTimer);
    S.sessionTimer = null;
  }
  S.epoch = MODULE_EPOCH;
}

function emit(ev: HubEvent): void {
  for (const listener of S.listeners) {
    try {
      listener(ev);
    } catch {
      // слушатель мог отвалиться — игнорируем
    }
  }
}

function unref(timer: unknown): void {
  if (timer && typeof timer === "object" && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }
}

// ------------------------- сессии ------------------------------------------

const PROTOCOL_BY_PORT: Record<PortName, Protocol> = {
  "RemoteServer TCP": "REMOTE_SERVER",
  "Thrift RPC": "THRIFT",
  "HTTP API": "HTTP",
  "Modbus TCP": "MODBUS",
  RAW: "RAW",
};

function randomClientAddr(): string {
  return `${pick(CLIENT_POOL)}:${randInt(32768, 61000)}`;
}

function openSession(): void {
  const active = [...S.sessions.values()].filter((s) => s.state === "active");
  if (active.length >= 7) return;
  // Сначала добираем отсутствующие каналы, чтобы демо показывало все протоколы,
  // затем взвешенный выбор как в config.json
  const present = new Set(active.map((s) => s.portName));
  const missing = (Object.keys(PROTOCOL_BY_PORT) as PortName[]).filter(
    (p) => !present.has(p)
  );
  let portName: PortName;
  if (missing.length > 0 && (active.length < 5 || Math.random() < 0.5)) {
    portName = missing[Math.floor(Math.random() * missing.length)];
  } else {
    portName = weightedPick<PortName>([
      ["RemoteServer TCP", 45],
      ["Thrift RPC", 30],
      ["HTTP API", 15],
      ["Modbus TCP", 8],
      ["RAW", 2],
    ]);
  }
  // Подбираем свободный адрес (ip:port), до 5 попыток
  for (let attempt = 0; attempt < 5; attempt++) {
    const client = randomClientAddr();
    const key = `${client}|${portName}`;
    if (S.sessions.has(key)) continue;
    const session: Session = {
      id: newId(),
      client,
      portName,
      protocol: PROTOCOL_BY_PORT[portName],
      startedAt: new Date().toISOString(),
      txPackets: 0,
      rxPackets: 0,
      txBytes: 0,
      rxBytes: 0,
      state: "active",
    };
    S.sessions.set(key, session);
    S.totalSessions += 1;
    emit({ type: "session", payload: session });
    return;
  }
}

function maintainSessions(): void {
  const active = [...S.sessions.values()].filter((s) => s.state === "active");
  if (active.length < 3 && Math.random() < 0.7) openSession();
  else if (active.length < 7 && Math.random() < 0.3) openSession();
  if (active.length > 3 && Math.random() < 0.15) {
    const victim = pick(active);
    victim.state = "closing";
    emit({ type: "session", payload: victim });
    const key = [...S.sessions.entries()].find(
      ([, s]) => s.id === victim.id
    )?.[0];
    if (key) {
      setTimeout(() => {
        const s = S.sessions.get(key);
        if (s && s.state === "closing") {
          s.state = "closed";
          emit({ type: "session", payload: s });
          setTimeout(() => {
            if (S.sessions.get(key)?.state === "closed") S.sessions.delete(key);
          }, 5000);
        }
      }, 3000);
    }
  }
  // страховка от разрастания карты
  if (S.sessions.size > 60) {
    for (const [k, s] of S.sessions) {
      if (s.state === "closed") S.sessions.delete(k);
      if (S.sessions.size <= 40) break;
    }
  }
}

function trackSession(packet: Packet): void {
  const key = `${packet.client}|${packet.portName}`;
  let session = S.sessions.get(key);
  if (!session) {
    // Прямой ingest без сессии (fallback) — учитываем в счетчиках,
    // но не плодим новые сессии сверх лимита
    const activeCount = [...S.sessions.values()].filter(
      (s) => s.state === "active"
    ).length;
    if (activeCount >= 8) return;
    session = {
      id: newId(),
      client: packet.client,
      portName: packet.portName,
      protocol: packet.protocol,
      startedAt: packet.ts,
      txPackets: 0,
      rxPackets: 0,
      txBytes: 0,
      rxBytes: 0,
      state: "active",
    };
    S.sessions.set(key, session);
    S.totalSessions += 1;
    emit({ type: "session", payload: session });
  }
  if (packet.direction === "TX") {
    session.txPackets += 1;
    session.txBytes += packet.size;
  } else {
    session.rxPackets += 1;
    session.rxBytes += packet.size;
  }
}

// ------------------------- алерты ------------------------------------------

function raiseAlert(
  rule: string,
  severity: "info" | "warn" | "crit",
  message: string,
  packet?: Packet
): void {
  const alert: Alert = {
    id: newId(),
    rule,
    severity,
    message,
    protocol: packet?.protocol,
    client: packet?.client,
    packetId: packet?.id,
    createdAt: new Date().toISOString(),
  };
  S.alerts.push(alert);
  if (S.alerts.length > ALERTS_CAP) {
    S.alerts.splice(0, S.alerts.length - ALERTS_CAP);
  }
  emit({ type: "alert", payload: alert });
  // Персистентность — аналог capture/alerts.jsonl реального сниффера
  void db.snifferAlert
    .create({
      data: {
        rule: alert.rule,
        severity: alert.severity,
        message: alert.message,
        protocol: alert.protocol ?? null,
        client: alert.client ?? null,
        packetId: alert.packetId ?? null,
      },
    })
    .catch(() => undefined);
}

function checkAlertRules(packet: Packet): void {
  const now = Date.now();

  const fire = (rule: string, cooldownMs: number): boolean => {
    const last = S.alertCooldown.get(rule) ?? 0;
    if (now - last < cooldownMs) return false;
    S.alertCooldown.set(rule, now);
    return true;
  };

  // 1. Thrift EXCEPTION — crit
  if (packet.protocol === "THRIFT" && packet.msgType === "EXCEPTION") {
    if (fire("Thrift EXCEPTION", ALERT_COOLDOWN_MS)) {
      raiseAlert(
        "Thrift EXCEPTION",
        "crit",
        `Thrift-исключение в ${packet.method ?? "методе"}: TApplicationException (пакет #${packet.id})`,
        packet
      );
    }
  }

  // 2. Откат безналичной оплаты — crit, порог 2 за 60с
  if (packet.methodType === "CASHLESS_ROLLBACK") {
    S.rollbackTimes.push(now);
    S.rollbackTimes = S.rollbackTimes.filter(
      (t) => now - t <= ROLLBACK_WINDOW_MS
    );
    if (S.rollbackTimes.length >= ROLLBACK_THRESHOLD) {
      if (fire("Откат безналичной оплаты", ALERT_COOLDOWN_MS)) {
        S.rollbackTimes = [];
        raiseAlert(
          "Откат безналичной оплаты",
          "crit",
          `Обнаружено ${ROLLBACK_THRESHOLD} отката CASHLESS_ROLLBACK за ${ROLLBACK_WINDOW_MS / 1000}с — требуется проверка кассовой логики`,
          packet
        );
      }
    }
  }

  // 3. Гигантский пакет — warn
  if (packet.size > GIANT_SIZE) {
    if (fire("Гигантский пакет", ALERT_COOLDOWN_MS)) {
      raiseAlert(
        "Гигантский пакет",
        "warn",
        `Размер пакета ${(packet.size / 1_000_000).toFixed(2)} МБ превышает порог 1 000 000 Б`,
        packet
      );
    }
  }

  // 4. Ошибка БД в запросе — warn (DB_REQUEST + «error» в полезной нагрузке)
  if (
    packet.cmdType === "DB_REQUEST" &&
    packet.summary.toLowerCase().includes("error")
  ) {
    if (fire("Ошибка БД в запросе", ALERT_COOLDOWN_MS)) {
      raiseAlert(
        "Ошибка БД в запросе",
        "warn",
        `DB_REQUEST содержит «error» — вероятно, сбой выполнения SQL (пакет #${packet.id})`,
        packet
      );
    }
  }
}

// ------------------------- генератор ---------------------------------------

function makePacket(): Packet {
  // Пакет привязан к одной из активных сессий (как в реальном прокси):
  // стабильный клиент ip:port на время жизни сессии, протокол = канал сессии
  const active = [...S.sessions.values()].filter((s) => s.state === "active");
  const session = active.length > 0 ? pick(active) : null;
  const client = session ? session.client : randomClientAddr();
  const direction: Direction = Math.random() < 0.55 ? "TX" : "RX";
  const protocol: Protocol = session
    ? session.protocol
    : weightedPick<Protocol>([
        ["REMOTE_SERVER", 45],
        ["THRIFT", 30],
        ["HTTP", 10],
        ["JSON", 8],
        ["MODBUS", 5],
        ["RAW", 2],
      ]);

  let draft: PacketDraft;
  switch (protocol) {
    case "REMOTE_SERVER":
      draft = draftRemoteServer(client, direction);
      break;
    case "THRIFT": {
      const seqRef = { seq: S.thriftSeq };
      draft = draftThrift(client, direction, seqRef);
      S.thriftSeq = seqRef.seq;
      break;
    }
    case "HTTP":
      draft = draftHttp(client, direction);
      break;
    case "JSON":
      draft = draftJson(client, direction);
      break;
    case "MODBUS":
      draft = draftModbus(client, direction);
      break;
    default:
      draft = draftRaw(client, direction);
  }

  // редкие гигантские пакеты (~0.5%)
  if (Math.random() < 0.005) {
    draft.packet.size = randInt(1_100_000, 1_400_000);
  }

  return {
    id: S.nextPacketId++,
    ts: new Date().toISOString(),
    hexPreview: hexdump(draft.body, 128),
    ...draft.packet,
  };
}

function ingest(packet: Packet): void {
  S.packets.push(packet);
  if (S.packets.length > PACKETS_CAP) {
    S.packets.splice(0, S.packets.length - PACKETS_CAP);
  }
  S.totalPackets += 1;
  S.totalBytes += packet.size;
  S.secondPackets += 1;
  S.secondBytes += packet.size;
  if (!packet.valid) S.invalidPackets += 1;
  S.perProtocol[packet.protocol] = (S.perProtocol[packet.protocol] ?? 0) + 1;

  const methodKey =
    packet.methodType ?? packet.method ?? packet.msgType ?? packet.protocol;
  S.methodCounter.set(methodKey, (S.methodCounter.get(methodKey) ?? 0) + 1);
  S.clientCounter.set(packet.client, (S.clientCounter.get(packet.client) ?? 0) + 1);

  trackSession(packet);
  checkAlertRules(packet);
  emit({ type: "packet", payload: packet });
}

function tick(): void {
  ingest(makePacket());
  // Редкие всплески откатов безналичной оплаты (~2% тиков):
  // 2-3 пакета CASHLESS_ROLLBACK подряд — срабатывает правило алерта
  if (Math.random() < 0.02) {
    const burst = randInt(2, 3);
    const active = [...S.sessions.values()].filter((s) => s.state === "active");
    const rollbackClient =
      active.length > 0
        ? pick(active).client
        : randomClientAddr();
    for (let i = 0; i < burst; i++) {
      const d = draftRemoteServer(rollbackClient, "TX", { c: 200, d: 111 });
      ingest({
        id: S.nextPacketId++,
        ts: new Date().toISOString(),
        hexPreview: hexdump(d.body, 128),
        ...d.packet,
      });
    }
  }
}

function statsTick(): void {
  S.series.push({
    ts: new Date().toISOString(),
    pps: S.secondPackets,
    bps: S.secondBytes,
  });
  if (S.series.length > SERIES_CAP) {
    S.series.splice(0, S.series.length - SERIES_CAP);
  }
  S.lastPps = S.secondPackets;
  S.lastBps = S.secondBytes;
  S.secondPackets = 0;
  S.secondBytes = 0;
  emit({ type: "stats", payload: getStats() });
}

// ------------------------- публичный API -----------------------------------

export function getStats(): SnifferStats {
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }));

  return {
    startedAt: S.startedAt,
    uptimeSec: Math.floor(
      (Date.now() - new Date(S.startedAt).getTime()) / 1000
    ),
    totalPackets: S.totalPackets,
    totalBytes: S.totalBytes,
    activeSessions: [...S.sessions.values()].filter(
      (s) => s.state === "active"
    ).length,
    totalSessions: S.totalSessions,
    alertsCount: S.alerts.length,
    perProtocol: { ...S.perProtocol },
    topMethods: top(S.methodCounter, 8),
    topClients: top(S.clientCounter, 8),
    lastPps: S.lastPps,
    lastBps: S.lastBps,
    invalidPackets: S.invalidPackets,
  };
}

export function ensureRunning(): void {
  if (S.genTimer === null) {
    S.genTimer = setInterval(tick, GEN_INTERVAL_MS);
    unref(S.genTimer);
  }
  if (S.statsTimer === null) {
    S.statsTimer = setInterval(statsTick, 1000);
    unref(S.statsTimer);
  }
  if (S.sessionTimer === null) {
    S.sessionTimer = setInterval(maintainSessions, 7000);
    unref(S.sessionTimer);
    openSession();
    openSession();
    openSession();
  }
}

export function subscribe(listener: HubListener): () => void {
  ensureRunning();
  S.listeners.add(listener);
  return () => {
    S.listeners.delete(listener);
  };
}

export function getRecentPackets(limit = 200): Packet[] {
  return S.packets.slice(-limit).reverse();
}

export function getPacketById(id: number): Packet | undefined {
  return S.packets.find((p) => p.id === id);
}

export function getSessions(): Session[] {
  return [...S.sessions.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export function getLiveAlerts(limit = 100): Alert[] {
  return S.alerts.slice(-limit).reverse();
}

export function getSeries(): SeriesPoint[] {
  return [...S.series];
}

export function getFullHexdump(packet: Packet): string {
  // Для демо: синтезируем до 2КБ данных на основе packet.summary
  const header = new TextEncoder().encode(packet.summary);
  const total = Math.min(packet.size, 2048);
  const buf = new Uint8Array(total);
  buf.set(header.subarray(0, Math.min(header.length, total)), 0);
  // магия RemoteServer в начале, если применимо
  if (packet.protocol === "REMOTE_SERVER") {
    buf[4] = 0xaa;
    buf[5] = 0xaa;
    buf[6] = 0x00;
    buf[7] = 0x00;
  }
  for (let i = Math.min(header.length, total); i < total; i++) {
    buf[i] = randInt(0, 255);
  }
  return hexdump(buf);
}

export async function resetHub(): Promise<void> {
  S.packets.length = 0;
  S.sessions.clear();
  S.alerts.length = 0;
  S.series.length = 0;
  S.nextPacketId = 1;
  S.totalPackets = 0;
  S.totalBytes = 0;
  S.totalSessions = 0;
  S.invalidPackets = 0;
  S.perProtocol = {};
  S.methodCounter.clear();
  S.clientCounter.clear();
  S.secondPackets = 0;
  S.secondBytes = 0;
  S.rollbackTimes = [];
  S.alertCooldown.clear();
  S.startedAt = new Date().toISOString();
  S.lastPps = 0;
  S.lastBps = 0;
  ensureRunning();
  openSession();
  openSession();
  openSession();
}
