import {
  formatAmount,
  formatInteger,
  formatPercent,
  formatPoints,
  formatSignedAmount,
  formatSignedInteger,
  formatSignedPercent,
} from "../format.js";
import { acquisitionHealth } from "./acquisition.js";
import { aggregate } from "./aggregate.js";
import { channelRevenue } from "./channel.js";
import { bundleDecompose, bundleKindSummary, categoryMix } from "./product.js";
import { profitBridge } from "./profit-bridge.js";
import { splitSameNewStore } from "./same-store.js";
import { decomposeStoreTraffic, sameStoreRows, summarizeSameStore } from "./traffic.js";
import { resolvePeriodPair } from "./period.js";
import type {
  AcquisitionRecord,
  AggregateGroup,
  Bundle,
  BundleDecompositionRow,
  Category,
  CategoryMixRow,
  Channel,
  ChannelRevenueTable,
  PnlItem,
  PeriodInput,
  PeriodPair,
  SameNewStoreSplit,
  SameStoreSummary,
  Store,
  StoreTrafficRecord,
} from "./types.js";

/**
 * 结论引擎的判定阈值。每条规则各用各的阈值，互不牵连，
 * 改一条不会顺手改掉另一条的触发条件。
 */
export const INSIGHT_THRESHOLDS = {
  /** 新店增量占营业收入同比增量的比重 ≥ 50% → 开店驱动（否则同店驱动） */
  newStoreDrivenShare: 0.5,
  /** 客流影响占两项 |影响| 之和 ≥ 70% → 客流驱动；≤ 30% → 客单价驱动；之间为双轮驱动 */
  trafficDrivenShare: 0.7,
  /** 客流影响占比 ≤ 30% → 客单价驱动 */
  ticketDrivenShare: 0.3,
  /** 本期收入第一的渠道占全部渠道收入的比重 ≥ 40% → 集中度风险 */
  channelConcentrationShare: 0.4,
  /** 引流款收入差占两期可比套餐收入差合计 ≥ 60% → 引流款依赖警告 */
  leadgenDeltaShare: 0.6,
  /** 产投比余量率（目标差率）≤ 5% → 压线 warning */
  channelTightMarginRate: 0.05,
} as const;

export type InsightCategory = "growth" | "cost" | "channel" | "product" | "risk";
export type InsightSeverity = "positive" | "warning" | "critical";

/** 结论里的一条证据；带 link 时页面会把数字做成可点击的下钻入口 */
export interface InsightEvidence {
  readonly label: string;
  readonly value: string;
  readonly link?: string;
}

export interface Insight {
  /** 稳定标识，如 growth-source */
  readonly id: string;
  readonly category: InsightCategory;
  readonly title: string;
  /** 两三句解释，必须带具体数字 */
  readonly detail: string;
  readonly severity: InsightSeverity;
  readonly evidence: readonly InsightEvidence[];
  /** 跳转到能看到该结论数字的下钻页 */
  readonly link?: string;
}

export interface Action {
  readonly id: string;
  readonly title: string;
  /** 为什么做（引用结论里的证据） */
  readonly why: string;
  /** 2–3 条具体动作 */
  readonly steps: readonly string[];
  /** 建议责任部门 */
  readonly owner: string;
  readonly link?: string;
  /** 触发该行动的结论 id，用于追溯 */
  readonly insightId: string;
}

/** 异动原点：营业收入同比增量的一项来源 */
export interface InsightOrigin {
  readonly rank: number;
  readonly key: "newStore" | "sameStoreTraffic" | "sameStoreTicket";
  readonly label: string;
  /** 对营业收入同比增量的贡献额（万元），可为负 */
  readonly amount: number;
  /** 占营业收入同比增量的比重 */
  readonly share: number;
  readonly note: string;
  readonly link: string;
  readonly highlighted: boolean;
}

export interface ProfitDragFact {
  readonly key: string;
  readonly label: string;
  readonly item: string;
  readonly kind: "variable" | "fixed";
  /** 利润桥因素影响额（万元），恒为负 */
  readonly effect: number;
  /** 本期与上期金额（万元） */
  readonly amountPrevious: number;
  readonly amountCurrent: number;
  /** 绝对额变动 = 本期 − 上期（万元） */
  readonly amountChange: number;
  /** 变动成本项：费率变动（0–1）；固定成本项为 null */
  readonly rateChange: number | null;
  readonly ratePrevious: number | null;
  readonly rateCurrent: number | null;
}

export type ChannelHealthStatus = "normal" | "warning" | "critical";

export interface ChannelHealthFact {
  readonly channel: string;
  readonly outputRatio: number | null;
  readonly targetRoi: number;
  /** 余量率（目标差率），已抹掉浮点噪声 */
  readonly marginRate: number | null;
  readonly status: ChannelHealthStatus;
  readonly statusLabel: string;
}

export interface LeadgenFact {
  /** 两期可比的套餐数 */
  readonly comparableCount: number;
  /** 两期可比套餐的收入差合计（元） */
  readonly totalAmountDelta: number;
  readonly leadgenCount: number;
  /** 引流款收入差合计（元） */
  readonly leadgenAmountDelta: number;
  /** 引流款收入差占两期可比套餐收入差合计的比重 */
  readonly share: number | null;
  /** 引流款本期销售额合计（元） */
  readonly amountCurrent: number;
  /** 引流款本期优惠额合计（元） */
  readonly discountCurrent: number;
  /** 加权折扣率 = Σ 优惠额 ÷ Σ 销售额 */
  readonly weightedDiscountRate: number | null;
  readonly bundles: readonly {
    readonly id: string;
    readonly name: string;
    readonly amountCurrent: number;
    readonly discountCurrent: number;
    readonly discountRate: number | null;
  }[];
}

