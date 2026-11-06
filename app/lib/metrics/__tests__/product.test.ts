import { describe, expect, it } from "vitest";

import { bundleDecompose, bundleKindOf, bundleKindSummary, categoryMix } from "../product.js";
import type { Bundle, CategoryMixRow } from "../types.js";
import { bundleById, bundles, categories } from "./fixtures.js";

const PERIOD = "2025-09";

function categoryByName(rows: readonly CategoryMixRow[], name: string): CategoryMixRow {
  const row = rows.find((item) => item.name === name);
  if (!row) {
    throw new Error(`找不到系列 ${name}`);
  }
  return row;
}

describe("categoryMix · 8 个系列销量结构", () => {
  const rows = categoryMix(categories, PERIOD);

  it("输出 8 个系列，按 2025 收入降序", () => {
    expect(rows).toHaveLength(8);
    const revenues = rows.map((row) => row.revenueCurrent);
    expect(revenues).toEqual([...revenues].sort((a, b) => b - a));
    expect(rows[0]?.name).toBe("肉类");
  });

  it("肉类 113,280 → 152,127（+38,847，+34.3%）", () => {
    const row = categoryByName(rows, "肉类");

    expect(row.qtyPrevious).toBe(113280);
    expect(row.qtyCurrent).toBe(152127);
    expect(row.qtyDelta).toBe(38847);
    expect(row.qtyDeltaRate).toBeCloseTo(38847 / 113280, 10);
    expect((row.qtyDeltaRate ?? 0) * 100).toBeCloseTo(34.3, 1);
  });

  it("涮品类 80,860 → 107,684（+26,824，+33.2%）", () => {
    const row = categoryByName(rows, "涮品类");

    expect(row.qtyPrevious).toBe(80860);
    expect(row.qtyCurrent).toBe(107684);
    expect((row.qtyDeltaRate ?? 0) * 100).toBeCloseTo(33.2, 1);
  });

  it("凉菜 17,511 → 5,607（−11,904，−68.0%）", () => {
    const row = categoryByName(rows, "凉菜");

    expect(row.qtyPrevious).toBe(17511);
    expect(row.qtyCurrent).toBe(5607);
    expect(row.qtyDelta).toBe(-11904);
    expect((row.qtyDeltaRate ?? 0) * 100).toBeCloseTo(-68.0, 1);
    expect(row.qtyDeltaRate).toBeLessThan(0);
  });

  it("2025 收入合计 1000.00 万元，占比之和为 1", () => {
    const total = rows.reduce((sum, row) => sum + row.revenueCurrent, 0);
    expect(Math.abs(total - 1000)).toBeLessThanOrEqual(0.01);

    const shareSum = rows.reduce((sum, row) => sum + row.share, 0);
    expect(shareSum).toBeCloseTo(1, 10);
    expect(categoryByName(rows, "肉类").share).toBeCloseTo(546 / 1000, 10);
  });

  it("2025 平均单价取源表值，肉类 35.90 元/份", () => {
    expect(categoryByName(rows, "肉类").unitPriceCurrent).toBeCloseTo(35.8957, 4);
  });

  it("不做量价分解：行内没有 2024 收入 / 2024 单价字段", () => {
    const row = rows[0] as unknown as Record<string, unknown>;

    expect(row).not.toHaveProperty("revenuePrevious");
    expect(row).not.toHaveProperty("unitPricePrevious");
    expect(row).not.toHaveProperty("priceEffect");
  });

  it("空系列列表返回空数组", () => {
    expect(categoryMix([], PERIOD)).toEqual([]);
  });
});

