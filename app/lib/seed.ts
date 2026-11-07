import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { datasetDir, hasImportedDataset, readActive, type DatasetKind } from "./ingestion/active.js";

import type {
  AcquisitionRecord,
  Bundle,
  Category,
  Channel,
  FunnelCounts,
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

interface RawCategory {
  readonly id: string;
  readonly name: string;
  readonly qty: Record<string, number>;
  readonly unit_price: Record<string, number>;
  readonly revenue: Record<string, number>;
  readonly cost?: Record<string, number>;
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

interface RawAcquisition {
  readonly channel: string;
  readonly new_customers: number;
  readonly ticket: number;
  readonly gross_margin_rate: number;
  readonly new_customer_cost: number;
  readonly target_roi: number;
}

interface RawBundle {
  readonly id: string;
  readonly name: string;
  readonly qty: Record<string, number | null>;
  readonly amount: Record<string, number | null>;
  readonly discount?: Record<string, number | null>;
}

interface RawFunnelRecord extends FunnelCounts {
  readonly store_id: string;
  readonly month: string;
}

/** 线上渠道漏斗记录：只取四级人数用于汇总与逐店明细 */
export interface SeedFunnelRecord extends FunnelCounts {
  readonly storeId: string;
  readonly month: string;
}

export interface SeedData {
  /** 数据来源：演示数据或用户导入数据 */
  readonly dataset: DatasetKind;
  readonly meta: SeedMeta;
  readonly pnl: readonly PnlItem[];
  readonly stores: readonly Store[];
  readonly channels: readonly Channel[];
  readonly categories: readonly Category[];
  readonly traffic: readonly StoreTrafficRecord[];
  readonly timeSlots: readonly TimeSlotRecord[];
  readonly acquisitions: readonly AcquisitionRecord[];
  readonly bundles: readonly Bundle[];
  readonly funnel: readonly SeedFunnelRecord[];
  readonly pnlSheet: string;
  readonly storeSheet: string;
  readonly channelSheet: string;
  readonly categorySheet: string;
  readonly trafficSheet: string;
  readonly timeSlotSheet: string;
  readonly acquisitionSheet: string;
  readonly bundleSheet: string;
  readonly funnelSheet: string;
}

const SEED_DIR = path.join(process.cwd(), "data", "seed");

/** 当前激活的数据集：未导入或导入目录缺失时回落到演示数据 */
export function activeDataset(): { kind: DatasetKind; version: number; dir: string } {
  const active = readActive();
  if (active.dataset === "imported" && hasImportedDataset()) {
    return { kind: "imported", version: active.version, dir: datasetDir() };
  }
  return { kind: "demo", version: active.version, dir: SEED_DIR };
}

function readSeedFile<T>(dir: string, name: string): T {
  const file = path.join(dir, name);
  if (!existsSync(file)) {
    // 导入数据集里未开放导入的数据（时段、获客、套餐）按空表处理
    return { items: [] } as T;
  }
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

let cache: { key: string; data: SeedData } | undefined;

/**
 * 服务端读取当前激活数据集（data/seed 或 data/uploads/dataset）。
 * 缓存按「数据集 + 版本号」失效：导入、回滚、切换数据集后自动重读。
 */
export function loadSeed(): SeedData {
  const { kind, version, dir } = activeDataset();
  const key = `${kind}:${version}`;
  if (cache?.key === key) {
    return cache.data;
  }
  const data = readDataset(dir, kind);
  cache = { key, data };
  return data;
}

function readDataset(dir: string, kind: DatasetKind): SeedData {
  const meta = readSeedFile<SeedMeta>(dir, "meta.json");
  const pnlFile = readSeedFile<SeedFile<RawPnlItem>>(dir, "pnl.json");
  const storeFile = readSeedFile<SeedFile<RawStore>>(dir, "stores.json");
  const channelFile = readSeedFile<SeedFile<RawChannel>>(dir, "channels.json");
  const categoryFile = readSeedFile<SeedFile<RawCategory>>(dir, "categories.json");
  const trafficFile = readSeedFile<SeedFile<RawTraffic>>(dir, "traffic.json");
  const timeSlotFile = readSeedFile<SeedFile<RawTimeSlot>>(dir, "time_slots.json");
  const acquisitionFile = readSeedFile<SeedFile<RawAcquisition>>(dir, "acquisition.json");
  const bundleFile = readSeedFile<SeedFile<RawBundle>>(dir, "bundles.json");
  const funnelFile = readSeedFile<SeedFile<RawFunnelRecord>>(dir, "funnel.json");

  return {
    dataset: kind,
    meta,
    pnlSheet: pnlFile.provenance?.sheet ?? "",
    storeSheet: storeFile.provenance?.sheet ?? "",
    channelSheet: channelFile.provenance?.sheet ?? "",
    categorySheet: categoryFile.provenance?.sheet ?? "",
    trafficSheet: trafficFile.provenance?.sheet ?? "",
    timeSlotSheet: timeSlotFile.provenance?.sheet ?? "",
    acquisitionSheet: acquisitionFile.provenance?.sheet ?? "",
    bundleSheet: bundleFile.provenance?.sheet ?? "",
    funnelSheet: funnelFile.provenance?.sheet ?? "",
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
    categories: categoryFile.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unit_price,
      revenue: item.revenue,
      cost: item.cost,
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
    acquisitions: acquisitionFile.items.map((item) => ({
      channel: item.channel,
      newCustomers: item.new_customers,
      ticket: item.ticket,
      grossMarginRate: item.gross_margin_rate,
      newCustomerCost: item.new_customer_cost,
      targetRoi: item.target_roi,
    })),
    bundles: bundleFile.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      amount: item.amount,
      discount: item.discount,
    })),
    funnel: funnelFile.items.map((item) => ({
      storeId: item.store_id,
      month: item.month,
      exposure: item.exposure,
      visits: item.visits,
      payments: item.payments,
      consumers: item.consumers,
    })),
  };
}
