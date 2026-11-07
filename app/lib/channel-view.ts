import { formatAmount, formatSignedAmount, formatSignedPercent } from "./format.js";
import { acquisitionHealth, channelRevenue, funnelRates, funnelSummary } from "./metrics/index.js";
import type {
  AcquisitionRow,
  AggregateGroup,
  FunnelCounts,
  FunnelRates,
  FunnelSummary,
  PeriodPair,
} from "./metrics/types.js";
import { analysisPeriods } from "./dataset-status.js";
import { loadSeed } from "./seed.js";

export interface FunnelStoreRow {
  readonly storeId: string;
  readonly name: string;
  readonly region: string;
  readonly counts: FunnelCounts;
  readonly rates: FunnelRates;
}

export interface ChannelView {
  readonly currentId: string;
  readonly previousId: string;
  readonly currentLabel: string;
  readonly previousLabel: string;
  readonly unit: string;
  readonly sourceFile: string;
  readonly channelSheet: string;
  readonly acquisitionSheet: string;
  readonly funnelSheet: string;
  /** 10 个渠道，按同比差额降序 */
  readonly channels: readonly AggregateGroup[];
  readonly channelTotal: {
    readonly current: number;
    readonly previous: number;
    readonly delta: number;
    readonly deltaRate: number | null;
  };
  /** 门店口径本期收入合计，用于说明渠道口径与门店口径的尾差 */
  readonly storeTotal: number;
  readonly acquisition: readonly AcquisitionRow[];
  readonly funnel: FunnelSummary;
  readonly funnelMonth: string;
  readonly funnelMonthLabel: string;
  /** 漏斗是否有多期数据可比；样例数据只有单期，恒为 false */
  readonly funnelHasComparison: boolean;
  readonly funnelStores: readonly FunnelStoreRow[];
  /** 页面顶部的一句话小结 */
  readonly summary: string;
}

/** 组装渠道页的数据：渠道同比 + 新客获取健康度 + 点评漏斗（单期） */
export function buildChannelView(): ChannelView {
  const seed = loadSeed();
  const selected = analysisPeriods(seed);
  if (!selected) {
    throw new Error("数据集没有任何期间");
  }
  const { previous, current, periods } = selected;
  const pair: PeriodPair = { current: current.id, previous: previous.id };

  const table = channelRevenue(seed.channels, pair);
  const acquisition = acquisitionHealth(seed.acquisitions);
  const funnel = funnelSummary(seed.funnel);

  const funnelMonths = [...new Set(seed.funnel.map((record) => record.month))].sort();
  const funnelMonth = funnelMonths[funnelMonths.length - 1] ?? current.id;
  const funnelMonthLabel =
    periods.find((period) => period.id === funnelMonth)?.label ?? funnelMonth;

  const storeNameOf = new Map(seed.stores.map((store) => [store.id, store.name]));
  const storeRegionOf = new Map(seed.stores.map((store) => [store.id, store.region]));
  const funnelStores: FunnelStoreRow[] = seed.funnel.map((record) => {
    const counts: FunnelCounts = {
      exposure: record.exposure,
      visits: record.visits,
      payments: record.payments,
      consumers: record.consumers,
    };
    return {
      storeId: record.storeId,
      name: storeNameOf.get(record.storeId) ?? record.storeId,
      region: storeRegionOf.get(record.storeId) ?? "",
      counts,
      rates: funnelRates(counts),
    };
  });

  const topChannel = table.rows[0];
  const tightChannel = acquisition.find((row) => row.status === "tight");
  const summaryParts = [
    `${table.rows.length} 个渠道合计同比 ${formatSignedAmount(table.total.delta)} ${seed.meta.currency_unit}` +
      `（${formatSignedPercent(table.total.deltaRate)}）` +
      (topChannel
        ? `，增量最大的是${topChannel.key} ${formatSignedAmount(topChannel.delta)} ${seed.meta.currency_unit}`
        : ""),
  ];
  if (tightChannel && tightChannel.outputRatio !== null) {
    summaryParts.push(
      `但${tightChannel.channel}的产投比 ${formatAmount(tightChannel.outputRatio)} 刚好压在目标 ` +
        `${formatAmount(tightChannel.targetRoi)} 上，投放只是及格线，没有余量`,
    );
  }

  return {
    currentId: current.id,
    previousId: previous.id,
    currentLabel: current.label,
    previousLabel: previous.label,
    unit: seed.meta.currency_unit,
    sourceFile: seed.meta.source_file,
    channelSheet: seed.channelSheet,
    acquisitionSheet: seed.acquisitionSheet,
    funnelSheet: seed.funnelSheet,
    channels: table.rows,
    channelTotal: table.total,
    storeTotal: seed.stores.reduce(
      (total, store) => total + (store.revenue[current.id] ?? 0),
      0,
    ),
    acquisition,
    funnel,
    funnelMonth,
    funnelMonthLabel,
    funnelHasComparison: funnelMonths.length > 1,
    funnelStores,
    summary: `${summaryParts.join("")}。`,
  };
}
