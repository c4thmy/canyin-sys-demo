import { generateInsights } from "./metrics/index.js";
import type { InsightsResult } from "./metrics/index.js";
import { loadSeed, type SeedPeriod } from "./seed.js";

export interface InsightCounts {
  readonly total: number;
  readonly critical: number;
  readonly warning: number;
  readonly positive: number;
  readonly actions: number;
}

export interface InsightsView extends InsightsResult {
  readonly periods: readonly SeedPeriod[];
  readonly currentId: string;
  readonly previousId: string;
  readonly currentLabel: string;
  readonly previousLabel: string;
  readonly sourceFile: string;
  /** 结论与行动用到的源表 */
  readonly sheets: readonly string[];
  readonly counts: InsightCounts;
}

/**
 * 组装结论页的数据：读取 data/seed，把全部数据集交给纯函数结论引擎，
 * 再补上页面需要的期间标签、来源说明与计数。计算全部在 engine 里完成。
 */
export function buildInsightsView(): InsightsView {
  const seed = loadSeed();
  const periods = [...seed.meta.periods].sort((a, b) => a.id.localeCompare(b.id));
  if (periods.length < 2) {
    throw new Error("meta.json 至少需要两个期间才能做同比");
  }
  const previous = periods[0];
  const current = periods[periods.length - 1];

  const result = generateInsights({
    period: { current: current.id, previous: previous.id },
    pnl: seed.pnl,
    stores: seed.stores,
    channels: seed.channels,
    categories: seed.categories,
    bundles: seed.bundles,
    traffic: seed.traffic,
    acquisition: seed.acquisitions,
    unit: seed.meta.currency_unit,
  });

  const counts: InsightCounts = {
    total: result.insights.length,
    critical: result.insights.filter((insight) => insight.severity === "critical").length,
    warning: result.insights.filter((insight) => insight.severity === "warning").length,
    positive: result.insights.filter((insight) => insight.severity === "positive").length,
    actions: result.actions.length,
  };

  return {
    ...result,
    periods,
    currentId: current.id,
    previousId: previous.id,
    currentLabel: current.label,
    previousLabel: previous.label,
    sourceFile: seed.meta.source_file,
    sheets: [
      ...new Set([
        seed.storeSheet,
        seed.pnlSheet,
        seed.channelSheet,
        seed.categorySheet,
        seed.bundleSheet,
        seed.trafficSheet,
        seed.acquisitionSheet,
      ]),
    ],
    counts,
  };
}
