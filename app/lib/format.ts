const amountFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 金额：千分位 + 两位小数 */
export function formatAmount(value: number): string {
  return amountFormatter.format(value);
}

/** 带符号金额：正数 +，负数 −，零不带符号 */
export function formatSignedAmount(value: number): string {
  if (value === 0) {
    return amountFormatter.format(0);
  }
  return `${value > 0 ? "+" : "−"}${amountFormatter.format(Math.abs(value))}`;
}

/** 比率（0–1）转百分比 */
export function formatPercent(rate: number | null, digits = 2): string {
  if (rate === null || !Number.isFinite(rate)) {
    return "—";
  }
  return `${(rate * 100).toFixed(digits)}%`;
}

/** 带符号百分比 */
export function formatSignedPercent(rate: number | null, digits = 2): string {
  if (rate === null || !Number.isFinite(rate)) {
    return "—";
  }
  const sign = rate > 0 ? "+" : rate < 0 ? "−" : "";
  return `${sign}${Math.abs(rate * 100).toFixed(digits)}%`;
}

/** 带符号百分点数值（单位由调用方补） */
export function formatPoints(points: number, digits = 2): string {
  const sign = points > 0 ? "+" : points < 0 ? "−" : "";
  return `${sign}${Math.abs(points).toFixed(digits)}`;
}

const integerFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

/** 整数：千分位，四舍五入到个位（用于客流人次等） */
export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

/** 带符号整数：正数 +，负数 −，零不带符号 */
export function formatSignedInteger(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return integerFormatter.format(0);
  }
  return `${rounded > 0 ? "+" : "−"}${integerFormatter.format(Math.abs(rounded))}`;
}
