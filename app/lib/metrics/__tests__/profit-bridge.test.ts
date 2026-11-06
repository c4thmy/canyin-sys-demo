import { describe, expect, it } from "vitest";

import { profitBridge } from "../profit-bridge.js";
import type { PnlItem, ProfitBridgeNode } from "../types.js";
import { pnl } from "./fixtures.js";

/** 手算对照：本期 2025-09，上年同期 2024-09 */
const PERIOD = "2025-09";

const EXPECTED_KEYS = [
  "lastYearProfit",
  "revenue",
  "foodCost",
  "discount",
  "utilities",
  "marketing",
  "salary",
  "dormitory",
  "rent",
  "other",
  "thisYearProfit",
];

const EXPECTED_LABELS = [
  "去年营业利润",
  "收入规模",
  "食材成本率",
  "优惠及手续费",
  "水电气低值",
  "宣传费用",
  "工资奖金",
  "宿舍房租",
  "店铺房租",
  "其它费用",
  "今年营业利润",
];

function byKey(nodes: readonly ProfitBridgeNode[], key: string): ProfitBridgeNode {
  const node = nodes.find((item) => item.key === key);
  if (!node) {
    throw new Error(`找不到利润桥节点 ${key}`);
  }
  return node;
}

/** 因素 effect 之和（排除起止节点） */
function effectsTotal(nodes: readonly ProfitBridgeNode[]): number {
  return nodes
    .filter((node) => node.kind === "up" || node.kind === "down")
    .reduce((sum, node) => sum + node.effect, 0);
}

describe("profitBridge · 节点与口径", () => {
  const nodes = profitBridge(pnl, PERIOD);

  it("节点顺序与显示名固定为 PPT 口径", () => {
    expect(nodes.map((node) => node.key)).toEqual(EXPECTED_KEYS);
    expect(nodes.map((node) => node.label)).toEqual(EXPECTED_LABELS);
  });

  it("起止节点为 start/end，中间因素按正负标 up/down", () => {
    expect(nodes[0].kind).toBe("start");
    expect(nodes[nodes.length - 1].kind).toBe("end");
    for (const node of nodes.slice(1, -1)) {
      expect(node.kind).toBe(node.effect >= 0 ? "up" : "down");
    }
    expect(nodes[0].effect).toBe(0);
    expect(nodes[nodes.length - 1].effect).toBe(0);
  });

  it("去年营业利润 64.60，今年营业利润 112.70", () => {
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    expect(first.cumulative).toBeCloseTo(64.6, 2);
    expect(last.cumulative).toBeCloseTo(112.7, 2);
  });

  it("每个因素 effect 与 PPT 口径一致（容差 2）", () => {
    const expected: Readonly<Record<string, number>> = {
      revenue: 100,
      foodCost: -10,
      discount: 13,
      utilities: 2,
      marketing: 7,
      salary: -12,
      dormitory: -2,
      rent: -14,
      other: -37,
    };
    for (const [key, value] of Object.entries(expected)) {
      expect(Math.abs(byKey(nodes, key).effect - value)).toBeLessThan(2);
    }
  });

  it("所有因素 effect 之和 + 去年营业利润 ≈ 今年营业利润（容差 1）", () => {
    const previousProfit = nodes[0].cumulative;
    const currentProfit = nodes[nodes.length - 1].cumulative;
    const gap = previousProfit + effectsTotal(nodes) - currentProfit;
    expect(Math.abs(gap)).toBeLessThan(1);
  });

  it("累计值逐节点连贯", () => {
    for (let index = 1; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (node.kind === "start" || node.kind === "end") {
        continue;
      }
      expect(node.cumulative).toBeCloseTo(nodes[index - 1].cumulative + node.effect, 9);
    }
  });

  it("变动成本按「本期收入 ×（上期费率 − 本期费率）」计算", () => {
    const foodCost = byKey(nodes, "foodCost");
    const expected = 1000 * (195 / 760 - 267 / 1000);
    expect(foodCost.effect).toBeCloseTo(expected, 9);
    expect(foodCost.effect).toBeCloseTo(-10.4210526316, 6);
  });

  it("收入规模用上期边际贡献率（变动成本 = 食材 + 优惠 + 水电气 + 宣传）", () => {
    const revenue = byKey(nodes, "revenue");
    const marginPrevious = (760 - (195 + 188.4 + 32 + 26.4)) / 760;
    expect(marginPrevious).toBeCloseTo(0.4186842105, 9);
    expect(revenue.effect).toBeCloseTo(240 * marginPrevious, 9);
    expect(revenue.effect).toBeCloseTo(100.4842105263, 6);
  });

  it("合成数据：费率与固定成本不变时，只剩收入规模效应", () => {
    const flat: readonly PnlItem[] = [
      { item: "营业收入", values: { "2024-09": 100, "2025-09": 200 } },
      { item: "食材成本", values: { "2024-09": 20, "2025-09": 40 } },
      { item: "优惠及手续费", values: { "2024-09": 5, "2025-09": 10 } },
      { item: "水电气低值", values: { "2024-09": 2, "2025-09": 4 } },
      { item: "宣传费用", values: { "2024-09": 1, "2025-09": 2 } },
      { item: "工资奖金", values: { "2024-09": 10, "2025-09": 10 } },
      { item: "宿舍房租", values: { "2024-09": 1, "2025-09": 1 } },
      { item: "店铺房租", values: { "2024-09": 5, "2025-09": 5 } },
      { item: "其它费用", values: { "2024-09": 2, "2025-09": 2 } },
    ];
    const result = profitBridge(flat, PERIOD);
    expect(byKey(result, "revenue").effect).toBeCloseTo(72, 9);
    for (const key of ["foodCost", "discount", "utilities", "marketing", "salary", "dormitory", "rent", "other"]) {
      expect(byKey(result, key).effect).toBeCloseTo(0, 9);
    }
    expect(result[0].cumulative).toBeCloseTo(54, 9);
    expect(result[result.length - 1].cumulative).toBeCloseTo(126, 9);
  });
});

describe("profitBridge · 入参校验", () => {
  it("缺少利润表项目时抛错", () => {
    const incomplete = pnl.filter((item) => item.item !== "店铺房租");
    expect(() => profitBridge(incomplete, PERIOD)).toThrow(/利润表缺少项目：店铺房租/);
  });

  it("项目重复时抛错", () => {
    expect(() => profitBridge([...pnl, ...pnl], PERIOD)).toThrow(/利润表项目重复/);
  });
});
