import { formatAmount, formatInteger, formatSignedAmount, formatSignedInteger, formatSignedPercent } from "./format.js";
import {
  decomposeStoreTraffic,
  sameStoreRows,
  summarizeSameStore,
  timeSlotGroups,
} from "./metrics/index.js";
import type {
  PeriodPair,
  SameStoreSummary,
  StoreTrafficRow,
  TimeSlotComparison,
  TimeSlotGroup,
} from "./metrics/types.js";
import type { MetricCardView, Tone } from "./overview.js";
import { analysisPeriods } from "./dataset-status.js";
import { loadSeed } from "./seed.js";

export interface EffectBreakdown {
  readonly trafficEffect: number;
  readonly ticketEffect: number;
  readonly effectTotal: number;
  /** 客流影响占两项 |影响| 之和的比重（0–1） */
  readonly trafficShare: number;
  readonly ticketShare: number;
  readonly revenueDelta: number;
  readonly reconciliationGap: number;
}

export interface SameStoreView {
  readonly currentId: string;
  readonly previousId: string;
  readonly currentLabel: string;
  readonly previousLabel: string;
  readonly unit: string;
  readonly summary: SameStoreSummary;
  readonly cards: readonly MetricCardView[];
  readonly rows: readonly StoreTrafficRow[];
  readonly effects: EffectBreakdown;
  readonly timeSlots: readonly TimeSlotGroup[];
  readonly timeInsight: string;
}

function toneOf(value: number): Tone {
  if (value === 0) {
    return "neutral";
  }
  return value > 0 ? "positive" : "negative";
}

/** 卡片里的客流差额用「两期取整后再相减」，与页面展示的 66,566 / 59,345 对得上 */
function roundedTrafficDelta(summary: SameStoreSummary): number {
  return Math.round(summary.trafficCurrent) - Math.round(summary.trafficPrevious);
}

function buildCards(summary: SameStoreSummary): readonly MetricCardView[] {
  return [
    {
      key: "sameStoreRevenue",
      label: "同店收入",
      value: formatAmount(summary.revenueCurrent),
      unit: "万元",
      delta: formatSignedAmount(summary.revenueDelta),
      deltaUnit: "万元",
      note: `同比 ${formatSignedPercent(summary.revenueDeltaRate)} · 上年同期 ${formatAmount(summary.revenuePrevious)} 万元`,
      tone: toneOf(summary.revenueDelta),
    },
    {
      key: "sameStoreTraffic",
      label: "同店客流",
      value: formatInteger(summary.trafficCurrent),
      unit: "人次",
      delta: formatSignedInteger(roundedTrafficDelta(summary)),
      deltaUnit: "人次",
      note: `同比 ${formatSignedPercent(summary.trafficDeltaRate)} · 上年同期 ${formatInteger(summary.trafficPrevious)} 人次`,
      tone: toneOf(roundedTrafficDelta(summary)),
    },
    {
      key: "sameStoreTicket",
      label: "同店客单价",
      value: formatAmount(summary.ticketCurrent),
      unit: "元/人次",
      delta: formatSignedAmount(summary.ticketDelta),
      deltaUnit: "元",
      note: `同比 ${formatSignedPercent(summary.ticketDeltaRate)} · 上年同期 ${formatAmount(summary.ticketPrevious)} 元/人次`,
      tone: toneOf(summary.ticketDelta),
    },
  ];
}

function effectShares(trafficEffect: number, ticketEffect: number): { trafficShare: number; ticketShare: number } {
  const total = Math.abs(trafficEffect) + Math.abs(ticketEffect);
  if (total === 0) {
    return { trafficShare: 0, ticketShare: 0 };
  }
  return {
    trafficShare: Math.abs(trafficEffect) / total,
    ticketShare: Math.abs(ticketEffect) / total,
  };
}

function slotName(slot: TimeSlotComparison): string {
  if (slot.span === "9:00-14:00") {
    return "午市";
  }
  if (slot.span === "14:00-24:00") {
    return "晚市";
  }
  return slot.segment === "夜宵" ? "夜宵" : slot.segment;
}

/** 用真实数据生成时段洞察，避免页面写死结论 */
function buildTimeInsight(groups: readonly TimeSlotGroup[]): string {
  const slots = groups.flatMap((group) =>
    group.slots.map((slot) => ({ ...slot, group: group.dayType })),
  );
  if (slots.length === 0) {
    return "暂无分时段客流数据。";
  }

  const rise = [...slots].sort((a, b) => b.delta - a.delta)[0];
  const drop = [...slots].sort((a, b) => a.delta - b.delta)[0];
  const parts: string[] = [];

  if (rise && rise.delta > 0) {
    parts.push(
      `${rise.group} ${rise.span}（${slotName(rise)}）涨幅最大：` +
        `${formatInteger(rise.previous)} → ${formatInteger(rise.current)}（${formatSignedInteger(rise.delta)} 人次/日）`,
    );
  }
  if (drop && drop.delta < 0) {
    parts.push(
      `${drop.group} ${drop.span}（${slotName(drop)}）降幅最大：` +
        `${formatInteger(drop.previous)} → ${formatInteger(drop.current)}（${formatSignedInteger(drop.delta)} 人次/日）`,
    );
  }

  return `${parts.join("；")}。`;
}

/** 组装同店异动页：同店汇总 + 客流×客单价拆解 + 13 家同店明细 + 分时段客流 */
export function buildSameStoreView(): SameStoreView {
  const seed = loadSeed();
  const selected = analysisPeriods(seed);
  if (!selected) {
    throw new Error("数据集没有任何期间");
  }
  const { previous, current, periods } = selected;
  const pair: PeriodPair = { current: current.id, previous: previous.id };

  const rows = sameStoreRows(decomposeStoreTraffic(seed.stores, seed.traffic, pair)).sort(
    (a, b) => b.revenueDelta - a.revenueDelta || a.name.localeCompare(b.name, "zh-Hans-CN"),
  );
  const summary = summarizeSameStore(rows);
  const shares = effectShares(summary.trafficEffect, summary.ticketEffect);
  const groups = timeSlotGroups(seed.timeSlots, pair);

  return {
    currentId: current.id,
    previousId: previous.id,
    currentLabel: current.label,
    previousLabel: previous.label,
    unit: seed.meta.currency_unit,
    summary,
    cards: buildCards(summary),
    rows,
    effects: {
      trafficEffect: summary.trafficEffect,
      ticketEffect: summary.ticketEffect,
      effectTotal: summary.effectTotal,
      trafficShare: shares.trafficShare,
      ticketShare: shares.ticketShare,
      revenueDelta: summary.revenueDelta,
      reconciliationGap: summary.reconciliationGap,
    },
    timeSlots: groups,
    timeInsight: buildTimeInsight(groups),
  };
}
