import { describe, expect, it } from "vitest";

import { aggregate } from "../aggregate.js";
import { resolvePeriodPair } from "../period.js";
import type { AggregateGroup } from "../types.js";
import { categories, channels, stores } from "./fixtures.js";

/** 手算对照基准：本期 2025-09，上年同期 2024-09 */
const PERIOD = "2025-09";

function byKey(groups: readonly AggregateGroup[], key: string): AggregateGroup {
  const group = groups.find((item) => item.key === key);
  if (!group) {
    throw new Error(`找不到分组 ${key}`);
  }
  return group;
}

describe("aggregate · 期间解析", () => {
  it("只给本期字符串时自动推算上年同期", () => {
    expect(resolvePeriodPair("2025-09")).toEqual({ current: "2025-09", previous: "2024-09" });
    expect(resolvePeriodPair("2024-09")).toEqual({ current: "2024-09", previous: "2023-09" });
  });

  it("显式传入期间对时原样使用", () => {
    expect(resolvePeriodPair({ current: "2025-09", previous: "2024-09" })).toEqual({
      current: "2025-09",
      previous: "2024-09",
    });
  });

  it("期间格式非法时抛错", () => {
    expect(() => resolvePeriodPair("2025/09")).toThrow(/期间格式/);
    expect(() => resolvePeriodPair({ current: "2025-09", previous: "2024/09" })).toThrow(/期间格式/);
  });
});

describe("aggregate · 真实数据手算对照（data/seed）", () => {
  it("门店合计：2024-09 = 759.95，2025-09 = 1000.23", () => {
    const groups = aggregate(stores, "store", PERIOD);
    expect(groups).toHaveLength(15);

    const current = groups.reduce((sum, group) => sum + group.revenue, 0);
    const previous = groups.reduce((sum, group) => sum + group.prevRevenue, 0);

    expect(current).toBeCloseTo(1000.23, 2);
    expect(previous).toBeCloseTo(759.95, 2);
  });

  it("渠道合计：2024-09 = 759.56，2025-09 = 1000.00", () => {
    const groups = aggregate(channels, "channel", PERIOD);

    const current = groups.reduce((sum, group) => sum + group.revenue, 0);
    const previous = groups.reduce((sum, group) => sum + group.prevRevenue, 0);

    expect(current).toBeCloseTo(1000.0, 2);
    expect(previous).toBeCloseTo(759.56, 2);
    expect(groups).toHaveLength(10);
  });

  it("品类合计：2024-09 = 759.95，2025-09 = 1000.00", () => {
    const groups = aggregate(categories, "category", PERIOD);

    const current = groups.reduce((sum, group) => sum + group.revenue, 0);
    const previous = groups.reduce((sum, group) => sum + group.prevRevenue, 0);

    expect(current).toBeCloseTo(1000.0, 2);
    // 2024 品类收入为推算值，逐项相加为 759.9499，与门店口径差 0.0001
    expect(previous).toBeCloseTo(759.95, 3);
    expect(groups).toHaveLength(8);
  });

  it("肉类：销量 113280 → 152127，收入 398.368 → 546.0", () => {
    const meat = categories.find((item) => item.name === "肉类");
    expect(meat).toBeDefined();
    expect(meat?.qty["2024-09"]).toBe(113280);
    expect(meat?.qty["2025-09"]).toBe(152127);
    expect(meat?.revenue["2024-09"]).toBeCloseTo(398.368, 3);
    expect(meat?.revenue["2025-09"]).toBeCloseTo(546.0, 3);

    const group = byKey(aggregate(categories, "category", PERIOD), "肉类");
    expect(group.revenue).toBeCloseTo(546.0, 3);
    expect(group.prevRevenue).toBeCloseTo(398.368, 3);
    expect(group.delta).toBeCloseTo(147.632, 3);
  });

  it("区域维度：区域一 321 → 369.76，区域二 268.59 → 312.29，区域三 170.36 → 318.18", () => {
    const groups = aggregate(stores, "region", PERIOD);
    expect(groups).toHaveLength(3);

    const region1 = byKey(groups, "区域一");
    expect(region1.prevRevenue).toBeCloseTo(321.0, 2);
    expect(region1.revenue).toBeCloseTo(369.76, 2);

    const region2 = byKey(groups, "区域二");
    expect(region2.prevRevenue).toBeCloseTo(268.59, 2);
    expect(region2.revenue).toBeCloseTo(312.29, 2);

    const region3 = byKey(groups, "区域三");
    expect(region3.prevRevenue).toBeCloseTo(170.36, 2);
    expect(region3.revenue).toBeCloseTo(318.18, 2);
  });

  it("美团大众：收入 336 → 460，差额 +124，增速 36.90%，本期占比 46%", () => {
    const group = byKey(aggregate(channels, "channel", PERIOD), "美团大众");

    expect(group.prevRevenue).toBeCloseTo(336.0, 2);
    expect(group.revenue).toBeCloseTo(460.0, 2);
    expect(group.delta).toBeCloseTo(124.0, 2);
    expect(group.deltaRate).toBeCloseTo(0.369047619, 8);
    expect(group.share).toBeCloseTo(0.46, 8);
  });

  it("各分组占比之和为 1", () => {
    const groups = aggregate(channels, "channel", PERIOD);
    const shareSum = groups.reduce((sum, group) => sum + group.share, 0);
    expect(shareSum).toBeCloseTo(1, 10);
  });

  it("结果按本期收入降序排列", () => {
    const groups = aggregate(channels, "channel", PERIOD);
    const revenues = groups.map((group) => group.revenue);
    const sorted = [...revenues].sort((a, b) => b - a);
    expect(revenues).toEqual(sorted);
    expect(groups[0]?.key).toBe("美团大众");
  });
});

describe("aggregate · 边界", () => {
  it("空数组返回空结果", () => {
    expect(aggregate([], "channel", PERIOD)).toEqual([]);
  });

  it("上期为 0 时增减率为 null（新店）", () => {
    const groups = aggregate(stores, "store", PERIOD);
    const newStore = byKey(groups, "新店1");
    expect(newStore.prevRevenue).toBe(0);
    expect(newStore.revenue).toBeCloseTo(80.0, 2);
    expect(newStore.delta).toBeCloseTo(80.0, 2);
    expect(newStore.deltaRate).toBeNull();
    expect(newStore.share).toBeCloseTo(80 / 1000.23, 8);
  });

  it("region 维度遇到缺失 region 的数据时抛错", () => {
    expect(() =>
      aggregate([{ name: "无区域门店", revenue: { "2025-09": 1 } }], "region", PERIOD),
    ).toThrow(/region/);
  });

  it("支持显式传入期间对", () => {
    const withPair = aggregate(channels, "channel", {
      current: "2025-09",
      previous: "2024-09",
    });
    const withString = aggregate(channels, "channel", PERIOD);
    expect(withPair).toEqual(withString);
  });
});
