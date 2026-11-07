import {
  formatInteger,
  formatPercent,
  formatSignedAmount,
  formatSignedPercent,
} from "./format.js";
import { bundleDecompose, bundleKindSummary, categoryMix } from "./metrics/index.js";
import type {
  BundleDecompositionRow,
  BundleKind,
  BundleKindSummary,
  CategoryMixRow,
  PeriodPair,
} from "./metrics/types.js";
import { analysisPeriods } from "./dataset-status.js";
import { loadSeed } from "./seed.js";

/** 系列「关注」标记：收入前二 + 销量降幅最大 */
export interface CategoryFocus {
  readonly name: string;
  readonly reason: string;
}

export interface BundleTotals {
  readonly amountPrevious: number;
  readonly amountCurrent: number;
  readonly amountDelta: number;
  readonly qtyEffect: number;
  readonly priceEffect: number;
  /** 单价影响占收入差的比重；收入差为 0 时为 null */
  readonly priceEffectShare: number | null;
}

export interface ProductView {
  readonly currentId: string;
  readonly previousId: string;
  readonly currentLabel: string;
  readonly previousLabel: string;
  readonly unit: string;
  readonly sourceFile: string;
  readonly categorySheet: string;
  readonly bundleSheet: string;
  /** 8 个系列，按本期收入降序 */
  readonly categories: readonly CategoryMixRow[];
  readonly categoryTotal: {
    readonly qtyCurrent: number;
    readonly qtyPrevious: number;
    readonly qtyDelta: number;
    readonly revenueCurrent: number;
  };
  readonly categoryFocus: readonly CategoryFocus[];
  /** 两期可比的套餐，按收入差降序 */
  readonly bundles: readonly BundleDecompositionRow[];
  /** 源表套餐总数（含单期出现的新上架 / 已下架套餐） */
  readonly bundleTotalCount: number;
  readonly bundleTotals: BundleTotals;
  readonly kindSummaries: readonly BundleKindSummary[];
  readonly kindSummary: Record<BundleKind, BundleKindSummary>;
  readonly insights: {
    /** 系列销量变化最大的一项 */
    readonly category: string;
    /** 套餐增量的量价构成 */
    readonly bundle: string;
    /** 一行结论（页面展示） */
    readonly conclusion: string;
  };
}

function emptyKindSummary(kind: BundleKind): BundleKindSummary {
  return { kind, count: 0, amountDelta: 0, share: null };
}

/**
 * 组装产品页的数据：系列销量结构 + 套餐量价分解 + 自动结论。
 *
 * 系列层不输出 2024 收入 / 2024 单价（源表缺失，2024 收入是按本期单价反推的），
 * 量价分解只放在套餐层——套餐的销量与销售额两期都是原表真数。
 */
export function buildProductView(): ProductView {
  const seed = loadSeed();
  const selected = analysisPeriods(seed);
  if (!selected) {
    throw new Error("数据集没有任何期间");
  }
  const { previous, current, periods } = selected;
  const pair: PeriodPair = { current: current.id, previous: previous.id };

  const categories = categoryMix(seed.categories, pair);
  const bundles = bundleDecompose(seed.bundles, pair);
  const kindSummaries = bundleKindSummary(bundles);
  const kindSummary: Record<BundleKind, BundleKindSummary> = {
    leadgen: kindSummaries.find((item) => item.kind === "leadgen") ?? emptyKindSummary("leadgen"),
    regular: kindSummaries.find((item) => item.kind === "regular") ?? emptyKindSummary("regular"),
  };

  const categoryTotal = categories.reduce(
    (total, row) => ({
      qtyCurrent: total.qtyCurrent + row.qtyCurrent,
      qtyPrevious: total.qtyPrevious + row.qtyPrevious,
      qtyDelta: total.qtyDelta + row.qtyDelta,
      revenueCurrent: total.revenueCurrent + row.revenueCurrent,
    }),
    { qtyCurrent: 0, qtyPrevious: 0, qtyDelta: 0, revenueCurrent: 0 },
  );

  // 「关注」不写死系列名：本期收入前二 + 销量降幅最大，随数据自动变化
  const byRevenue = [...categories].sort((a, b) => b.revenueCurrent - a.revenueCurrent);
  const decline = [...categories].sort((a, b) => a.qtyDelta - b.qtyDelta)[0];
  const categoryFocus: CategoryFocus[] = byRevenue.slice(0, 2).map((row, index) => ({
    name: row.name,
    reason: `收入第 ${index + 1}`,
  }));
  if (decline && !categoryFocus.some((item) => item.name === decline.name)) {
    categoryFocus.push({ name: decline.name, reason: "销量降幅最大" });
  }

  const sums = bundles.reduce(
    (total, row) => ({
      amountPrevious: total.amountPrevious + row.amountPrevious,
      amountCurrent: total.amountCurrent + row.amountCurrent,
      amountDelta: total.amountDelta + row.amountDelta,
      qtyEffect: total.qtyEffect + row.qtyEffect,
      priceEffect: total.priceEffect + row.priceEffect,
    }),
    { amountPrevious: 0, amountCurrent: 0, amountDelta: 0, qtyEffect: 0, priceEffect: 0 },
  );
  const bundleTotals: BundleTotals = {
    ...sums,
    priceEffectShare: sums.amountDelta === 0 ? null : sums.priceEffect / sums.amountDelta,
  };

  const biggestQtyMove = [...categories].sort(
    (a, b) => Math.abs(b.qtyDelta) - Math.abs(a.qtyDelta),
  )[0];
  const leadgen = kindSummary.leadgen;
  const priceShare = bundleTotals.priceEffectShare;
  const qtyShare = priceShare === null ? null : 1 - priceShare;

  const insights = {
    category: biggestQtyMove
      ? `绝对增量最大的是${biggestQtyMove.name}：${formatInteger(biggestQtyMove.qtyPrevious)} → ` +
        `${formatInteger(biggestQtyMove.qtyCurrent)} 份（${formatSignedPercent(biggestQtyMove.qtyDeltaRate)}）`
      : "没有系列数据",
    bundle:
      `两期可比的 ${bundles.length} 个套餐合计 ${formatSignedAmount(bundleTotals.amountDelta)} 元，` +
      `其中销量影响 ${formatSignedAmount(bundleTotals.qtyEffect)} 元、` +
      `单价影响 ${formatSignedAmount(bundleTotals.priceEffect)} 元`,
    conclusion: "",
  };

  insights.conclusion = [
    insights.category,
    `套餐增量 ${formatPercent(leadgen.share)} 来自引流款（${formatSignedAmount(leadgen.amountDelta)} 元）`,
    `量价上看 ${formatPercent(qtyShare)} 靠销量、${formatPercent(priceShare)} 靠单价——` +
      "本期线上增收是「卖得更多」，不是「卖得更贵」",
  ].join("；");

  return {
    currentId: current.id,
    previousId: previous.id,
    currentLabel: current.label,
    previousLabel: previous.label,
    unit: seed.meta.currency_unit,
    sourceFile: seed.meta.source_file,
    categorySheet: seed.categorySheet,
    bundleSheet: seed.bundleSheet,
    categories,
    categoryTotal,
    categoryFocus,
    bundles,
    bundleTotalCount: seed.bundles.length,
    bundleTotals,
    kindSummaries,
    kindSummary,
    insights: { ...insights, conclusion: `${insights.conclusion}。` },
  };
}
