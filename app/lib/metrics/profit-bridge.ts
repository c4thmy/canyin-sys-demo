import { amountFor, resolvePeriodPair } from "./period.js";
import type { PeriodInput, PnlItem, ProfitBridgeKind, ProfitBridgeNode } from "./types.js";

/** 变动成本项：effect = 本期收入 ×（上期费率 − 本期费率），费率 = 金额 / 当期营业收入 */
const VARIABLE_ITEMS = [
  { key: "foodCost", label: "食材成本率", item: "食材成本" },
  { key: "discount", label: "优惠及手续费", item: "优惠及手续费" },
  { key: "utilities", label: "水电气低值", item: "水电气低值" },
  { key: "marketing", label: "宣传费用", item: "宣传费用" },
] as const;

/** 固定成本项：effect = −(本期金额 − 上期金额)，成本增加记为负贡献 */
const FIXED_ITEMS = [
  { key: "salary", label: "工资奖金", item: "工资奖金" },
  { key: "dormitory", label: "宿舍房租", item: "宿舍房租" },
  { key: "rent", label: "店铺房租", item: "店铺房租" },
  { key: "other", label: "其它费用", item: "其它费用" },
] as const;

const REVENUE_ITEM = "营业收入";

/**
 * 利润桥：把营业利润同比拆成 9 个因素，返回瀑布图节点。
 *
 * - 收入规模 = Δ收入 × 上期边际贡献率；
 *   边际贡献率 = (营业收入 − 变动成本) / 营业收入，变动成本取本文件四项（见领域模型第 6 节）。
 * - 变动成本四项用「本期收入 ×（上期费率 − 本期费率）」，固定成本四项用绝对额变动。
 * - 四项费率效应与四项绝对额效应相加，在代数上可闭合到本期营业利润；
 *   若边际贡献率只扣食材成本，则链式替代与绝对额混用会留下近似误差，
 *   因此单测仍保留 1 的容差，实际数据也存在四舍五入。
 * - 节点顺序固定：去年营业利润 → 收入规模 → 食材成本率 → 优惠及手续费 → 水电气低值
 *   → 宣传费用 → 工资奖金 → 宿舍房租 → 店铺房租 → 其它费用 → 今年营业利润。
 */
export function profitBridge(pnl: readonly PnlItem[], periods: PeriodInput): ProfitBridgeNode[] {
  const { current, previous } = resolvePeriodPair(periods);
  const amounts = new Map<string, PnlItem["values"]>();
  for (const { item, values } of pnl) {
    if (amounts.has(item)) {
      throw new Error(`利润表项目重复：${item}`);
    }
    amounts.set(item, values);
  }

  const valueOf = (item: string, period: string): number => {
    const values = amounts.get(item);
    if (!values) {
      throw new Error(`利润表缺少项目：${item}`);
    }
    return amountFor(values, period);
  };

  const profitAt = (period: string): number => {
    let profit = valueOf(REVENUE_ITEM, period);
    for (const { item } of [...VARIABLE_ITEMS, ...FIXED_ITEMS]) {
      profit -= valueOf(item, period);
    }
    return profit;
  };

  const revenue0 = valueOf(REVENUE_ITEM, previous);
  const revenue1 = valueOf(REVENUE_ITEM, current);
  const variable0 = VARIABLE_ITEMS.reduce((sum, { item }) => sum + valueOf(item, previous), 0);
  const marginPrevious = revenue0 === 0 ? 0 : (revenue0 - variable0) / revenue0;

  const nodes: ProfitBridgeNode[] = [];
  let cumulative = profitAt(previous);
  nodes.push({
    key: "lastYearProfit",
    label: "去年营业利润",
    effect: 0,
    cumulative,
    kind: "start",
  });

  const push = (key: string, label: string, effect: number): void => {
    cumulative += effect;
    const kind: ProfitBridgeKind = effect >= 0 ? "up" : "down";
    nodes.push({ key, label, effect, cumulative, kind });
  };

  push("revenue", "收入规模", (revenue1 - revenue0) * marginPrevious);

  for (const { key, label, item } of VARIABLE_ITEMS) {
    const rate0 = revenue0 === 0 ? 0 : valueOf(item, previous) / revenue0;
    const rate1 = revenue1 === 0 ? 0 : valueOf(item, current) / revenue1;
    push(key, label, revenue1 * (rate0 - rate1));
  }

  for (const { key, label, item } of FIXED_ITEMS) {
    push(key, label, -(valueOf(item, current) - valueOf(item, previous)));
  }

  nodes.push({
    key: "thisYearProfit",
    label: "今年营业利润",
    effect: 0,
    cumulative: profitAt(current),
    kind: "end",
  });

  return nodes;
}
