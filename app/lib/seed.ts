import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  Channel,
  PnlItem,
  Store,
  StoreTrafficRecord,
  TimeSlotRecord,
} from "./metrics/types.js";

export interface SeedPeriod {
  readonly id: string;
  readonly label: string;
}

export interface SeedMeta {
  readonly source_file: string;
  readonly extracted_at: string;
  readonly periods: readonly SeedPeriod[];
  readonly currency_unit: string;
}

interface SeedFile<T> {
  readonly provenance?: { readonly sheet: string; readonly range: string };
  readonly items: readonly T[];
}

interface RawPnlItem {
  readonly item: string;
  readonly values: Record<string, number>;
  readonly derived: string | null;
}

interface RawStore {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly is_new: boolean;
  readonly revenue: Record<string, number>;
}

interface RawChannel {
  readonly name: string;
  readonly revenue: Record<string, number>;
}

interface RawTraffic {
  readonly store_id: string;
  readonly name: string;
  readonly traffic: Record<string, number>;
  readonly ticket: Record<string, number>;
}

interface RawTimeSlot {
  readonly day_type: string;
  readonly segment: string;
  readonly span: string;
  readonly traffic: Record<string, number>;
}

export interface SeedData {
  readonly meta: SeedMeta;
  readonly pnl: readonly PnlItem[];
  readonly stores: readonly Store[];
  readonly channels: readonly Channel[];
  readonly traffic: readonly StoreTrafficRecord[];
  readonly timeSlots: readonly TimeSlotRecord[];
  readonly pnlSheet: string;
  readonly storeSheet: string;
  readonly channelSheet: string;
  readonly trafficSheet: string;
  readonly timeSlotSheet: string;
}

const SEED_DIR = path.join(process.cwd(), "data", "seed");

function readSeedFile<T>(name: string): T {
  const file = path.join(SEED_DIR, name);
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

let cache: SeedData | undefined;

/** 服务端读取 data/seed/*.json；同一进程内只读一次 */
export function loadSeed(): SeedData {
  if (cache) {
    return cache;
  }

  const meta = readSeedFile<SeedMeta>("meta.json");
  const pnlFile = readSeedFile<SeedFile<RawPnlItem>>("pnl.json");
  const storeFile = readSeedFile<SeedFile<RawStore>>("stores.json");
  const channelFile = readSeedFile<SeedFile<RawChannel>>("channels.json");
  const trafficFile = readSeedFile<SeedFile<RawTraffic>>("traffic.json");
  const timeSlotFile = readSeedFile<SeedFile<RawTimeSlot>>("time_slots.json");

  cache = {
    meta,
    pnlSheet: pnlFile.provenance?.sheet ?? "",
    storeSheet: storeFile.provenance?.sheet ?? "",
    channelSheet: channelFile.provenance?.sheet ?? "",
    trafficSheet: trafficFile.provenance?.sheet ?? "",
    timeSlotSheet: timeSlotFile.provenance?.sheet ?? "",
    pnl: pnlFile.items.map((item) => ({ item: item.item, values: item.values })),
    stores: storeFile.items.map((item) => ({
      id: item.id,
      name: item.name,
      region: item.region,
      isNew: item.is_new,
      revenue: item.revenue,
    })),
    channels: channelFile.items.map((item) => ({
      name: item.name,
      revenue: item.revenue,
    })),
    traffic: trafficFile.items.map((item) => ({
      storeId: item.store_id,
      name: item.name,
      traffic: item.traffic,
      ticket: item.ticket,
    })),
    timeSlots: timeSlotFile.items.map((item) => ({
      dayType: item.day_type,
      segment: item.segment,
      span: item.span,
      traffic: item.traffic,
    })),
  };
  return cache;
}
