import { chainQtyPrice } from "./decomposition.js";
import { amountFor, optionalAmountFor, resolvePeriodPair } from "./period.js";
import type {
  Bundle,
  BundleDecompositionRow,
  BundleKind,
  BundleKindSummary,
  Category,
  CategoryMixRow,
  PeriodInput,
} from "./types.js";

/**
 * 引流款判定：套餐名里带活动价标识。
 * 只用于「增量来自哪一类」的归类，不参与任何金额计算；规则集中在这里，便于随业务改口径。
 */
export const BUNDLE_LEADGEN_KEYWORDS = ["秒杀", "miao杀", "超值", "福利", "活动"] as const;

/** 按套餐名判断引流款 / 正价套餐 */
export function bundleKindOf(name: string): BundleKind {
  const normalized = name.toLowerCase();
  const hit = BUNDLE_LEADGEN_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  );
  return hit ? "leadgen" : "regular";
}

function safeRate(delta: number, base: number): number | null {
  return base === 0 ? null : delta / base;
}

/**
 * 系列销量结构：8 个系列的 2025 / 2024 销量、销量差与增减率、2025 平均单价、2025 收入与占比。
 *
 * 刻意**不输出 2024 收入与 2024 单价**，也不做销量 × 单价分解：
 * 源表缺 2024 年系列单价，2024 收入是按「2024 销量 × 2025 单价」等比推算的，
 * 在系列层做分解会得到每个系列相同的假涨幅（见 tasks.md 第 5 组说明）。
 *
 * 排序：本期收入降序，同额按系列名升序。
 */
export function categoryMix(
  categories: readonly Category[],
  period: PeriodInput,
): CategoryMixRow[] {
  const { current, previous } = resolvePeriodPair(period);

  const rows = categories.map((category) => {
    const qtyCurrent = amountFor(category.qty, current);
    const qtyPrevious = amountFor(category.qty, previous);
    const qtyDelta = qtyCurrent - qtyPrevious;
    return {
      id: category.id,
      name: category.name,
      qtyPrevious,
      qtyCurrent,
      qtyDelta,
      qtyDeltaRate: safeRate(qtyDelta, qtyPrevious),
      unitPriceCurrent: optionalAmountFor(category.unitPrice, current),
      revenueCurrent: amountFor(category.revenue, current),
    };
  });

  const totalRevenue = rows.reduce((total, row) => total + row.revenueCurrent, 0);

  return rows
    .map((row): CategoryMixRow => ({
      ...row,
      share: totalRevenue === 0 ? 0 : row.revenueCurrent / totalRevenue,
    }))
    .sort(
      (a, b) =>
        b.revenueCurrent - a.revenueCurrent || a.name.localeCompare(b.name, "zh-Hans-CN"),
    );
}

/**
 * 套餐量价分解（连环替代法，先量后价，与全站口径一致）。
 *
 *   price0      = amount0 ÷ qty0，price1 = amount1 ÷ qty1
 *   qtyEffect   = (qty1 − qty0) × price0
 *   priceEffect = qty1 × (price1 − price0)
 *   amountDelta = amount1 − amount0 = qtyEffect + priceEffect
 *
 * 只用**两期都有数量与销售额**的套餐：单期出现的是新上架或已下架套餐，
 * 没有可比基期，强行分解会把「上架」当成纯增量。qty 为 0 时单价无法计算，同样跳过。
 *
 * 排序：收入差降序，同额按套餐编号升序。
 */
export function bundleDecompose(
  bundles: readonly Bundle[],
  period: PeriodInput,
): BundleDecompositionRow[] {
  const { current, previous } = resolvePeriodPair(period);
  const rows: BundleDecompositionRow[] = [];

  for (const bundle of bundles) {
    const qtyPrevious = optionalAmountFor(bundle.qty, previous);
    const qtyCurrent = optionalAmountFor(bundle.qty, current);
    const amountPrevious = optionalAmountFor(bundle.amount, previous);
    const amountCurrent = optionalAmountFor(bundle.amount, current);
    if (
      qtyPrevious === null ||
      qtyCurrent === null ||
      amountPrevious === null ||
      amountCurrent === null ||
      qtyPrevious <= 0 ||
      qtyCurrent <= 0
    ) {
      continue;
    }

    const pricePrevious = amountPrevious / qtyPrevious;
    const priceCurrent = amountCurrent / qtyCurrent;
    const { qtyEffect, priceEffect, total } = chainQtyPrice({
      qty0: qtyPrevious,
      price0: pricePrevious,
      qty1: qtyCurrent,
      price1: priceCurrent,
    });
    const discount = bundle.discount ? optionalAmountFor(bundle.discount, current) : null;

    rows.push({
      id: bundle.id,
      name: bundle.name,
      kind: bundleKindOf(bundle.name),
      qtyPrevious,
      qtyCurrent,
      qtyDelta: qtyCurrent - qtyPrevious,
      qtyDeltaRate: safeRate(qtyCurrent - qtyPrevious, qtyPrevious),
      amountPrevious,
      amountCurrent,
      pricePrevious,
      priceCurrent,
      priceDelta: priceCurrent - pricePrevious,
      priceDeltaRate: safeRate(priceCurrent - pricePrevious, pricePrevious),
      qtyEffect,
      priceEffect,
      amountDelta: total,
      discountRate:
        discount === null || amountCurrent === 0 ? null : discount / amountCurrent,
    });
  }

  return rows.sort((a, b) => b.amountDelta - a.amountDelta || a.id.localeCompare(b.id));
}

/**
 * 按引流款 / 正价套餐汇总收入差。
 *
 * share 为该类型收入差占**全部可比套餐收入差合计**的比重（不是按 |收入差| 归一），
 * 所以两类占比之和为 1；合计为 0 时 share 为 null。两类始终都输出，便于页面稳定渲染。
 */
export function bundleKindSummary(
  rows: readonly BundleDecompositionRow[],
): BundleKindSummary[] {
  const totalDelta = rows.reduce((total, row) => total + row.amountDelta, 0);
  const kinds: readonly BundleKind[] = ["leadgen", "regular"];

  return kinds.map((kind) => {
    const members = rows.filter((row) => row.kind === kind);
    const amountDelta = members.reduce((total, row) => total + row.amountDelta, 0);
    return {
      kind,
      count: members.length,
      amountDelta,
      share: totalDelta === 0 ? null : amountDelta / totalDelta,
    };
  });
}
