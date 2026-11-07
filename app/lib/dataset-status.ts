import { PNL_ITEMS } from "./metrics/profit-bridge.js";
import { resolvePeriodPair } from "./metrics/period.js";
import { TEMPLATES, type TemplateType } from "./ingestion/templates.js";
import type { SeedData, SeedPeriod } from "./seed.js";

/**
 * 数据集状态：分析期间选择 + 完整度矩阵。
 *
 * 口径（见领域模型第 11 节）：
 * - 本期 = 数据集中最新的月份；上年同期 = 本期往前 12 个月。
 * - 某模板在某期间「有数据」：该期间至少有一行（利润表要求 9 个科目齐全）。
 * - 页面所需模板在本期或上年同期缺数据，页面显示「数据不完整」并给出导入入口。
 */

export interface AnalysisPeriods {
  readonly current: SeedPeriod;
  readonly previous: SeedPeriod;
  readonly periods: readonly SeedPeriod[];
}

export type PageKey = "overview" | "structure" | "same-store" | "store" | "channel" | "product" | "insights";

/** 每个页面依赖的模板：两期都必须有数据 */
export const PAGE_REQUIREMENTS: Record<PageKey, readonly TemplateType[]> = {
  overview: ["pnl", "store_revenue"],
  structure: ["store_revenue", "channel_revenue"],
  "same-store": ["store_revenue", "store_traffic"],
  store: ["store_revenue", "store_traffic"],
  channel: ["channel_revenue", "store_revenue"],
  product: ["product_sales"],
  insights: ["pnl", "store_revenue", "channel_revenue", "product_sales", "store_traffic"],
};

function labelOf(id: string): string {
  const [year, month] = id.split("-");
  return `${year}年${Number(month)}月`;
}

/** 选出本期与上年同期；数据集为空时返回 null */
export function analysisPeriods(seed: SeedData): AnalysisPeriods | null {
  const periods = [...seed.meta.periods].sort((a, b) => a.id.localeCompare(b.id));
  const latest = periods[periods.length - 1];
  if (!latest) {
    return null;
  }
  const pair = resolvePeriodPair(latest.id);
  const previous = periods.find((period) => period.id === pair.previous) ?? {
    id: pair.previous,
    label: labelOf(pair.previous),
  };
  // 页头只展示参与对比的两期
  return { current: latest, previous, periods: [previous, latest] };
}

function hasKey(values: Readonly<Record<string, unknown>> | undefined, period: string): boolean {
  return values !== undefined && values[period] !== undefined && values[period] !== null;
}

/** 某模板在某期间是否有数据 */
export function hasData(seed: SeedData, type: TemplateType, period: string): boolean {
  switch (type) {
    case "store_revenue":
      return seed.stores.some((store) => hasKey(store.revenue, period));
    case "store_traffic":
      return seed.traffic.some((record) => hasKey(record.traffic, period));
    case "channel_revenue":
      return seed.channels.some((channel) => hasKey(channel.revenue, period));
    case "product_sales":
      return seed.categories.some((category) => hasKey(category.qty, period));
    case "pnl": {
      const items = new Map(seed.pnl.map((item) => [item.item, item.values]));
      return PNL_ITEMS.every((item) => hasKey(items.get(item), period));
    }
    case "online_funnel":
      return seed.funnel.some((record) => record.month === period);
  }
}

/** 新店上年同期没有收入是正常的；门店客流、门店收入的上年同期只要求同店有数据 */
function hasPreviousData(seed: SeedData, type: TemplateType, period: string): boolean {
  if (type === "store_revenue") {
    return seed.stores.some((store) => !store.isNew && hasKey(store.revenue, period));
  }
  return hasData(seed, type, period);
}

export interface MissingData {
  readonly type: TemplateType;
  readonly name: string;
  readonly period: SeedPeriod;
}

/** 页面缺失的数据；空数组表示页面可以正常渲染 */
export function missingFor(seed: SeedData, page: PageKey): MissingData[] {
  const periods = analysisPeriods(seed);
  if (!periods) {
    return PAGE_REQUIREMENTS[page].map((type) => ({
      type,
      name: TEMPLATES.find((template) => template.type === type)?.name ?? type,
      period: { id: "—", label: "任一期间" },
    }));
  }
  const missing: MissingData[] = [];
  for (const type of PAGE_REQUIREMENTS[page]) {
    const name = TEMPLATES.find((template) => template.type === type)?.name ?? type;
    if (!hasData(seed, type, periods.current.id)) {
      missing.push({ type, name, period: periods.current });
    }
    if (!hasPreviousData(seed, type, periods.previous.id)) {
      missing.push({ type, name, period: periods.previous });
    }
  }
  // 门店客流要覆盖每一家门店：decomposeStoreTraffic 逐店取客流
  if (PAGE_REQUIREMENTS[page].includes("store_traffic") && missing.length === 0) {
    const covered = new Set(seed.traffic.map((record) => record.storeId));
    if (seed.stores.some((store) => !covered.has(store.id))) {
      missing.push({ type: "store_traffic", name: "门店客流", period: periods.current });
    }
  }
  return missing;
}

export interface CompletenessCell {
  readonly period: string;
  readonly present: boolean;
}

export interface CompletenessRow {
  readonly type: TemplateType;
  readonly name: string;
  readonly cells: readonly CompletenessCell[];
}

/** 完整度矩阵：6 套模板 × 数据集中全部期间（至少包含本期与上年同期） */
export function completeness(seed: SeedData): { periods: readonly SeedPeriod[]; rows: readonly CompletenessRow[] } {
  const ids = new Set(seed.meta.periods.map((period) => period.id));
  const pair = analysisPeriods(seed);
  if (pair) {
    ids.add(pair.previous.id);
  }
  const periods = [...ids].sort().map((id) => seed.meta.periods.find((period) => period.id === id) ?? { id, label: labelOf(id) });
  const rows = TEMPLATES.map((template) => ({
    type: template.type,
    name: template.name,
    cells: periods.map((period) => ({ period: period.id, present: hasData(seed, template.type, period.id) })),
  }));
  return { periods, rows };
}
