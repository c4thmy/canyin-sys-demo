import { describe, expect, it } from "vitest";

import { aggregate } from "../aggregate.js";
import { topContributors } from "../contributors.js";
import type { ContributionRow } from "../types.js";
import { channels } from "./fixtures.js";

const PERIOD = "2025-09";

describe("topContributors · 真实数据手算对照", () => {
  const groups = aggregate(channels, "channel", PERIOD);

  it("渠道异动前 3 名：美团大众 +124、扫码支付 +64、线上活动优惠 +19", () => {
    const top3 = topContributors(groups, 3);

    expect(top3.map((item) => item.key)).toEqual(["美团大众", "扫码支付", "线上活动优惠"]);
    expect(top3.map((item) => item.delta)).toEqual([124, 64, 19]);
  });

  it("贡献占比分母是全部渠道 |delta| 之和 241.44", () => {
    const top3 = topContributors(groups, 3);

    // 有渠道负增长（招商银行 -0.5），所以 |delta| 合计 241.44，而非净额 240.44
    expect(top3[0]?.share).toBeCloseTo(124 / 241.44, 10);
    expect(top3[1]?.share).toBeCloseTo(64 / 241.44, 10);
    expect(top3[2]?.share).toBeCloseTo(19 / 241.44, 10);

    const allShare = topContributors(groups, groups.length).reduce(
      (sum, item) => sum + item.share,
      0,
    );
    expect(allShare).toBeCloseTo(1, 10);
  });
});

describe("topContributors · 排序与边界", () => {
  const rows: readonly ContributionRow[] = [
    { key: "A", revenue: 110, prevRevenue: 100, delta: 10 },
    { key: "B", revenue: 80, prevRevenue: 100, delta: -20 },
    { key: "C", revenue: 105, prevRevenue: 100, delta: 5 },
  ];

  it("按 |delta| 降序，负增长同样参与排名", () => {
    const ranked = topContributors(rows, 3);
    expect(ranked.map((item) => item.key)).toEqual(["B", "A", "C"]);
    expect(ranked[0]?.delta).toBe(-20);
    expect(ranked[0]?.share).toBeCloseTo(20 / 35, 12);
    expect(ranked[0]?.deltaRate).toBeCloseTo(-0.2, 12);
  });

  it("n 大于项目数时返回全部", () => {
    expect(topContributors(rows, 10)).toHaveLength(3);
  });

  it("n 为 0 或负数时返回空数组", () => {
    expect(topContributors(rows, 0)).toEqual([]);
    expect(topContributors(rows, -3)).toEqual([]);
  });

  it("不改动输入数组顺序（纯函数）", () => {
    const input = [...rows];
    topContributors(input, 2);
    expect(input.map((item) => item.key)).toEqual(["A", "B", "C"]);
  });

  it("全部 delta 为 0 时占比记为 0，不出现 NaN", () => {
    const flat: readonly ContributionRow[] = [
      { key: "A", revenue: 100, prevRevenue: 100, delta: 0 },
      { key: "B", revenue: 100, prevRevenue: 100, delta: 0 },
    ];
    const ranked = topContributors(flat, 2);

    expect(ranked).toHaveLength(2);
    expect(ranked.every((item) => item.share === 0)).toBe(true);
    expect(Number.isNaN(ranked[0]?.share)).toBe(false);
  });

  it("空输入返回空数组", () => {
    expect(topContributors([], 3)).toEqual([]);
  });
});
