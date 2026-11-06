import type { FunnelCounts, FunnelRates } from "./types.js";

/** 安全除法：分子或分母为 null、分母为 0 时返回 null，避免 NaN / Infinity */
function safeRate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

/**
 * 渠道漏斗转化率。
 *
 *   visitRate   = visits / exposure
 *   payRate     = payments / visits
 *   consumeRate = consumers / payments
 *   overallRate = consumers / exposure
 *
 * 源表空值（`--`）以 null 传入，任一环节缺失时该环节及后续无法计算的比率返回 null。
 * 四级人数全部具备时，overallRate 恒等于三个分环节转化率之积（允许浮点误差）。
 */
export function funnelRates(funnel: FunnelCounts): FunnelRates {
  return {
    visitRate: safeRate(funnel.visits, funnel.exposure),
    payRate: safeRate(funnel.payments, funnel.visits),
    consumeRate: safeRate(funnel.consumers, funnel.payments),
    overallRate: safeRate(funnel.consumers, funnel.exposure),
  };
}
