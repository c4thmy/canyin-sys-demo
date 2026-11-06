import type { ChannelRoiInput, ChannelRoiResult } from "./types.js";

/**
 * 线上放量健康判断阈值，来自 docs/domain/revenue-analysis-model.md 第 4 节：
 * - 平台费用率 ≤ 15%
 * - 线上 ROI（毛利口径）≥ 1
 * - 线上 ROI（销售额口径）≥ 4
 */
export const ROI_THRESHOLDS = {
  maxFeeRate: 0.15,
  minGrossRoi: 1,
  minSalesRoi: 4,
} as const;

function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

/**
 * 渠道 ROI：费用率与两个口径的 ROI，并给出是否同时满足放量阈值。
 *
 * 样例数据目前没有平台费用与平台毛利额字段，本函数只做纯计算，
 * 待接入真实渠道费用数据后即可直接使用。
 */
export function channelRoi(input: ChannelRoiInput): ChannelRoiResult {
  const feeRate = safeRatio(input.platformFee, input.platformRevenue);
  const grossRoi = safeRatio(input.platformGrossProfit, input.platformFee);
  const salesRoi = safeRatio(input.platformRevenue, input.platformFee);

  const healthy =
    feeRate === null || grossRoi === null || salesRoi === null
      ? null
      : feeRate <= ROI_THRESHOLDS.maxFeeRate &&
        grossRoi >= ROI_THRESHOLDS.minGrossRoi &&
        salesRoi >= ROI_THRESHOLDS.minSalesRoi;

  return { feeRate, grossRoi, salesRoi, healthy };
}
