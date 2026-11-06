import {
  formatAmount,
  formatInteger,
  formatSignedAmount,
  formatSignedInteger,
  formatSignedPercent,
} from "./format.js";
import {
  decomposeStoreTraffic,
  peerBenchmark,
  summarizeSameStore,
} from "./metrics/index.js";
import type { PeerBenchmark, PeriodPair, SameStoreSummary } from "./metrics/types.js";
import type { MetricCardView, Tone } from "./overview.js";
import type { StoreTrafficRow } from "./metrics/types.js";
import { loadSeed } from "./seed.js";

export interface StoreDetailView {
  readonly store: {
    readonly id: string;
    readonly name: string;
    readonly region: string;
    readonly isNew: boolean;
    readonly hasPrevious: boolean;
  };
  readonly currentId: string;
  readonly previousId: string;
  readonly currentLabel: string;
  readonly previousLabel: string;
  readonly unit: string;
  readonly revenueCurrent: number;
  readonly revenuePrevious: number;
  readonly cards: readonly MetricCardView[];
  readonly effects: {
    readonly hasPrevious: boolean;
    readonly trafficEffect: number;
    readonly ticketEffect: number;
    readonly effectTotal: number;
    readonly trafficShare: number;
    readonly ticketShare: number;
    readonly revenueDelta: number;
    readonly reconciliationGap: number;
  };
  readonly benchmark: PeerBenchmark & {
    readonly storeTicket: number;
    readonly storeTrafficGrowth: number | null;
  };
  readonly summary: SameStoreSummary;
}

function toneOf(value: number): Tone {
  if (value === 0) {
    return "neutral";
  }
  return value > 0 ? "positive" : "negative";
}

function shareOf(effect: number, total: number): number {
  return total === 0 ? 0 : Math.abs(effect) / total;
}

function comparisonNote(hasPrevious: boolean, previousText: string, rate: number | null): string {
  return hasPrevious
    ? `上年同期 ${previousText} · 同比 ${formatSignedPercent(rate)}`
    : "新店无上年同期，不做同比";
}

function buildCards(row: StoreTrafficRow): readonly MetricCardView[] {
  return [
    {
      key: "traffic",
      label: "门店客流",
      value: formatInteger(row.trafficCurrent),
      unit: "人次",
      delta: row.hasPrevious ? formatSignedInteger(row.trafficDelta) : "—",
      deltaUnit: row.hasPrevious ? "人次" : "",
      note: comparisonNote(
        row.hasPrevious,
        `${formatInteger(row.trafficPrevious)} 人次`,
        row.trafficDeltaRate,
      ),
      tone: row.hasPrevious ? toneOf(row.trafficDelta) : "neutral",
    },
    {
      key: "ticket",
      label: "客单价",
      value: formatAmount(row.ticketCurrent),
      unit: "元/人次",
      delta: row.hasPrevious ? formatSignedAmount(row.ticketDelta) : "—",
      deltaUnit: row.hasPrevious ? "元" : "",
      note: comparisonNote(
        row.hasPrevious,
        `${formatAmount(row.ticketPrevious)} 元/人次`,
        row.ticketDeltaRate,
      ),
      tone: row.hasPrevious ? toneOf(row.ticketDelta) : "neutral",
    },
    {
      key: "revenue",
      label: "门店收入",
      value: formatAmount(row.revenueCurrent),
      unit: "万元",
      delta: row.hasPrevious ? formatSignedAmount(row.revenueDelta) : "—",
      deltaUnit: row.hasPrevious ? "万元" : "",
      note: comparisonNote(
        row.hasPrevious,
        `${formatAmount(row.revenuePrevious)} 万元`,
        row.revenueDeltaRate,
      ),
      tone: row.hasPrevious ? toneOf(row.revenueDelta) : "neutral",
    },
  ];
}

/** 组装门店详情页；门店不存在时返回 null，由页面调用 notFound() */
export function buildStoreDetailView(storeId: string): StoreDetailView | null {
  const seed = loadSeed();
  const periods = [...seed.meta.periods].sort((a, b) => a.id.localeCompare(b.id));
  if (periods.length < 2) {
    throw new Error("meta.json 至少需要两个期间才能做同比");
  }
  const previous = periods[0];
  const current = periods[periods.length - 1];
  const pair: PeriodPair = { current: current.id, previous: previous.id };

  const rows = decomposeStoreTraffic(seed.stores, seed.traffic, pair);
  const row = rows.find((item) => item.storeId === storeId);
  if (!row) {
    return null;
  }

  const summary = summarizeSameStore(rows);
  const benchmark = peerBenchmark(rows, storeId);
  const totalAbsEffect = Math.abs(row.trafficEffect) + Math.abs(row.ticketEffect);

  return {
    store: {
      id: row.storeId,
      name: row.name,
      region: row.region,
      isNew: row.isNew,
      hasPrevious: row.hasPrevious,
    },
    currentId: current.id,
    previousId: previous.id,
    currentLabel: current.label,
    previousLabel: previous.label,
    unit: seed.meta.currency_unit,
    revenueCurrent: row.revenueCurrent,
    revenuePrevious: row.revenuePrevious,
    cards: buildCards(row),
    effects: {
      hasPrevious: row.hasPrevious,
      trafficEffect: row.trafficEffect,
      ticketEffect: row.ticketEffect,
      effectTotal: row.effectTotal,
      trafficShare: shareOf(row.trafficEffect, totalAbsEffect),
      ticketShare: shareOf(row.ticketEffect, totalAbsEffect),
      revenueDelta: row.revenueDelta,
      reconciliationGap: row.revenueDelta - row.effectTotal,
    },
    benchmark: {
      ...benchmark,
      storeTicket: row.ticketCurrent,
      storeTrafficGrowth: row.trafficDeltaRate,
    },
    summary,
  };
}

/** 客单价对比说明：差值相对同店平均客单价 */
export function describeTicketGap(benchmark: StoreDetailView["benchmark"]): string {
  if (benchmark.averageTicket === null || benchmark.ticketGap === null) {
    return "暂无同店平均客单价";
  }
  const direction = benchmark.ticketGap >= 0 ? "高于" : "低于";
  const rate = benchmark.averageTicket === 0 ? null : benchmark.ticketGap / benchmark.averageTicket;
  return `${direction}同店平均 ${formatAmount(Math.abs(benchmark.ticketGap))} 元（${formatSignedPercent(rate)}）`;
}

export function describeTrafficGrowthGap(benchmark: StoreDetailView["benchmark"]): string {
  if (benchmark.trafficGrowthGap === null) {
    return "新店无上年同期，不参与客流增速对比";
  }
  const direction = benchmark.trafficGrowthGap >= 0 ? "高于" : "低于";
  return `${direction}同店整体 ${Math.abs(benchmark.trafficGrowthGap * 100).toFixed(2)} 个百分点`;
}
