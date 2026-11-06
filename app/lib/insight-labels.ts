import type { InsightCategory, InsightSeverity } from "./metrics/index.js";

/** 结论卡片的分类中文名 */
export const INSIGHT_CATEGORY_LABELS: Readonly<Record<InsightCategory, string>> = {
  growth: "增长",
  cost: "成本",
  channel: "渠道",
  product: "产品",
  risk: "风险",
};

/** 结论卡片的严重度中文名 */
export const INSIGHT_SEVERITY_LABELS: Readonly<Record<InsightSeverity, string>> = {
  positive: "正向",
  warning: "关注",
  critical: "严重",
};

/** 下钻页的中文名；用于「查看下钻」与证据链接的可读文案 */
export const DRILL_LABELS: Readonly<Record<string, string>> = {
  "/": "经营总览",
  "/revenue/structure": "收入结构",
  "/revenue/same-store": "同店异动",
  "/revenue/channel": "渠道下钻",
  "/revenue/product": "产品下钻",
};

export function drillLabelOf(link: string | undefined): string {
  if (!link) {
    return "下钻页";
  }
  return DRILL_LABELS[link] ?? "下钻页";
}