export interface InsightsFacts {
  readonly revenue: {
    readonly previous: number;
    readonly current: number;
    readonly delta: number;
    readonly deltaRate: number | null;
  };
  readonly profit: {
    readonly previous: number;
    readonly current: number;
    readonly delta: number;
  };
  readonly storeCounts: {
    readonly total: number;
    readonly sameStore: number;
    readonly newStore: number;
  };
  readonly sameNew: SameNewStoreSplit;
  readonly sameStore: SameStoreSummary;
  /** 同店动因判定：traffic=客流驱动，ticket=客单价驱动，both=双轮驱动 */
  readonly sameStoreDriver: "traffic" | "ticket" | "both";
  readonly channelTotal: ChannelRevenueTable["total"];
  /** 渠道按本期收入降序 */
  readonly channels: readonly AggregateGroup[];
  /** 本期收入第一的渠道 */
  readonly topChannel: AggregateGroup;
  readonly categories: readonly CategoryMixRow[];
  readonly categoryTopIncrease: CategoryMixRow | null;
  readonly categoryTopDecrease: CategoryMixRow | null;
  readonly categoryTopRevenue: CategoryMixRow | null;
  readonly leadgen: LeadgenFact;
  readonly profitDrag: readonly ProfitDragFact[];
  readonly channelHealth: readonly ChannelHealthFact[];
}

export interface InsightsResult {
  readonly period: PeriodPair;
  /** 金额单位，与输入数据一致（样例数据为万元） */
  readonly unit: string;
  readonly insights: readonly Insight[];
  readonly actions: readonly Action[];
  readonly origins: readonly InsightOrigin[];
  /** 三项原点合计与营业收入同比增量的尾差（万元） */
  readonly originGap: number;
  /** 页面顶部的一句话总纲 */
  readonly headline: string;
  readonly facts: InsightsFacts;
}

export interface InsightsInput {
  readonly period: PeriodInput;
  readonly pnl: readonly PnlItem[];
  readonly stores: readonly Store[];
  readonly channels: readonly Channel[];
  readonly categories: readonly Category[];
  readonly bundles: readonly Bundle[];
  readonly traffic: readonly StoreTrafficRecord[];
  readonly acquisition: readonly AcquisitionRecord[];
  /** 金额单位，默认万元 */
  readonly unit?: string;
}

/** 利润桥因素与利润表项目的映射：变动成本看费率，固定成本看绝对额 */
const PROFIT_DRAG_ITEMS: Readonly<Record<string, { readonly item: string; readonly kind: "variable" | "fixed" }>> = {
  foodCost: { item: "食材成本", kind: "variable" },
  discount: { item: "优惠及手续费", kind: "variable" },
  utilities: { item: "水电气低值", kind: "variable" },
  marketing: { item: "宣传费用", kind: "variable" },
  salary: { item: "工资奖金", kind: "fixed" },
  dormitory: { item: "宿舍房租", kind: "fixed" },
  rent: { item: "店铺房租", kind: "fixed" },
  other: { item: "其它费用", kind: "fixed" },
};

/** 行动的默认优先级：同 severity 时按这个顺序取前 3 */
const ACTION_INSIGHT_PRIORITY: readonly string[] = [
  "profit-drag",
  "growth-source",
  "channel-concentration",
  "leadgen-dependency",
  "product-mix",
  "channel-health",
  "same-store-driver",
];

const SEVERITY_RANK: Readonly<Record<InsightSeverity, number>> = {
  critical: 0,
  warning: 1,
  positive: 2,
};

const STATUS_LABEL: Readonly<Record<ChannelHealthStatus, string>> = {
  normal: "正常",
  warning: "压线",
  critical: "不达标",
};

function ratio(part: number, total: number): number {
  return total === 0 ? 0 : part / total;
}

/** 抹掉 2.22e-16 这类浮点噪声，避免页面出现「−0.0%」 */
function tidy(value: number | null, digits = 4): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function pct(value: number | null, digits = 2): string {
  return formatPercent(value, digits);
}

function signed(value: number, unit: string): string {
  return `${formatSignedAmount(value)} ${unit}`;
}

function channelLink(): string {
  return "/revenue/channel";
}

function structureLink(): string {
  return "/revenue/structure";
}

function sameStoreLink(): string {
  return "/revenue/same-store";
}

function productLink(): string {
  return "/revenue/product";
}

function overviewLink(): string {
  return "/";
}

/** 增长来源：拆分新店 / 同店对营业收入同比增量的贡献 */
function buildGrowthInsight(
  split: SameNewStoreSplit,
  counts: InsightsFacts["storeCounts"],
  unit: string,
): Insight {
  const newStoreDelta = split.newStore.delta;
  const sameStoreDelta = split.sameStore.delta;
  const totalDelta = split.total.delta;
  const newShare = ratio(newStoreDelta, totalDelta);
  const sameShare = ratio(sameStoreDelta, totalDelta);
  const openingDriven = newShare >= INSIGHT_THRESHOLDS.newStoreDrivenShare;

  const title = openingDriven
    ? `增长 ${pct(newShare)} 来自开店，同店只贡献 ${pct(sameShare)}`
    : `增长 ${pct(sameShare)} 来自同店，经营增量是主引擎`;

  const detail = openingDriven
    ? `营业收入同比 ${signed(totalDelta, unit)}，其中新店 ${signed(newStoreDelta, unit)}（${pct(newShare)}）、同店 ${signed(sameStoreDelta, unit)}（${pct(sameShare)}），判定为「开店驱动」。开店增量一次性，不能当成可持续的同店经营能力。`
    : `营业收入同比 ${signed(totalDelta, unit)}，其中同店 ${signed(sameStoreDelta, unit)}（${pct(sameShare)}）、新店 ${signed(newStoreDelta, unit)}（${pct(newShare)}），判定为「同店驱动」。增量主要来自同店，经营能力可复制。`;

  return {
    id: "growth-source",
    category: "growth",
    title,
    detail,
    severity: openingDriven ? "warning" : "positive",
    evidence: [
      {
        label: "营业收入同比",
        value: signed(totalDelta, unit),
        link: structureLink(),
      },
      {
        label: `新店增量（${counts.newStore} 家）`,
        value: signed(newStoreDelta, unit),
        link: structureLink(),
      },
      {
        label: `同店增量（${counts.sameStore} 家）`,
        value: signed(sameStoreDelta, unit),
        link: structureLink(),
      },
      {
        label: "增量占比",
        value: `新店 ${pct(newShare)} / 同店 ${pct(sameShare)}`,
      },
    ],
    link: structureLink(),
  };
}

