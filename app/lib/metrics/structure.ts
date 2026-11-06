import { amountFor, resolvePeriodPair } from "./period.js";
import type { PeriodInput, RegionStructure, Store, StoreStructureRow } from "./types.js";

function deltaRate(delta: number, base: number): number | null {
  return base === 0 ? null : delta / base;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * 门店维度的收入结构：
 * - 本期 / 上期 / 同比差额 / 增减率；
 * - 占同店比 = 本期收入 ÷ 13 家同店本期收入合计，新店为 null；
 * - 同店排名按本期收入降序，同额按门店名升序，新店为 null；
 * - 输出按同比差额降序（结构页默认排序）。
 */
export function storeStructure(stores: readonly Store[], period: PeriodInput): StoreStructureRow[] {
  const { current, previous } = resolvePeriodPair(period);
  const sameStores = stores.filter((store) => !store.isNew);
  const sameStoreTotal = sum(sameStores.map((store) => amountFor(store.revenue, current)));
  const ranked = [...sameStores].sort(
    (a, b) =>
      amountFor(b.revenue, current) - amountFor(a.revenue, current) ||
      a.name.localeCompare(b.name, "zh-Hans-CN"),
  );
  const rankOf = new Map(ranked.map((store, index) => [store.id, index + 1]));

  return stores
    .map((store): StoreStructureRow => {
      const revenue = amountFor(store.revenue, current);
      const prevRevenue = amountFor(store.revenue, previous);
      const delta = revenue - prevRevenue;
      return {
        id: store.id,
        name: store.name,
        region: store.region,
        isNew: store.isNew,
        revenue,
        prevRevenue,
        delta,
        deltaRate: deltaRate(delta, prevRevenue),
        sameStoreShare:
          store.isNew || sameStoreTotal === 0 ? null : revenue / sameStoreTotal,
        sameStoreRank: store.isNew ? null : (rankOf.get(store.id) ?? null),
      };
    })
    .sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

/**
 * 区域维度：区域汇总 + 成员门店。
 * 区域顺序按区域名升序（区域一 → 区域二 → 区域三）；区域内门店沿用门店行的差额降序。
 */
export function regionStructure(stores: readonly Store[], period: PeriodInput): RegionStructure[] {
  const rows = storeStructure(stores, period);
  const totalRevenue = sum(rows.map((row) => row.revenue));
  const buckets = new Map<string, StoreStructureRow[]>();
  const order = new Map<string, number>();

  for (const [index, store] of stores.entries()) {
    if (!order.has(store.region)) {
      order.set(store.region, index);
    }
  }

  for (const row of rows) {
    const bucket = buckets.get(row.region) ?? [];
    bucket.push(row);
    buckets.set(row.region, bucket);
  }

  return [...buckets.entries()]
    .map(([key, regionStores]): RegionStructure => {
      const revenue = sum(regionStores.map((row) => row.revenue));
      const prevRevenue = sum(regionStores.map((row) => row.prevRevenue));
      const delta = revenue - prevRevenue;
      return {
        key,
        revenue,
        prevRevenue,
        delta,
        deltaRate: deltaRate(delta, prevRevenue),
        share: totalRevenue === 0 ? 0 : revenue / totalRevenue,
        stores: regionStores,
      };
    })
    .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
}
