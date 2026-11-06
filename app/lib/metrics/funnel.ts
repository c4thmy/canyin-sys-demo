import type { FunnelCounts, FunnelRates, FunnelSummary } from "./types.js";

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

/**
 * 多门店漏斗汇总：四级人数逐级相加，再按汇总人数算转化率。
 *
 * 空值（源表 `--`）跳过不参与求和——某店缺支付人数不代表它有 0 个支付人数。
 * 汇总口径的转化率是「总量之比」而非「各店转化率的平均」，两者不等价，
 * 页面展示汇总漏斗时必须用这一口径。
 */
export function funnelSummary(records: readonly FunnelCounts[]): FunnelSummary {
  const sum = (pick: (record: FunnelCounts) => number | null): number | null => {
    let total: number | null = null;
    for (const record of records) {
      const value = pick(record);
      if (value !== null) {
        total = (total ?? 0) + value;
      }
    }
    return total;
  };

  const counts: FunnelCounts = {
    exposure: sum((record) => record.exposure),
    visits: sum((record) => record.visits),
    payments: sum((record) => record.payments),
    consumers: sum((record) => record.consumers),
  };

  return { counts, rates: funnelRates(counts) };
}