/** 同店动因：按两项 |影响| 的占比判定，规则见 INSIGHT_THRESHOLDS */
function sameStoreDriverOf(summary: SameStoreSummary): "traffic" | "ticket" | "both" {
  const absTraffic = Math.abs(summary.trafficEffect);
  const absTicket = Math.abs(summary.ticketEffect);
  const trafficShare = ratio(absTraffic, absTraffic + absTicket);
  if (trafficShare >= INSIGHT_THRESHOLDS.trafficDrivenShare) {
    return "traffic";
  }
  if (trafficShare <= INSIGHT_THRESHOLDS.ticketDrivenShare) {
    return "ticket";
  }
  return "both";
}

/** 同店动因：连环替代法拆客流 / 客单价 */
function buildSameStoreInsight(summary: SameStoreSummary, unit: string): Insight {
  const absTraffic = Math.abs(summary.trafficEffect);
  const absTicket = Math.abs(summary.ticketEffect);
  const totalEffect = absTraffic + absTicket;
  const trafficShare = ratio(absTraffic, totalEffect);
  const ticketShare = ratio(absTicket, totalEffect);
  const driverCode = sameStoreDriverOf(summary);
  const driver =
    driverCode === "traffic"
      ? "客流驱动"
      : driverCode === "ticket"
        ? "客单价驱动"
        : "双轮驱动";

  const title =
    driver === "客流驱动"
      ? `同店增长 ${pct(trafficShare)} 来自客流，客单价只贡献 ${pct(ticketShare)}`
      : driver === "客单价驱动"
        ? `同店增长 ${pct(ticketShare)} 靠客单价，客流贡献只有 ${pct(trafficShare)}`
        : `同店增长由客流与客单价双轮拉动（${pct(trafficShare)} / ${pct(ticketShare)}）`;

  const roundedTrafficDelta =
    Math.round(summary.trafficCurrent) - Math.round(summary.trafficPrevious);

  const detail =
    `同店收入同比 ${signed(summary.revenueDelta, unit)}；按连环替代法（先量后价）拆解：` +
    `客流影响 ${signed(summary.trafficEffect, unit)}（${pct(trafficShare)}）、` +
    `客单价影响 ${signed(summary.ticketEffect, unit)}（${pct(ticketShare)}），判定为「${driver}」。` +
    `客流 ${formatInteger(summary.trafficPrevious)} → ${formatInteger(summary.trafficCurrent)} 人次` +
    `（${formatSignedInteger(roundedTrafficDelta)}），客单价 ` +
    `${formatAmount(summary.ticketPrevious)} → ${formatAmount(summary.ticketCurrent)} 元/人次` +
    `（${formatSignedAmount(summary.ticketDelta)} 元）。`;

  return {
    id: "same-store-driver",
    category: "growth",
    title,
    detail,
    severity: summary.effectTotal < 0 ? "warning" : "positive",
    evidence: [
      {
        label: "同店收入同比",
        value: signed(summary.revenueDelta, unit),
        link: sameStoreLink(),
      },
      {
        label: "客流影响",
        value: `${signed(summary.trafficEffect, unit)}（${pct(trafficShare)}）`,
        link: sameStoreLink(),
      },
      {
        label: "客单价影响",
        value: `${signed(summary.ticketEffect, unit)}（${pct(ticketShare)}）`,
        link: sameStoreLink(),
      },
      {
        label: "同店客流",
        value: `${formatInteger(summary.trafficPrevious)} → ${formatInteger(summary.trafficCurrent)} 人次（${formatSignedInteger(roundedTrafficDelta)}）`,
        link: sameStoreLink(),
      },
      {
        label: "同店客单价",
        value: `${formatAmount(summary.ticketPrevious)} → ${formatAmount(summary.ticketCurrent)} 元/人次（${formatSignedAmount(summary.ticketDelta)} 元）`,
        link: sameStoreLink(),
      },
    ],
    link: sameStoreLink(),
  };
}

/** 渠道集中度：本期收入第一的渠道占比是否过高 */
function buildChannelConcentrationInsight(
  topChannel: AggregateGroup,
  channelTotal: ChannelRevenueTable["total"],
  channelCount: number,
  unit: string,
): Insight {
  const share = topChannel.share;
  const triggered = share >= INSIGHT_THRESHOLDS.channelConcentrationShare;

  const title = triggered
    ? `${topChannel.key}占收入 ${pct(share)}，单一渠道集中度偏高`
    : `${topChannel.key}占收入 ${pct(share)}，渠道结构相对分散`;

  const detail =
    `渠道收入合计同比 ${signed(channelTotal.delta, unit)}；${topChannel.key}本期 ` +
    `${formatAmount(topChannel.revenue)} ${unit}，占全部渠道 ${pct(share)}（阈值 40%），` +
    `同比 ${signed(topChannel.delta, unit)}（${formatSignedPercent(topChannel.deltaRate)}），` +
    `是本期最大的渠道增量来源。` +
    (triggered
      ? "单一渠道接近一半收入，平台规则或费率变化会直接冲击大盘。"
      : "渠道结构相对分散，暂未触发集中度预警。");

  return {
    id: "channel-concentration",
    category: "risk",
    title,
    detail,
    severity: triggered ? "warning" : "positive",
    evidence: [
      {
        label: "渠道收入同比",
        value: signed(channelTotal.delta, unit),
        link: channelLink(),
      },
      {
        label: "第一渠道本期收入",
        value: `${formatAmount(topChannel.revenue)} ${unit}`,
        link: channelLink(),
      },
      {
        label: "收入占比",
        value: pct(share),
        link: channelLink(),
      },
      {
        label: "第一渠道同比增量",
        value: signed(topChannel.delta, unit),
        link: channelLink(),
      },
      {
        label: "同比增减率",
        value: formatSignedPercent(topChannel.deltaRate),
        link: channelLink(),
      },
      {
        label: "渠道数",
        value: `${channelCount} 个`,
        link: channelLink(),
      },
    ],
    link: channelLink(),
  };
}

