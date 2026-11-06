import { readFileSync } from "node:fs";
import path from "node:path";

import type { PnlItem, Store } from "./metrics/types.js";

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

export interface SeedData {
  readonly meta: SeedMeta;
  readonly pnl: readonly PnlItem[];
  readonly stores: readonly Store[];
  readonly pnlSheet: string;
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

  cache = {
    meta,
    pnlSheet: pnlFile.provenance?.sheet ?? "",
    pnl: pnlFile.items.map((item) => ({ item: item.item, values: item.values })),
    stores: storeFile.items.map((item) => ({
      id: item.id,
      name: item.name,
      region: item.region,
      isNew: item.is_new,
      revenue: item.revenue,
    })),
  };
  return cache;
}
