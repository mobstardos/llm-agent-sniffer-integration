/**
 * Общая логика фильтрации пакетов сниффера — используется роутами
 * /api/sniffer/packets (таблица + инспектор сессий) и /api/sniffer/export
 * (экспорт «только отфильтрованного»). Единая семантика условий.
 */

import type { Packet } from "@/lib/sniffer/hub";

export interface PacketFilterParams {
  search?: string;
  protocol?: string;
  direction?: string;
  minSize?: string;
  maxSize?: string;
  /** точный адрес клиента ip:port (инспектор сессий) */
  client?: string;
  /** точное имя канала (инспектор сессий) */
  port?: string;
}

/** Разбор параметров фильтра из URL (fetch-строки таблицы / экспорта). */
export function packetFilterFromSearchParams(sp: URLSearchParams): PacketFilterParams {
  return {
    search: sp.get("search") ?? undefined,
    protocol: sp.get("protocol") ?? undefined,
    direction: sp.get("direction") ?? undefined,
    minSize: sp.get("minSize") ?? undefined,
    maxSize: sp.get("maxSize") ?? undefined,
    client: sp.get("client") ?? undefined,
    port: sp.get("port") ?? undefined,
  };
}

/** Есть ли хоть одно условие фильтра (кроме пустых «all»). */
export function hasActiveFilter(f: PacketFilterParams): boolean {
  return Boolean(
    (f.search ?? "").trim() ||
      (f.protocol ?? "").trim() ||
      (f.direction ?? "").trim() ||
      (f.minSize ?? "").trim() ||
      (f.maxSize ?? "").trim() ||
      (f.client ?? "").trim() ||
      (f.port ?? "").trim()
  );
}

export function filterPackets<T extends Packet>(packets: T[], f: PacketFilterParams): T[] {
  const search = (f.search ?? "").trim().toLowerCase();
  const protocol = (f.protocol ?? "").trim();
  const direction = (f.direction ?? "").trim();
  const minSize = parseInt((f.minSize ?? "").trim(), 10);
  const maxSize = parseInt((f.maxSize ?? "").trim(), 10);
  const client = (f.client ?? "").trim();
  const port = (f.port ?? "").trim();

  return packets.filter((p) => {
    if (protocol && protocol !== "all" && p.protocol !== protocol) return false;
    if (direction && direction !== "all" && p.direction !== direction) return false;
    if (!Number.isNaN(minSize) && p.size < minSize) return false;
    if (!Number.isNaN(maxSize) && p.size > maxSize) return false;
    if (client && p.client !== client) return false;
    if (port && p.portName !== port) return false;
    if (search) {
      const hay = `${p.summary} ${p.method ?? ""} ${p.methodType ?? ""} ${p.cmdType ?? ""} ${p.client} ${p.protocol} ${p.portName}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}