/** 产品结构：销量增幅最大 / 降幅最大 / 收入第一 */
function buildProductMixInsight(
  categories: readonly CategoryMixRow[],
  topIncrease: CategoryMixRow | null,
  topDecrease: CategoryMixRow | null,
  topRevenue: CategoryMixRow | null,
  unit: string,
): Insight {
  if (!topIncrease || !topDecrease || !topRevenue) {
    return {
      id: "product-mix",
      category: "product",
      title: "系列数据不足，无法判断产品结构变化",
      detail: `本期共 ${categories.length} 个系列，缺少可比的销量增减率，暂不生成产品结构结论。`,
      severity: "positive",
      evidence: [{ label: "系列数", value: `${categories.length} 个`, link: productLink() }],
      link: productLink(),
    };
  }

  const title =
    `${topIncrease.name}销量 ${formatSignedPercent(topIncrease.qtyDeltaRate)}、` +
    `${topDecrease.name} ${formatSignedPercent(topDecrease.qtyDeltaRate)}，产品结构在换挡`;

  const detail =
    `${topIncrease.name}销量 ${formatInteger(topIncrease.qtyPrevious)} → ` +
    `${formatInteger(topIncrease.qtyCurrent)} 份（${formatSignedPercent(topIncrease.qtyDeltaRate)}），` +
    `是增幅最大的系列；${topDecrease.name}销量 ${formatInteger(topDecrease.qtyPrevious)} → ` +
    `${formatInteger(topDecrease.qtyCurrent)} 份（${formatSignedPercent(topDecrease.qtyDeltaRate)}），降幅最大。` +
    `收入第一的${topRevenue.name}本期 ${formatAmount(topRevenue.revenueCurrent)} ${unit}，` +
    `占系列收入 ${pct(topRevenue.share)}。`;

  return {
    id: "product-mix",
    category: "product",
    title,
    detail,
    severity: "warning",
    evidence: [
      {
        label: `${topIncrease.name}销量`,
        value: `${formatSignedPercent(topIncrease.qtyDeltaRate)}（${formatInteger(topIncrease.qtyPrevious)} → ${formatInteger(topIncrease.qtyCurrent)} 份）`,
        link: productLink(),
      },
      {
        label: `${topDecrease.name}销量`,
        value: `${formatSignedPercent(topDecrease.qtyDeltaRate)}（${formatInteger(topDecrease.qtyPrevious)} → ${formatInteger(topDecrease.qtyCurrent)} 份）`,
        link: productLink(),
      },
      {
        label: `${topRevenue.name}本期收入`,
        value: `${formatAmount(topRevenue.revenueCurrent)} ${unit}`,
        link: productLink(),
      },
      {
        label: `${topRevenue.name}收入占比`,
        value: pct(topRevenue.share),
        link: productLink(),
      },
    ],
    link: productLink(),
  };
}

/** 引流款依赖：两期可比套餐里，引流款占总增量的比重与本期加权折扣率 */
function buildLeadgenInsight(leadgen: LeadgenFact, unit: string): Insight {
  const share = leadgen.share;
  const triggered = share !== null && share >= INSIGHT_THRESHOLDS.leadgenDeltaShare;
  const highest = [...leadgen.bundles].sort(
    (a, b) => (b.discountRate ?? 0) - (a.discountRate ?? 0),
  )[0];

  const title = triggered
    ? `套餐增量 ${pct(share)} 来自引流款，收入是折扣换来的`
    : `套餐增量 ${pct(share)} 来自引流款，结构可控`;

  const detail =
    `两期可比的 ${leadgen.comparableCount} 个套餐收入差合计 ` +
    `${formatSignedAmount(leadgen.totalAmountDelta)} 元，其中引流款 ${leadgen.leadgenCount} 个贡献 ` +
    `${formatSignedAmount(leadgen.leadgenAmountDelta)} 元（${pct(share)}），` +
    `${triggered ? "超过 60% 依赖阈值" : "低于 60% 依赖阈值"}；` +
    `这 ${leadgen.leadgenCount} 个套餐本期销售额 ${formatAmount(leadgen.amountCurrent)} 元、` +
    `优惠额 ${formatAmount(leadgen.discountCurrent)} 元，加权折扣率 ${pct(leadgen.weightedDiscountRate)}。` +
    (highest
      ? `单套餐折扣率最高的是 ${highest.id} 的 ${pct(highest.discountRate)}。`
      : "");

  return {
    id: "leadgen-dependency",
    category: "product",
    title,
    detail,
    severity: triggered ? "warning" : "positive",
    evidence: [
      {
        label: "两期可比套餐",
        value: `${leadgen.comparableCount} 个，收入差合计 ${formatSignedAmount(leadgen.totalAmountDelta)} 元`,
        link: productLink(),
      },
      {
        label: "引流款贡献",
        value: `${formatSignedAmount(leadgen.leadgenAmountDelta)} 元（${pct(share)}）`,
        link: productLink(),
      },
      {
        label: "引流款本期销售额 / 优惠额",
        value: `${formatAmount(leadgen.amountCurrent)} / ${formatAmount(leadgen.discountCurrent)} 元`,
        link: productLink(),
      },
      {
        label: "加权折扣率",
        value: pct(leadgen.weightedDiscountRate),
        link: productLink(),
      },
      ...(highest
        ? [
            {
              label: "单套餐最高折扣率",
              value: `${highest.id} ${pct(highest.discountRate)}`,
              link: productLink(),
            },
          ]
        : []),
    ],
    link: productLink(),
  };
}

