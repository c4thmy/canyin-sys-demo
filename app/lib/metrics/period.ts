import type { PeriodInput, PeriodPair } from "./types.js";

const PERIOD_PATTERN = /^(\d{4})-(\d{2})$/;

function assertPeriod(period: string): void {
  if (!PERIOD_PATTERN.test(period)) {
    throw new Error(`无法识别的期间格式：${period}（应形如 2025-09）`);
  }
}

/**
 * 解析期间入参。
 * - 传入 "2025-09" 时，上年同期自动取 "2024-09"。
 * - 传入 { current, previous } 时原样返回，便于非自然年口径扩展。
 */
export function resolvePeriodPair(period: PeriodInput): PeriodPair {
  if (typeof period !== "string") {
    assertPeriod(period.current);
    assertPeriod(period.previous);
    return period;
  }

  assertPeriod(period);
  const year = Number(period.slice(0, 4));
  const month = period.slice(5, 7);
  return { current: period, previous: `${year - 1}-${month}` };
}

/** 读取某期间的数值，缺失视为 0（如新店上年同期无收入） */
export function amountFor(values: Readonly<Record<string, number>>, period: string): number {
  return values[period] ?? 0;
}

/**
 * 读取某期间的可空数值：缺失与 null 都返回 null。
 * 与 amountFor 的区别是「没有数据」不等于「0」——套餐的单期缺失、系列缺失的 2024 单价
 * 必须在计算前被识别出来，不能当成 0 参与分解。
 */
export function optionalAmountFor(
  values: Readonly<Record<string, number | null | undefined>>,
  period: string,
): number | null {
  const value = values[period];
  return value === undefined || value === null ? null : value;
}
