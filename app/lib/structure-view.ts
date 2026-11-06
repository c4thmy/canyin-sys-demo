import {
  aggregate,
  regionStructure,
  splitSameNewStore,
  storeStructure,
} from "./metrics/index.js";
import type { AggregateGroup, PeriodPair, RegionStructure, StoreStructureRow } from "./metrics/types.js";
import { loadSeed } from "./seed.js";

export interface StructureSplitCard {
  readonly key: "sameStore" | "newStore" | "total";
  readonly label: string;
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
  readonly deltaRate: number | null;
  /** 本期收入占全部门店收入比重 */
  readonly share: number;
  readonly storeCount: number;
}

export interface StructureView {
  readonly currentId: string;
  readonly previousId: string;
  readonly currentLabel: string;
  readonly previousLabel: string;
  readonly unit: string;
  readonly split: {
    readonly sameStore: StructureSplitCard;
    readonly newStore: StructureSplitCard;
    readonly total: StructureSplitCard;
  };
  readonly stores: readonly StoreStructureRow[];
  readonly regions: readonly RegionStructure[];
  readonly channels: readonly AggregateGroup[];
  readonly channelTotal: { readonly current: number; readonly previous: number };
  readonly counts: {
    readonly sameStore: number;
    readonly newStore: number;
    readonly total: number;
    readonly channels: number;
    readonly regions: number;
  };
}

/** 组装收入结构页的数据：同店/新店、渠道、区域、门店四个维度，全部来自 data/seed */
export function buildStructureView(): StructureView {
  const seed = loadSeed();
  const periods = [...seed.meta.periods].sort((a, b) => a.id.localeCompare(b.id));
  if (periods.length < 2) {
    throw new Error("meta.json 至少需要两个期间才能做同比");
  }
  const previous = periods[0];
  const current = periods[periods.length - 1];
  const pair: PeriodPair = { current: current.id, previous: previous.id };

  const split = splitSameNewStore(seed.stores, pair);
  const totalCurrent = split.total.current;
  const share = (value: number): number => (totalCurrent === 0 ? 0 : value / totalCurrent);
  const sameStoreCount = seed.stores.filter((store) => !store.isNew).length;

  const channels = aggregate(seed.channels, "channel", pair);
  const channelTotal = channels.reduce(
    (total, group) => ({
      current: total.current + group.revenue,
      previous: total.previous + group.prevRevenue,
    }),
    { current: 0, previous: 0 },
  );

  const regions = regionStructure(seed.stores, pair);

  return {
    currentId: current.id,
    previousId: previous.id,
    currentLabel: current.label,
    previousLabel: previous.label,
    unit: seed.meta.currency_unit,
    split: {
      sameStore: {
        key: "sameStore",
        label: "同店",
        current: split.sameStore.current,
        previous: split.sameStore.previous,
        delta: split.sameStore.delta,
        deltaRate: split.sameStore.deltaRate,
        share: share(split.sameStore.current),
        storeCount: sameStoreCount,
      },
      newStore: {
        key: "newStore",
        label: "新店",
        current: split.newStore.current,
        previous: split.newStore.previous,
        delta: split.newStore.delta,
        deltaRate: split.newStore.deltaRate,
        share: share(split.newStore.current),
        storeCount: seed.stores.length - sameStoreCount,
      },
      total: {
        key: "total",
        label: "全部门店",
        current: split.total.current,
        previous: split.total.previous,
        delta: split.total.delta,
        deltaRate: split.total.deltaRate,
        share: 1,
        storeCount: seed.stores.length,
      },
    },
    stores: storeStructure(seed.stores, pair),
    regions,
    channels,
    channelTotal,
    counts: {
      sameStore: sameStoreCount,
      newStore: seed.stores.length - sameStoreCount,
      total: seed.stores.length,
      channels: channels.length,
      regions: regions.length,
    },
  };
}