/** 利润拖累：利润桥负贡献绝对值最大的两项 */
function buildProfitDragInsight(drags: readonly ProfitDragFact[], unit: string): Insight {
  if (drags.length === 0) {
    return {
      id: "profit-drag",
      category: "cost",
      title: "利润桥没有被成本项拖累",
      detail: "利润桥的全部因素都为正贡献或零贡献，本期没有需要单独盯住的成本拖累项。",
      severity: "positive",
      evidence: [{ label: "负贡献项", value: "0 项", link: overviewLink() }],
      link: overviewLink(),
    };
  }

  const totalEffect = sum(drags.map((drag) => drag.effect));
  const labels = drags.map((drag) => drag.label).join("与");
  const title = `利润最大拖累：${labels}合计 ${signed(totalEffect, unit)}`;

  const describe = (drag: ProfitDragFact): string => {
    if (drag.kind === "variable") {
      return (
        `${drag.label} ${signed(drag.effect, unit)}（变动成本，费率 ` +
        `${formatPercent(drag.ratePrevious)} → ${formatPercent(drag.rateCurrent)}，` +
        `${formatPoints((drag.rateChange ?? 0) * 100)} 个百分点）`
      );
    }
    return (
      `${drag.label} ${signed(drag.effect, unit)}（固定成本，绝对额 ` +
      `${formatAmount(drag.amountPrevious)} → ${formatAmount(drag.amountCurrent)} ${unit}，` +
      `${formatSignedAmount(drag.amountChange)} ${unit}）`
    );
  };

  const detail =
    `利润桥里负贡献绝对值最大的${drags.length === 1 ? "一项" : "两项"}：` +
    drags.map(describe).join("；") +
    `。${drags.length === 1 ? "该项拖累利润" : "两项合计拖累利润"} ${signed(totalEffect, unit)}。`;

  const evidence: InsightEvidence[] = [];
  for (const drag of drags) {
    evidence.push({
      label: `${drag.label}影响`,
      value: signed(drag.effect, unit),
      link: overviewLink(),
    });
    if (drag.kind === "variable") {
      evidence.push({
        label: `${drag.label}费率`,
        value: `${formatPercent(drag.ratePrevious)} → ${formatPercent(drag.rateCurrent)}（${formatPoints((drag.rateChange ?? 0) * 100)} 个百分点）`,
        link: overviewLink(),
      });
    } else {
      evidence.push({
        label: `${drag.label}绝对额`,
        value: `${formatAmount(drag.amountPrevious)} → ${formatAmount(drag.amountCurrent)} ${unit}（${formatSignedAmount(drag.amountChange)} ${unit}）`,
        link: overviewLink(),
      });
    }
  }
  evidence.push({
    label: drags.length === 1 ? "该项" : "两项合计",
    value: signed(totalEffect, unit),
    link: overviewLink(),
  });

  return {
    id: "profit-drag",
    category: "cost",
    title,
    detail,
    severity: "critical",
    evidence,
    link: overviewLink(),
  };
}

/** 渠道健康：产投比 vs 目标 ROI，低于目标 critical，余量率 ≤ 5% warning */
function buildChannelHealthInsight(rows: readonly ChannelHealthFact[]): Insight {
  if (rows.length === 0) {
    return {
      id: "channel-health",
      category: "channel",
      title: "暂无渠道健康数据",
      detail: "表8 没有可用的新客获取记录，无法判断产投比是否达标。",
      severity: "positive",
      evidence: [{ label: "渠道数", value: "0 个", link: channelLink() }],
      link: channelLink(),
    };
  }

  const severe = rows.filter((row) => row.status === "critical");
  const tight = rows.filter((row) => row.status === "warning");
  const severity: InsightSeverity =
    severe.length > 0 ? "critical" : tight.length > 0 ? "warning" : "positive";

  const title =
    severe.length > 0
      ? `${severe.map((row) => row.channel).join("、")}产投比低于目标，投放不达标`
      : tight.length > 0
        ? `${tight.map((row) => row.channel).join("、")}产投比压线，投放只到及格线`
        : "渠道投放产投比全部达标且有余量";

  const ratioText = (value: number | null): string =>
    value === null ? "—" : formatAmount(value);
  const describe = (row: ChannelHealthFact): string =>
    `${row.channel}产投比 ${ratioText(row.outputRatio)} / 目标 ${row.targetRoi.toFixed(1)}，` +
    `余量率 ${formatPercent(row.marginRate, 1)}，${row.statusLabel}`;

  const detail =
    `渠道健康按「产投比 vs 目标 ROI」判定：${rows.map(describe).join("；")}。` +
    (severity === "warning"
      ? "压线意味着目标线就压在投放效率的末端，继续加预算不会改善效率。"
      : severity === "critical"
        ? "低于目标线的渠道应立即收缩预算，先把产投比拉回目标以上。"
        : "所有渠道都有明确余量，可以按 ROI 从高到低排序加预算。");

  return {
    id: "channel-health",
    category: "channel",
    title,
    detail,
    severity,
    evidence: rows.flatMap((row) => [
      {
        label: `${row.channel} · ${row.statusLabel}`,
        value: `产投比 ${ratioText(row.outputRatio)} / 目标 ${row.targetRoi.toFixed(1)}`,
        link: channelLink(),
      },
      {
        label: `${row.channel} · 余量率`,
        value: formatPercent(row.marginRate, 1),
        link: channelLink(),
      },
    ]),
    link: channelLink(),
  };
}

