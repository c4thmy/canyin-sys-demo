import { formatAmount, formatPercent, formatPoints, formatSignedAmount, formatSignedPercent } from "./format.js";
import { profitBridge, splitSameNewStore } from "./metrics/index.js";
import type { ProfitBridgeNode } from "./metrics/types.js";
import { loadSeed, type SeedPeriod } from "./seed.js";

export type Tone = "positive" | "negative" | "neutral";

export interface MetricCardView {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly delta: string;
  readonly deltaUnit: string;
  readonly note: string;
  readonly tone: Tone;
}

export interface OverviewView {
  readonly periods: readonly SeedPeriod[];
  readonly activePeriodId: string;
  readonly currentLabel: string;
  readonly previousLabel: string;
  readonly unit: string;
  readonly sourceFile: string;
  readonly pnlSheet: string;
  readonly cards: readonly MetricCardView[];
  readonly bridge: readonly ProfitBridgeNode[];
  readonly previousProfit: number;
  readonly currentProfit: number;
  readonly profitDelta: number;
  readonly summary: string;
}

function toneOf(value: number, positiveWhenUp = true): Tone {
  if (value === 0) {
    return "neutral";
  }
  return value > 0 === positiveWhenUp ? "positive" : "negative";
}

function effectVerb(effect: number): string {
  if (effect > 0) {
    return "贡献利润";
  }
  if (effect < 0) {
    return "拖累利润";
  }
  return "影响利润";
}

function buildSummary(
  nodes: readonly ProfitBridgeNode[],
  revenueDelta: number,
  foodRateChange: number,
  unit: string,
): string {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const revenueEffect = byKey.get("revenue")?.effect ?? 0;
  const foodEffect = byKey.get("foodCost")?.effect ?? 0;
  const previousProfit = nodes[0].cumulative;
  const currentProfit = nodes[nodes.length - 1].cumulative;
  const profitDelta = currentProfit - previousProfit;

  const marginRate = revenueDelta === 0 ? null : revenueEffect / revenueDelta;
  const factors = nodes.filter((node) => node.kind === "up" || node.kind === "down");
  const candidates = factors.filter((node) => node.key !== "revenue" && node.key !== "foodCost");
  const worst = [...candidates].sort((a, b) => a.effect - b.effect)[0];
  const best = [...candidates].sort((a, b) => b.effect - a.effect)[0];

  const parts: string[] = [];

  if (revenueDelta === 0) {
    parts.push(`收入与上年同期持平，收入规模影响利润 ${formatAmount(revenueEffect)} ${unit}`);
  } else {
    parts.push(
      `收入${revenueDelta > 0 ? "增长" : "下降"} ${formatAmount(Math.abs(revenueDelta))} ${unit}，` +
        `按上期边际贡献率 ${formatPercent(marginRate)} ${effectVerb(revenueEffect)} ${formatAmount(Math.abs(revenueEffect))} ${unit}`,
    );
  }

  const foodWord = foodRateChange > 0 ? "上升" : foodRateChange < 0 ? "下降" : "持平";
  parts.push(
    `食材成本率${foodWord} ${Math.abs(foodRateChange).toFixed(2)} 个百分点，` +
      `${effectVerb(foodEffect)} ${formatAmount(Math.abs(foodEffect))} ${unit}`,
  );

  if (worst && worst.effect < 0) {
    parts.push(`${worst.label}拖累利润 ${formatAmount(Math.abs(worst.effect))} ${unit}`);
  }
  if (best && best.effect > 0) {
    parts.push(`${best.label}贡献利润 ${formatAmount(best.effect)} ${unit}`);
  }

  const totalVerb = profitDelta > 0 ? "增至" : profitDelta < 0 ? "降至" : "持平于";
  if (profitDelta === 0) {
    parts.push(`${factors.length} 项因素合计无变化，营业利润持平于 ${formatAmount(currentProfit)} ${unit}`);
  } else {
    parts.push(
      `${factors.length} 项因素合计 ${formatSignedAmount(profitDelta)} ${unit}，` +
        `营业利润从 ${formatAmount(previousProfit)} ${unit}${totalVerb} ${formatAmount(currentProfit)} ${unit}`,
    );
  }

  return `${parts.join("；")}。`;
}

