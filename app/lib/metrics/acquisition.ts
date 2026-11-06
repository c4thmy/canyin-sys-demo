import type { AcquisitionRecord, AcquisitionRow, AcquisitionStatus } from "./types.js";

/** 产投比与目标 ROI 相等判定的浮点容差。毛利额 ÷ 投入成本 可能得到 2.0000000000000004 */
const RATIO_EPSILON = 1e-9;

/**
 * 「刚好达标」的余量阈值：目标差率 ≤ 5% 视为没有余量。
 *
 * 大众点评产投比 2.00 / 目标 2.0，目标差率为 0，落在此区间——投放只是及格，
 * 没有安全垫。阈值只影响展示配色与文案，不改变达标判定。
 */
export const ACQUISITION_THRESHOLDS = { tightMarginRate: 0.05 } as const;

function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

/**
 * 增收提价健康度（表8）：新客量 → 客单价 → 毛利额 → 投入成本 → 产投比 vs 目标 ROI。
 *
 *   revenue     = 新客量 × 客单价 ÷ 10000          （元 → 万元，与收入口径一致）
 *   grossProfit = revenue × 毛利率
 *   spend       = 新客量 × 新客成本 ÷ 10000
 *   outputRatio = grossProfit ÷ spend = 客单价 × 毛利率 ÷ 新客成本
 *
 * 只从源表的原始字段（新客量 / 客单价 / 毛利率 / 新客成本 / 目标 ROI）重算，
 * 不读 acquisition.json 里已推算好的 revenue / gross_profit / output_ratio，
 * 避免用同一份推算结果自证。
 *
 * 达标判定：产投比 ≥ 目标 ROI；余量（目标差率）≤ ACQUISITION_THRESHOLDS.tightMarginRate
 * 记为 tight（刚好达标）。输出保持传入顺序。
 */
export function acquisitionHealth(
  acquisition: readonly AcquisitionRecord[],
): AcquisitionRow[] {
  return acquisition.map((record): AcquisitionRow => {
    const revenue = (record.newCustomers * record.ticket) / 10000;
    const grossProfit = revenue * record.grossMarginRate;
    const spend = (record.newCustomers * record.newCustomerCost) / 10000;
    const outputRatio = safeRatio(grossProfit, spend);
    const targetGap = outputRatio === null ? null : outputRatio - record.targetRoi;
    const targetGapRate =
      targetGap === null || record.targetRoi <= 0 ? null : targetGap / record.targetRoi;
    const meetsTarget = outputRatio !== null && outputRatio + RATIO_EPSILON >= record.targetRoi;

    let status: AcquisitionStatus = "met";
    if (!meetsTarget) {
      status = "short";
    } else if (targetGapRate !== null && targetGapRate <= ACQUISITION_THRESHOLDS.tightMarginRate) {
      status = "tight";
    }

    return {
      channel: record.channel,
      newCustomers: record.newCustomers,
      ticket: record.ticket,
      grossMarginRate: record.grossMarginRate,
      newCustomerCost: record.newCustomerCost,
      revenue,
      grossProfit,
      spend,
      outputRatio,
      targetRoi: record.targetRoi,
      targetGap,
      targetGapRate,
      meetsTarget,
      status,
    };
  });
}