/** 利润拖累项的明细事实：金额、费率或绝对额变动 */
function buildProfitDragFacts(pnl: readonly PnlItem[], period: PeriodPair): ProfitDragFact[] {
  const bridge = profitBridge(pnl, period);
  const amounts = new Map(pnl.map((item) => [item.item, item.values]));
  const revenuePrevious = amounts.get("营业收入")?.[period.previous] ?? 0;
  const revenueCurrent = amounts.get("营业收入")?.[period.current] ?? 0;

  return bridge
    .filter((node) => (node.kind === "up" || node.kind === "down") && node.effect < 0)
    .sort((a, b) => a.effect - b.effect)
    .slice(0, 2)
    .map((node): ProfitDragFact => {
      const meta = PROFIT_DRAG_ITEMS[node.key];
      if (!meta) {
        throw new Error(`利润桥因素缺少利润表映射：${node.key}`);
      }
      const values = amounts.get(meta.item);
      if (!values) {
        throw new Error(`利润表缺少项目：${meta.item}`);
      }
      const amountPrevious = values[period.previous] ?? 0;
      const amountCurrent = values[period.current] ?? 0;
      const ratePrevious =
        meta.kind === "variable" && revenuePrevious !== 0
          ? amountPrevious / revenuePrevious
          : null;
      const rateCurrent =
        meta.kind === "variable" && revenueCurrent !== 0
          ? amountCurrent / revenueCurrent
          : null;
      return {
        key: node.key,
        label: node.label,
        item: meta.item,
        kind: meta.kind,
        effect: node.effect,
        amountPrevious,
        amountCurrent,
        amountChange: amountCurrent - amountPrevious,
        rateChange:
          ratePrevious === null || rateCurrent === null ? null : rateCurrent - ratePrevious,
        ratePrevious,
        rateCurrent,
      };
    });
}

/** 引流款：两期可比套餐里 kind === leadgen 的部分 */
function buildLeadgenFact(
  rows: readonly BundleDecompositionRow[],
  bundles: readonly Bundle[],
  period: PeriodPair,
): LeadgenFact {
  const kindSummaries = bundleKindSummary(rows);
  const leadgenSummary = kindSummaries.find((item) => item.kind === "leadgen");
  const leadgenRows = rows.filter((row) => row.kind === "leadgen");
  const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));

  let amountCurrent = 0;
  let discountCurrent = 0;
  const bundleFacts = leadgenRows.map((row) => {
    const bundle = bundleById.get(row.id);
    const amount = bundle?.amount[period.current];
    const discount = bundle?.discount?.[period.current];
    const safeAmount = typeof amount === "number" ? amount : 0;
    const safeDiscount = typeof discount === "number" ? discount : 0;
    amountCurrent += safeAmount;
    discountCurrent += safeDiscount;
    return {
      id: row.id,
      name: row.name,
      amountCurrent: safeAmount,
      discountCurrent: safeDiscount,
      discountRate: safeAmount === 0 ? null : safeDiscount / safeAmount,
    };
  });

  return {
    comparableCount: rows.length,
    totalAmountDelta: sum(rows.map((row) => row.amountDelta)),
    leadgenCount: leadgenRows.length,
    leadgenAmountDelta: leadgenSummary?.amountDelta ?? 0,
    share: leadgenSummary?.share ?? null,
    amountCurrent,
    discountCurrent,
    weightedDiscountRate: amountCurrent === 0 ? null : discountCurrent / amountCurrent,
    bundles: bundleFacts,
  };
}

function buildOrigins(
  split: SameNewStoreSplit,
  sameStore: SameStoreSummary,
  counts: InsightsFacts["storeCounts"],
): { origins: InsightOrigin[]; originGap: number } {
  const candidates = [
    {
      key: "newStore" as const,
      label: "新店开店",
      amount: split.newStore.delta,
      note: `${counts.newStore} 家新店，2024 年无收入`,
      link: structureLink(),
    },
    {
      key: "sameStoreTraffic" as const,
      label: "同店客流",
      amount: sameStore.trafficEffect,
      note: `客流 ${formatInteger(sameStore.trafficPrevious)} → ${formatInteger(sameStore.trafficCurrent)} 人次`,
      link: sameStoreLink(),
    },
    {
      key: "sameStoreTicket" as const,
      label: "同店客单价",
      amount: sameStore.ticketEffect,
      note: `客单价 ${formatAmount(sameStore.ticketPrevious)} → ${formatAmount(sameStore.ticketCurrent)} 元/人次`,
      link: sameStoreLink(),
    },
  ];
  const originGap = split.total.delta - sum(candidates.map((item) => item.amount));
  const totalDelta = split.total.delta;

  const origins = [...candidates]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .map((item, index): InsightOrigin => ({
      ...item,
      rank: index + 1,
      share: ratio(item.amount, totalDelta),
      highlighted: index < 3,
    }));

  return { origins, originGap };
}