describe("bundleDecompose · 套餐量价分解", () => {
  const rows = bundleDecompose(bundles, PERIOD);

  it("31 个套餐里正好 11 个两期都有数据", () => {
    expect(bundles).toHaveLength(31);
    expect(rows).toHaveLength(11);
  });

  it("只保留两期齐全的套餐：单期新上架的 B03、B26 不在结果里", () => {
    const ids = rows.map((row) => row.id);

    expect(ids).not.toContain("B03");
    expect(ids).not.toContain("B26");
    expect(ids).toContain("B02");
  });

  it("按收入差降序，第一行是秒杀引流款", () => {
    const deltas = rows.map((row) => row.amountDelta);
    expect(deltas).toEqual([...deltas].sort((a, b) => b - a));
    expect(rows[0]?.id).toBe("B02");
  });

  it("#超值miao杀！#单人豪华吃饱饱3荤8素河粉套餐：89 → 495 份，8,277 → 46,035 元", () => {
    const row = bundleById("B02");
    const decomposed = rows.find((item) => item.id === "B02");

    expect(row.qty).toMatchObject({ "2024-09": 89, "2025-09": 495 });
    expect(row.amount).toMatchObject({ "2024-09": 8277, "2025-09": 46035 });

    expect(decomposed?.qtyPrevious).toBe(89);
    expect(decomposed?.qtyCurrent).toBe(495);
    expect(decomposed?.amountPrevious).toBe(8277);
    expect(decomposed?.amountCurrent).toBe(46035);
    expect(decomposed?.amountDelta).toBe(37758);
    expect(decomposed?.qtyDelta).toBe(406);
  });

  it("B02 单价两期都是 93 元：增量 37,758 元全部来自销量，单价影响为 0", () => {
    const row = rows.find((item) => item.id === "B02");

    expect(row?.pricePrevious).toBeCloseTo(93, 10);
    expect(row?.priceCurrent).toBeCloseTo(93, 10);
    expect(row?.qtyEffect).toBeCloseTo(37758, 10);
    expect(row?.priceEffect).toBeCloseTo(0, 10);
  });

  it("先量后价：销量影响 + 单价影响恒等于收入差", () => {
    for (const row of rows) {
      expect(row.qtyEffect + row.priceEffect).toBeCloseTo(row.amountDelta, 8);
    }
  });

  it("11 个可比套餐的单价影响合计只有 6 元（全部来自 B07，单价 472.00 → 472.30）", () => {
    const totalPriceEffect = rows.reduce((sum, row) => sum + row.priceEffect, 0);
    const totalQtyEffect = rows.reduce((sum, row) => sum + row.qtyEffect, 0);

    expect(totalPriceEffect).toBeCloseTo(6, 6);
    expect(totalQtyEffect).toBeCloseTo(87066, 6);
    expect(rows.find((row) => row.id === "B07")?.priceDelta).toBeCloseTo(0.3, 10);
  });

  it("优惠率取本期优惠额 ÷ 本期销售额，B02 为 61.4%", () => {
    const row = rows.find((item) => item.id === "B02");

    expect(row?.discountRate ?? 0).toBeCloseTo(28246.07 / 46035, 10);
    expect((row?.discountRate ?? 0) * 100).toBeCloseTo(61.4, 1);
  });

  it("销量下降到 0 份的套餐无单价可言，跳过不分解", () => {
    const edge: readonly Bundle[] = [
      {
        id: "B99",
        name: "下架套餐",
        qty: { "2024-09": 10, "2025-09": 0 },
        amount: { "2024-09": 1000, "2025-09": 0 },
      },
    ];

    expect(bundleDecompose(edge, PERIOD)).toEqual([]);
  });

  it("空套餐列表返回空数组", () => {
    expect(bundleDecompose([], PERIOD)).toEqual([]);
  });
});

describe("bundleKindOf / bundleKindSummary · 引流款 vs 正价套餐", () => {
  it("套餐名带「秒杀 / 超值」等活动标识视为引流款", () => {
    expect(bundleKindOf("#超值miao杀！#单人豪华吃饱饱3荤8素河粉套餐")).toBe("leadgen");
    expect(bundleKindOf("#超值#单人豪华吃饱饱3荤8素河粉套餐")).toBe("leadgen");
    expect(bundleKindOf("超值单人套餐")).toBe("leadgen");
    expect(bundleKindOf("【一桌吃遍潮汕鲜】双人套餐")).toBe("regular");
    expect(bundleKindOf("潮汕鲜牛牛丸3荤6素河粉套餐")).toBe("regular");
  });

  it("11 个可比套餐里 4 个引流款、7 个正价套餐", () => {
    const rows = bundleDecompose(bundles, PERIOD);
    const summary = bundleKindSummary(rows);
    const leadgen = summary.find((item) => item.kind === "leadgen");
    const regular = summary.find((item) => item.kind === "regular");

    expect(leadgen?.count).toBe(4);
    expect(regular?.count).toBe(7);
  });

  it("引流款贡献 +69,836 元、占增量 80.2%；正价套餐 +17,236 元", () => {
    const rows = bundleDecompose(bundles, PERIOD);
    const summary = bundleKindSummary(rows);
    const leadgen = summary.find((item) => item.kind === "leadgen");
    const regular = summary.find((item) => item.kind === "regular");

    expect(leadgen?.amountDelta).toBeCloseTo(69836, 6);
    expect(regular?.amountDelta).toBeCloseTo(17236, 6);
    expect(leadgen?.share ?? 0).toBeCloseTo(0.8020, 3);
    expect((leadgen?.share ?? 0) + (regular?.share ?? 0)).toBeCloseTo(1, 10);
  });

  it("空输入仍输出两类，占比为 null", () => {
    const summary = bundleKindSummary([]);

    expect(summary.map((item) => item.kind)).toEqual(["leadgen", "regular"]);
    expect(summary.every((item) => item.count === 0)).toBe(true);
    expect(summary.every((item) => item.share === null)).toBe(true);
  });
});