/** 组装经营总览页的数据：指标卡 + 利润桥 + 自动小结，全部来自 data/seed */
export function buildOverview(): OverviewView {
  const { meta, pnl, stores, pnlSheet } = loadSeed();
  const periods = [...meta.periods].sort((a, b) => a.id.localeCompare(b.id));
  if (periods.length < 2) {
    throw new Error("meta.json 至少需要两个期间才能做同比");
  }
  const previous = periods[0];
  const current = periods[periods.length - 1];
  const periodPair = { current: current.id, previous: previous.id };

  const amounts = new Map(pnl.map((item) => [item.item, item.values]));
  const valueOf = (item: string, period: string): number => {
    const values = amounts.get(item);
    if (!values) {
      throw new Error(`pnl.json 缺少项目：${item}`);
    }
    return values[period] ?? 0;
  };

  const revenue0 = valueOf("营业收入", previous.id);
  const revenue1 = valueOf("营业收入", current.id);
  const revenueDelta = revenue1 - revenue0;
  const revenueRate = revenue0 === 0 ? null : revenueDelta / revenue0;

  const foodRate0 = revenue0 === 0 ? 0 : valueOf("食材成本", previous.id) / revenue0;
  const foodRate1 = revenue1 === 0 ? 0 : valueOf("食材成本", current.id) / revenue1;
  const foodRateChange = (foodRate1 - foodRate0) * 100;

  const bridge = profitBridge(pnl, periodPair);
  const previousProfit = bridge[0].cumulative;
  const currentProfit = bridge[bridge.length - 1].cumulative;
  const profitDelta = currentProfit - previousProfit;
  const profitRate = previousProfit === 0 ? null : profitDelta / previousProfit;

  const sameStore = splitSameNewStore(stores, periodPair);

  const cards: readonly MetricCardView[] = [
    {
      key: "revenue",
      label: "营业收入",
      value: formatAmount(revenue1),
      unit: meta.currency_unit,
      delta: formatSignedAmount(revenueDelta),
      deltaUnit: meta.currency_unit,
      note: `同比 ${formatSignedPercent(revenueRate)}`,
      tone: toneOf(revenueDelta),
    },
    {
      key: "profit",
      label: "营业利润",
      value: formatAmount(currentProfit),
      unit: meta.currency_unit,
      delta: formatSignedAmount(profitDelta),
      deltaUnit: meta.currency_unit,
      note: `同比 ${formatSignedPercent(profitRate)}`,
      tone: toneOf(profitDelta),
    },
    {
      key: "foodCostRate",
      label: "食材成本率",
      value: formatPercent(foodRate1),
      unit: "",
      delta: formatPoints(foodRateChange),
      deltaUnit: "个百分点",
      note: `上年同期 ${formatPercent(foodRate0)}`,
      tone: toneOf(foodRateChange, false),
    },
    {
      key: "sameStoreGrowth",
      label: "同店收入增速",
      value: formatPercent(sameStore.sameStore.deltaRate),
      unit: "",
      delta: formatSignedAmount(sameStore.sameStore.delta),
      deltaUnit: meta.currency_unit,
      note: `同比 · 同店收入 ${formatAmount(sameStore.sameStore.current)} ${meta.currency_unit}`,
      tone: toneOf(sameStore.sameStore.delta),
    },
  ];

  return {
    periods,
    activePeriodId: current.id,
    currentLabel: current.label,
    previousLabel: previous.label,
    unit: meta.currency_unit,
    sourceFile: meta.source_file,
    pnlSheet,
    cards,
    bridge,
    previousProfit,
    currentProfit,
    profitDelta,
    summary: buildSummary(bridge, revenueDelta, foodRateChange, meta.currency_unit),
  };
}