/** 根据结论的 severity 取前 3 条，生成可追溯的行动 */
function buildActions(insights: readonly Insight[], facts: InsightsFacts, unit: string): Action[] {
  const ordered = [...insights].sort((a, b) => {
    const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severity !== 0) {
      return severity;
    }
    const aIndex = ACTION_INSIGHT_PRIORITY.indexOf(a.id);
    const bIndex = ACTION_INSIGHT_PRIORITY.indexOf(b.id);
    return aIndex - bIndex;
  });

  return ordered.slice(0, 3).map((insight): Action => {
    switch (insight.id) {
      case "profit-drag": {
        const drags = facts.profitDrag;
        const total = sum(drags.map((drag) => drag.effect));
        const first = drags[0];
        const second = drags[1];
        return {
          id: "action-profit-drag",
          insightId: insight.id,
          title: "先管住其它费用与店铺房租",
          why: `${insight.title}。这两项都已经在利润桥里形成负贡献，只能从下月的合同、面积与费用审批里收回来。`,
          steps: [
            first
              ? `把${first.label} ${formatAmount(first.amountCurrent)} ${unit}按门店/科目拆开，锁定同比 ${formatSignedAmount(first.amountChange)} ${unit}的承担项`
              : "把所有固定成本按门店/科目拆开，锁定同比增量的承担项",
            second
              ? `${second.label} ${formatAmount(second.amountCurrent)} ${unit}逐店核对合同与面积，冻结同比 ${formatSignedAmount(second.amountChange)} ${unit}里的非必要新增`
              : "逐店核对房租合同与面积，冻结非必要新增",
            `两项合计拖累 ${signed(total, unit)}，纳入月度预算看板，单店超上期 5% 即触发复核`,
          ],
          owner: "财务部",
          link: insight.link,
        };
      }
      case "growth-source": {
        const newShare = ratio(facts.sameNew.newStore.delta, facts.sameNew.total.delta);
        return {
          id: "action-growth-source",
          insightId: insight.id,
          title: "把增量从开店驱动拉回同店驱动",
          why: `本期${signed(facts.sameNew.total.delta, unit)}增量里，${signed(facts.sameNew.newStore.delta, unit)}来自新店（${pct(newShare)}），同店只贡献 ${signed(facts.sameNew.sameStore.delta, unit)}；开店增量一次性，同店才可复制。`,
          steps: [
            "把 2 家新店的开业爬坡动作（菜单结构、时段排班、线上投放）沉淀成一页 SOP",
            `在 ${facts.storeCounts.sameStore} 家同店里选 2 家试点复制，设 30 天同店客流增速目标`,
            "每月复盘新店/同店增量占比，同店占比低于 50% 触发专项复盘",
          ],
          owner: "运营部",
          link: insight.link,
        };
      }
      case "channel-concentration": {
        const top = facts.topChannel;
        return {
          id: "action-channel-concentration",
          insightId: insight.id,
          title: `给${top.key}建第二增长渠道`,
          why: `${top.key}本期 ${formatAmount(top.revenue)} ${unit}、占渠道收入 ${pct(top.share)}，同比 ${signed(top.delta, unit)}；单一渠道接近一半收入，平台规则或费率变化会直接冲击大盘。`,
          steps: [
            "把抖音、美团外卖、饿了外卖按「收入增量 ÷ 投入」做同口径对比，选一个第二渠道加预算",
            `设定${top.key}收入占比 12 个月内降到 40% 以下的目标，按月跟踪`,
            "对占比超过 40% 的渠道建立月度集中度预警，超过阈值先暂停加投",
          ],
          owner: "渠道运营部",
          link: insight.link,
        };
      }
      case "leadgen-dependency": {
        const leadgen = facts.leadgen;
        return {
          id: "action-leadgen-dependency",
          insightId: insight.id,
          title: "收敛引流款折扣，把增量换成正价套餐",
          why: `套餐增量 ${pct(leadgen.share)} 来自 ${leadgen.leadgenCount} 个引流款，本期加权折扣率 ${pct(leadgen.weightedDiscountRate)}；收入是拿折扣换来的，折扣一收增量就停。`,
          steps: [
            "给引流款设折扣上限：单套餐折扣率高于 55% 需产品与财务二次审批",
            "把引流款带来的新客用会员券引导到正价套餐，跟踪 30 天复购与客单价",
            "每周看引流款/正价套餐的增量占比，正价占比低于 40% 触发调整",
          ],
          owner: "产品部 / 财务部",
          link: insight.link,
        };
      }
      case "product-mix": {
        const increase = facts.categoryTopIncrease;
        const decrease = facts.categoryTopDecrease;
        const top = facts.categoryTopRevenue;
        return {
          id: "action-product-mix",
          insightId: insight.id,
          title: decrease ? `放大${increase?.name ?? "高增长系列"}，复盘${decrease.name}下滑` : "放大高增长系列",
          why: `${increase?.name ?? "高增长系列"}销量 ${formatSignedPercent(increase?.qtyDeltaRate ?? null)}，${decrease?.name ?? "下滑系列"}销量 ${formatSignedPercent(decrease?.qtyDeltaRate ?? null)}；收入第一的${top?.name ?? "系列"}占 ${pct(top?.share ?? null)}。`,
          steps: [
            `把${increase?.name ?? "高增长系列"}放进菜单首屏与套餐组合，验证能否继续放量`,
            `对${decrease?.name ?? "下滑系列"}做单品级复盘：下架、换配方还是换陈列`,
            "按周跟踪系列销量结构，防止收入过度依赖单一系列",
          ],
          owner: "产品部",
          link: insight.link,
        };
      }
      case "channel-health": {
        const tight = facts.channelHealth.filter((row) => row.status !== "normal");
        const target = tight[0] ?? facts.channelHealth[0];
        return {
          id: "action-channel-health",
          insightId: insight.id,
          title: target ? `把${target.channel}产投比拉出压线区` : "把渠道产投比拉出压线区",
          why: target
            ? `${target.channel}产投比 ${formatAmount(target.outputRatio ?? 0)} / 目标 ${target.targetRoi.toFixed(1)}，余量率 ${formatPercent(target.marginRate, 1)}（${target.statusLabel}）；再按原价加投不会改善效率。`
            : insight.detail,
          steps: [
            "把新客成本拆成曝光、点击、到店三段，找出最贵的一段先降",
            "给压线渠道设「产投比 ≥ 目标 + 10%」才允许加预算的硬门槛",
            "每周对比各渠道产投比，低于目标线的渠道当月收缩预算",
          ],
          owner: "市场部",
          link: insight.link,
        };
      }
      default: {
        return {
          id: "action-same-store-driver",
          insightId: insight.id,
          title: "把客流增长沉淀成可复制的门店动作",
          why: `同店增长 ${pct(ratio(Math.abs(facts.sameStore.trafficEffect), Math.abs(facts.sameStore.trafficEffect) + Math.abs(facts.sameStore.ticketEffect)))} 来自客流，客单价贡献有限；客流动作比提价更容易复制。`,
          steps: [
            "把客流增长最快的时段与门店挑出来，记录当班的排班、菜单与投放动作",
            "在同店群体里做一轮复制试点，设 30 天客流与客单价双目标",
            "每月复盘客流/客单价贡献占比，客单价贡献低于 20% 时补提价动作",
          ],
          owner: "运营部",
          link: insight.link,
        };
      }
    }
  });
}

