import { chainTrafficTicket } from "./decomposition.js";
import { amountFor, resolvePeriodPair } from "./period.js";
import type {
  PeerBenchmark,
  PeriodInput,
  SameStoreSummary,
  Store,
  StoreTrafficRecord,
  StoreTrafficRow,
  TimeSlotGroup,
  TimeSlotRecord,
} from "./types.js";

/** 客流（人次）× 客单价（元/人次）= 元，折算成万元 */
const YUAN_PER_WAN = 10000;

function deltaRate(delta: number, base: number): number | null {
  return base === 0 ? null : delta / base;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * 把门店客流与客单价记录逐店做两因素分解（连环替代法，先替换客流）。
 *
 * - 收入口径取 stores.json（业务事实来源）；
 * - 客流、客单价口径取 traffic.json（表6 真实数据）；
 * - 新店没有上年同期，`hasPrevious` 为 false，数值仍返回但调用方不应展示。
 *
 * 说明：2024 年客流在源表中按整数取整，逐店「客流 × 客单价」与门店收入
 * 存在 ≤0.5 万的差额，因此 `effectTotal` 与 `revenueDelta` 不保证逐店严格相等。
 */
export function decomposeStoreTraffic(
  stores: readonly Store[],
  trafficRecords: readonly StoreTrafficRecord[],
  period: PeriodInput,
): StoreTrafficRow[] {
  const { current, previous } = resolvePeriodPair(period);
  const records = new Map(trafficRecords.map((record) => [record.storeId, record]));

  return stores.map((store): StoreTrafficRow => {
    const record = records.get(store.id);
    if (!record) {
      throw new Error(`traffic.json 缺少门店 ${store.id}（${store.name}）的客流记录`);
    }

    const trafficPrevious = amountFor(record.traffic, previous);
    const trafficCurrent = amountFor(record.traffic, current);
    const ticketPrevious = amountFor(record.ticket, previous);
    const ticketCurrent = amountFor(record.ticket, current);
    const revenuePrevious = amountFor(store.revenue, previous);
    const revenueCurrent = amountFor(store.revenue, current);

    const trafficDelta = trafficCurrent - trafficPrevious;
    const ticketDelta = ticketCurrent - ticketPrevious;
    const revenueDelta = revenueCurrent - revenuePrevious;
    const effects = chainTrafficTicket({
      traffic0: trafficPrevious,
      ticket0: ticketPrevious,
      traffic1: trafficCurrent,
      ticket1: ticketCurrent,
    });

    return {
      storeId: store.id,
      name: store.name,
      region: store.region,
      isNew: store.isNew,
      hasPrevious: !store.isNew && trafficPrevious > 0,
      trafficPrevious,
      trafficCurrent,
      trafficDelta,
      trafficDeltaRate: deltaRate(trafficDelta, trafficPrevious),
      ticketPrevious,
      ticketCurrent,
      ticketDelta,
      ticketDeltaRate: deltaRate(ticketDelta, ticketPrevious),
      trafficEffect: effects.trafficEffect / YUAN_PER_WAN,
      ticketEffect: effects.ticketEffect / YUAN_PER_WAN,
      effectTotal: effects.total / YUAN_PER_WAN,
      revenuePrevious,
      revenueCurrent,
      revenueDelta,
      revenueDeltaRate: deltaRate(revenueDelta, revenuePrevious),
    };
  });
}

/** 只保留有上年同期的同店（新店剔出） */
export function sameStoreRows(rows: readonly StoreTrafficRow[]): StoreTrafficRow[] {
  return rows.filter((row) => !row.isNew && row.hasPrevious);
}

/**
 * 同店整体汇总。
 * 客单价用按客流加权的平均值（Σ 客流 × 客单价 ÷ Σ 客流），与收入口径保持同向。
 */
export function summarizeSameStore(rows: readonly StoreTrafficRow[]): SameStoreSummary {
  const sameStores = sameStoreRows(rows);

  const trafficPrevious = sum(sameStores.map((row) => row.trafficPrevious));
  const trafficCurrent = sum(sameStores.map((row) => row.trafficCurrent));
  const trafficDelta = trafficCurrent - trafficPrevious;

  const weightedTicket = (trafficOf: (row: StoreTrafficRow) => number, ticketOf: (row: StoreTrafficRow) => number): number => {
    const totalTraffic = sum(sameStores.map(trafficOf));
    if (totalTraffic === 0) {
      return 0;
    }
    return sameStores.reduce((total, row) => total + trafficOf(row) * ticketOf(row), 0) / totalTraffic;
  };

  const ticketPrevious = weightedTicket(
    (row) => row.trafficPrevious,
    (row) => row.ticketPrevious,
  );
  const ticketCurrent = weightedTicket(
    (row) => row.trafficCurrent,
    (row) => row.ticketCurrent,
  );
  const ticketDelta = ticketCurrent - ticketPrevious;

  const trafficEffect = sum(sameStores.map((row) => row.trafficEffect));
  const ticketEffect = sum(sameStores.map((row) => row.ticketEffect));
  const effectTotal = trafficEffect + ticketEffect;

  const revenuePrevious = sum(sameStores.map((row) => row.revenuePrevious));
  const revenueCurrent = sum(sameStores.map((row) => row.revenueCurrent));
  const revenueDelta = revenueCurrent - revenuePrevious;

  return {
    sameStoreCount: sameStores.length,
    trafficPrevious,
    trafficCurrent,
    trafficDelta,
    trafficDeltaRate: deltaRate(trafficDelta, trafficPrevious),
    ticketPrevious,
    ticketCurrent,
    ticketDelta,
    ticketDeltaRate: deltaRate(ticketDelta, ticketPrevious),
    trafficEffect,
    ticketEffect,
    effectTotal,
    revenuePrevious,
    revenueCurrent,
    revenueDelta,
    revenueDeltaRate: deltaRate(revenueDelta, revenuePrevious),
    reconciliationGap: revenueDelta - effectTotal,
  };
}

/** 按工作日 / 节假日聚合时段客流；保持数据源中的分组顺序与时段顺序 */
export function timeSlotGroups(
  slots: readonly TimeSlotRecord[],
  period: PeriodInput,
): TimeSlotGroup[] {
  const { current, previous } = resolvePeriodPair(period);
  const groups = new Map<string, TimeSlotGroup["slots"][number][]>();

  for (const slot of slots) {
    const previousValue = amountFor(slot.traffic, previous);
    const currentValue = amountFor(slot.traffic, current);
    const delta = currentValue - previousValue;
    const comparison = {
      dayType: slot.dayType,
      segment: slot.segment,
      span: slot.span,
      previous: previousValue,
      current: currentValue,
      delta,
      deltaRate: deltaRate(delta, previousValue),
    };
    const bucket = groups.get(slot.dayType) ?? [];
    bucket.push(comparison);
    groups.set(slot.dayType, bucket);
  }

  return [...groups.entries()].map(([dayType, groupSlots]) => {
    const previousTotal = sum(groupSlots.map((slot) => slot.previous));
    const currentTotal = sum(groupSlots.map((slot) => slot.current));
    const delta = currentTotal - previousTotal;
    return {
      dayType,
      slots: groupSlots,
      previous: previousTotal,
      current: currentTotal,
      delta,
      deltaRate: deltaRate(delta, previousTotal),
    };
  });
}

/**
 * 单店在同店群体中的横向对比：
 * - 平均客单价 = 同店本期加权客单价；
 * - 平均客流增速 = 同店整体客流同比；
 * - 收入排名按本期收入降序，同额按门店名升序。
 */
export function peerBenchmark(rows: readonly StoreTrafficRow[], storeId: string): PeerBenchmark {
  const sameStores = sameStoreRows(rows);
  const target = rows.find((row) => row.storeId === storeId);

  const totalTraffic = sum(sameStores.map((row) => row.trafficCurrent));
  const averageTicket =
    totalTraffic === 0
      ? null
      : sameStores.reduce((total, row) => total + row.trafficCurrent * row.ticketCurrent, 0) /
        totalTraffic;

  const growthRate = (() => {
    const previousTraffic = sum(sameStores.map((row) => row.trafficPrevious));
    if (previousTraffic === 0) {
      return null;
    }
    return (totalTraffic - previousTraffic) / previousTraffic;
  })();

  const ranked = [...sameStores].sort(
    (a, b) => b.revenueCurrent - a.revenueCurrent || a.name.localeCompare(b.name, "zh-Hans-CN"),
  );
  const rankIndex = target ? ranked.findIndex((row) => row.storeId === storeId) : -1;

  const ticketGap =
    target && averageTicket !== null ? target.ticketCurrent - averageTicket : null;

  return {
    sameStoreCount: sameStores.length,
    averageTicket,
    trafficGrowthRate: growthRate,
    ticketGap,
    trafficGrowthGap:
      target && target.hasPrevious && growthRate !== null && target.trafficDeltaRate !== null
        ? target.trafficDeltaRate - growthRate
        : null,
    revenueRank: target && !target.isNew && rankIndex >= 0 ? rankIndex + 1 : null,
  };
}
