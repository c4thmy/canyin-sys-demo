import { readFileSync } from "node:fs";

import type {
  Category,
  Channel,
  FunnelCounts,
  PnlItem,
  Store,
} from "../types.js";

/**
 * 测试夹具：从 data/seed/*.json 读取真实样例数据，并转换为指标引擎的领域类型。
 * 引擎本身不读文件；这里只服务于单测与手算对照。
 */

interface SeedFile<T> {
  readonly items: readonly T[];
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

interface RawCategory {
  readonly id: string;
  readonly name: string;
  readonly qty: Record<string, number>;
  readonly unit_price: Record<string, number>;
  readonly revenue: Record<string, number>;
  readonly cost?: Record<string, number>;
}

interface RawFunnelRecord {
  readonly store_id: string;
  readonly month: string;
  readonly exposure: number | null;
  readonly visits: number | null;
  readonly payments: number | null;
  readonly consumers: number | null;
}

interface RawPnlItem {
  readonly item: string;
  readonly values: Record<string, number>;
  readonly derived: string | null;
}

/** data/seed 目录（从 app/lib/metrics/__tests__/ 回溯到仓库根） */
const SEED_DIR = new URL("../../../../data/seed/", import.meta.url);

function readSeed<T>(fileName: string): readonly T[] {
  const parsed = JSON.parse(readFileSync(new URL(fileName, SEED_DIR), "utf8")) as SeedFile<T>;
  if (!Array.isArray(parsed.items)) {
    throw new Error(`data/seed/${fileName} 缺少 items 数组`);
  }
  return parsed.items;
}

const rawStores = readSeed<RawStore>("stores.json");
const rawChannels = readSeed<RawChannel>("channels.json");
const rawCategories = readSeed<RawCategory>("categories.json");
const rawFunnel = readSeed<RawFunnelRecord>("funnel.json");
const rawPnl = readSeed<RawPnlItem>("pnl.json");

/** 15 家门店（含 2 家新店） */
export const stores: readonly Store[] = rawStores.map((item) => ({
  id: item.id,
  name: item.name,
  region: item.region,
  isNew: item.is_new,
  revenue: item.revenue,
}));

/** 10 个渠道 */
export const channels: readonly Channel[] = rawChannels.map((item) => ({
  name: item.name,
  revenue: item.revenue,
}));

/** 8 个产品系列 */
export const categories: readonly Category[] = rawCategories.map((item) => ({
  id: item.id,
  name: item.name,
  qty: item.qty,
  unitPrice: item.unit_price,
  revenue: item.revenue,
  cost: item.cost,
}));

/** 9 项利润表数据 */
export const pnl: readonly PnlItem[] = rawPnl.map((item) => ({
  item: item.item,
  values: item.values,
}));

/** 13 家在营门店的线上漏斗记录 */
export const funnelRecords: readonly (FunnelCounts & { storeId: string })[] = rawFunnel.map(
  (item) => ({
    storeId: item.store_id,
    exposure: item.exposure,
    visits: item.visits,
    payments: item.payments,
    consumers: item.consumers,
  }),
);

/** 按门店编号取漏斗记录 */
export function funnelByStore(storeId: string): FunnelCounts & { storeId: string } {
  const record = funnelRecords.find((item) => item.storeId === storeId);
  if (!record) {
    throw new Error(`funnel.json 中找不到门店 ${storeId}`);
  }
  return record;
}

/** 汇总多个漏斗记录的四级人数；空值跳过（仅用于测试） */
export function sumFunnel(records: readonly FunnelCounts[]): FunnelCounts {
  const add = (pick: (record: FunnelCounts) => number | null): number | null => {
    let total: number | null = null;
    for (const record of records) {
      const value = pick(record);
      if (value !== null) {
        total = (total ?? 0) + value;
      }
    }
    return total;
  };
  return {
    exposure: add((record) => record.exposure),
    visits: add((record) => record.visits),
    payments: add((record) => record.payments),
    consumers: add((record) => record.consumers),
  };
}