/**
 * 结论引擎：输入全部经营数据集，输出结构化结论、异动原点与行动建议。
 *
 * 纯函数：不读文件、不依赖 React / 数据库；所有金额单位跟随输入数据。
 * 七条规则各自独立判定，阈值集中在 INSIGHT_THRESHOLDS：
 *
 * 1. growth-source           新店 / 同店对营业收入同比增量的贡献
 * 2. same-store-driver       同店客流 / 客单价（连环替代法，先量后价）
 * 3. channel-concentration   本期收入第一的渠道占比
 * 4. product-mix             系列销量增幅最大 / 降幅最大 / 收入第一
 * 5. leadgen-dependency      两期可比套餐里引流款占增量比重与加权折扣率
 * 6. profit-drag             利润桥负贡献绝对值最大的两项
 * 7. channel-health          产投比 vs 目标 ROI（低于目标 critical，余量率 ≤5% warning）
 *
 * 行动建议按 severity（critical → warning → positive）取前 3 条，
 * 每条都带 insightId，能追溯到触发它的结论。
 */
export function generateInsights(input: InsightsInput): InsightsResult {
  const period = resolvePeriodPair(input.period);
  const unit = input.unit ?? "万元";
  const counts: InsightsFacts["storeCounts"] = {
    total: input.stores.length,
    sameStore: input.stores.filter((store) => !store.isNew).length,
    newStore: input.stores.filter((store) => store.isNew).length,
  };

  const split = splitSameNewStore(input.stores, period);
  const trafficRows = sameStoreRows(decomposeStoreTraffic(input.stores, input.traffic, period));
  const sameStore = summarizeSameStore(trafficRows);
  const channelTable = channelRevenue(input.channels, period);
  const channelsByRevenue = aggregate(input.channels, "channel", period);
  const topChannel = channelsByRevenue[0];
  if (!topChannel) {
    throw new Error("渠道数据为空，无法生成渠道结论");
  }

  const categories = categoryMix(input.categories, period);
  const comparableCategories = categories.filter(
    (row) => row.qtyDeltaRate !== null && Number.isFinite(row.qtyDeltaRate),
  );
  const categoryTopIncrease =
    comparableCategories.length === 0
      ? null
      : [...comparableCategories].sort(
          (a, b) => (b.qtyDeltaRate ?? 0) - (a.qtyDeltaRate ?? 0),
        )[0];
  const categoryTopDecrease =
    comparableCategories.length === 0
      ? null
      : [...comparableCategories].sort(
          (a, b) => (a.qtyDeltaRate ?? 0) - (b.qtyDeltaRate ?? 0),
        )[0];
  const categoryTopRevenue = categories[0] ?? null;

  const bundleRows = bundleDecompose(input.bundles, period);
  const leadgen = buildLeadgenFact(bundleRows, input.bundles, period);

  const bridge = profitBridge(input.pnl, period);
  const profitPrevious = bridge[0]?.cumulative ?? 0;
  const profitCurrent = bridge[bridge.length - 1]?.cumulative ?? 0;
  const profitDelta = profitCurrent - profitPrevious;

  const profitDrag = buildProfitDragFacts(input.pnl, period);

  const channelHealth = acquisitionHealth(input.acquisition).map((row): ChannelHealthFact => {
    const status: ChannelHealthStatus =
      row.status === "short" ? "critical" : row.status === "tight" ? "warning" : "normal";
    return {
      channel: row.channel,
      outputRatio: row.outputRatio,
      targetRoi: row.targetRoi,
      marginRate: tidy(row.targetGapRate),
      status,
      statusLabel: STATUS_LABEL[status],
    };
  });

  const revenuePrevious = split.total.previous;
  const revenueCurrent = split.total.current;
  const revenueDelta = split.total.delta;
  const revenueDeltaRate = revenuePrevious === 0 ? null : revenueDelta / revenuePrevious;

  const insights: readonly Insight[] = [
    buildGrowthInsight(split, counts, unit),
    buildSameStoreInsight(sameStore, unit),
    buildChannelConcentrationInsight(topChannel, channelTable.total, channelsByRevenue.length, unit),
    buildProductMixInsight(
      categories,
      categoryTopIncrease ?? null,
      categoryTopDecrease ?? null,
      categoryTopRevenue,
      unit,
    ),
    buildLeadgenInsight(leadgen, unit),
    buildProfitDragInsight(profitDrag, unit),
    buildChannelHealthInsight(channelHealth),
  ];

  const { origins, originGap } = buildOrigins(split, sameStore, counts);

  const facts: InsightsFacts = {
    revenue: {
      previous: revenuePrevious,
      current: revenueCurrent,
      delta: revenueDelta,
      deltaRate: revenueDeltaRate,
    },
    profit: {
      previous: profitPrevious,
      current: profitCurrent,
      delta: profitDelta,
    },
    storeCounts: counts,
    sameNew: split,
    sameStore,
    sameStoreDriver: sameStoreDriverOf(sameStore),
    channelTotal: channelTable.total,
    channels: channelsByRevenue,
    topChannel,
    categories,
    categoryTopIncrease: categoryTopIncrease ?? null,
    categoryTopDecrease: categoryTopDecrease ?? null,
    categoryTopRevenue,
    leadgen,
    profitDrag,
    channelHealth,
  };

  const actions = buildActions(insights, facts, unit);

  const sameStoreDriver = facts.sameStoreDriver;
  const judgement =
    sameStoreDriver === "traffic"
      ? "同店增长几乎全靠客流，客单价基本没动——人来了，但没多花钱"
      : sameStoreDriver === "ticket"
        ? "同店增长主要靠客单价，人气贡献有限"
        : "同店客流与客单价双轮拉动";
  const growthShare = ratio(split.newStore.delta, split.total.delta);
  const headline =
    `本期营业收入 ${formatAmount(revenueCurrent)} ${unit}、营业利润 ` +
    `${formatAmount(profitCurrent)} ${unit}（同比 ${formatSignedAmount(profitDelta)} ${unit}）；` +
    `${pct(growthShare)} 的增量来自开店，核心判断是：${judgement}。`;

  return {
    period,
    unit,
    insights,
    actions,
    origins,
    originGap,
    headline,
    facts,
  };
}
