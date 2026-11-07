import { analysisPeriods, completeness, type CompletenessRow } from "./dataset-status.js";
import { formatAmount, formatInteger, formatSignedPercent } from "./format.js";
import { PNL_ITEMS } from "./metrics/profit-bridge.js";
import { loadSeed, type SeedData, type SeedPeriod } from "./seed.js";

/**
 * 数据看板：多期 KPI 趋势、同比 / 环比、门店排行与数据完整度。
 * 口径见 docs/domain/revenue-analysis-model.md 第 11.4 节。
 */

export type KpiKey = "revenue" | "traffic" | "ticket" | "profit";

export interface TrendPoint {
  readonly period: string;
  readonly label: string;
  /** 该期间无数据时为 null */
  readonly value: number | null;
}

export interface KpiView {
  readonly key: KpiKey;
  readonly label: string;
  readonly unit: string;
  readonly current: number | null;
  readonly value: string;
  readonly yoy: number | null;
  readonly mom: number | null;
  readonly yoyText: string;
  readonly momText: string;
  /** 同比 / 环比显示「—」时的原因 */
  readonly note: string | null;
  readonly trend: readonly TrendPoint[];
}

export interface StoreRankRow {
  readonly rank: number;
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly isNew: boolean;
  readonly revenue: number;
  readonly yoy: number | null;
  readonly share: number;
}

export interface DashboardView {
  readonly dataset: SeedData["dataset"];
  readonly sourceFile: string;
  readonly unit: string;
  /** 数据集为空时为 null */
  readonly current: SeedPeriod | null;
  readonly previous: SeedPeriod | null;
  readonly headerPeriods: readonly SeedPeriod[];
  readonly periods: readonly SeedPeriod[];
  readonly kpis: readonly KpiView[];
  readonly stores: readonly StoreRankRow[];
  readonly completeness: { readonly periods: readonly SeedPeriod[]; readonly rows: readonly CompletenessRow[] };
}

function shiftMonth(period: string, months: number): string {
  const [year, month] = period.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function sumDefined(values: readonly (number | undefined)[]): number | null {
  const defined = values.filter((value): value is number => typeof value === "number");
  return defined.length === 0 ? null : defined.reduce((sum, value) => sum + value, 0);
}

/** 各指标在某期间的值；无数据返回 null */
export function kpiValue(seed: SeedData, key: KpiKey, period: string): number | null {
  switch (key) {
    case "revenue":
      return sumDefined(seed.stores.map((store) => store.revenue[period]));
    case "traffic":
      return sumDefined(seed.traffic.map((record) => record.traffic[period]));
    case "ticket": {
      // 只用同时有客流与收入的门店，按客流加权
      let revenue = 0;
      let traffic = 0;
      const byStore = new Map(seed.stores.map((store) => [store.id, store]));
      for (const record of seed.traffic) {
        const flow = record.traffic[period];
        const income = byStore.get(record.storeId)?.revenue[period];
        if (typeof flow === "number" && typeof income === "number" && flow > 0) {
          traffic += flow;
          revenue += income;
        }
      }
      return traffic === 0 ? null : (revenue * 10_000) / traffic;
    }
    case "profit": {
      const items = new Map(seed.pnl.map((item) => [item.item, item.values[period]]));
      if (PNL_ITEMS.some((item) => typeof items.get(item) !== "number")) {
        return null;
      }
      const [revenue, ...costs] = PNL_ITEMS.map((item) => items.get(item) as number);
      return costs.reduce((profit, cost) => profit - cost, revenue);
    }
  }
}

function changeRate(current: number | null, base: number | null): number | null {
  if (current === null || base === null || base === 0) {
    return null;
  }
  return (current - base) / Math.abs(base);
}

const KPI_META: Record<KpiKey, { label: string; unit: string; format: (value: number) => string }> = {
  revenue: { label: "门店收入", unit: "万元", format: formatAmount },
  traffic: { label: "客流", unit: "人次", format: formatInteger },
  ticket: { label: "客单价", unit: "元", format: formatAmount },
  profit: { label: "营业利润", unit: "万元", format: formatAmount },
};

function buildKpi(seed: SeedData, key: KpiKey, periods: readonly SeedPeriod[], current: SeedPeriod | null): KpiView {
  const meta = KPI_META[key];
  const trend = periods.map((period) => ({ period: period.id, label: period.label, value: kpiValue(seed, key, period.id) }));
  if (!current) {
    return { key, ...meta, current: null, value: "—", yoy: null, mom: null, yoyText: "—", momText: "—", note: "数据集为空", trend };
  }
  const value = kpiValue(seed, key, current.id);
  const lastYear = kpiValue(seed, key, shiftMonth(current.id, -12));
  const lastMonth = kpiValue(seed, key, shiftMonth(current.id, -1));
  const yoy = changeRate(value, lastYear);
  const mom = changeRate(value, lastMonth);

  const reasons: string[] = [];
  if (value === null) {
    reasons.push("本期无数据");
  } else {
    if (yoy === null) {
      reasons.push(lastYear === null ? "无上年同期数据" : "上年同期为 0");
    }
    if (mom === null) {
      reasons.push(lastMonth === null ? "无上月数据" : "上月为 0");
    }
  }
  return {
    key,
    label: meta.label,
    unit: meta.unit,
    current: value,
    value: value === null ? "—" : meta.format(value),
    yoy,
    mom,
    yoyText: formatSignedPercent(yoy),
    momText: formatSignedPercent(mom),
    note: reasons.length > 0 ? reasons.join("；") : null,
    trend,
  };
}

export function buildDashboardView(): DashboardView {
  const seed = loadSeed();
  const selected = analysisPeriods(seed);
  const periods = [...seed.meta.periods].sort((a, b) => a.id.localeCompare(b.id));
  const current = selected?.current ?? null;

  const kpis = (["revenue", "traffic", "ticket", "profit"] as const).map((key) => buildKpi(seed, key, periods, current));

  const stores: StoreRankRow[] = [];
  if (current) {
    const previousId = shiftMonth(current.id, -12);
    const total = seed.stores.reduce((sum, store) => sum + (store.revenue[current.id] ?? 0), 0);
    seed.stores
      .filter((store) => typeof store.revenue[current.id] === "number")
      .map((store) => ({ store, revenue: store.revenue[current.id] as number }))
      .sort((a, b) => b.revenue - a.revenue || a.store.id.localeCompare(b.store.id))
      .forEach(({ store, revenue }, index) =>
        stores.push({
          rank: index + 1,
          id: store.id,
          name: store.name,
          region: store.region,
          isNew: store.isNew,
          revenue,
          yoy: store.isNew ? null : changeRate(revenue, store.revenue[previousId] ?? null),
          share: total === 0 ? 0 : revenue / total,
        }),
      );
  }

  return {
    dataset: seed.dataset,
    sourceFile: seed.meta.source_file,
    unit: seed.meta.currency_unit,
    current,
    previous: selected?.previous ?? null,
    headerPeriods: selected?.periods ?? [],
    periods,
    kpis,
    stores,
    completeness: completeness(seed),
  };
}
