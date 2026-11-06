import { describe, expect, it } from "vitest";

import { channelRevenue } from "../channel.js";
import type { AggregateGroup, Channel } from "../types.js";
import { channels } from "./fixtures.js";

const PERIOD = "2025-09";

function byName(rows: readonly AggregateGroup[], name: string): AggregateGroup {
  const row = rows.find((item) => item.key === name);
  if (!row) {
    throw new Error(`找不到渠道 ${name}`);
  }
  return row;
}

describe("channelRevenue · 10 个渠道同比", () => {
  const table = channelRevenue(channels, PERIOD);

  it("输出 10 个渠道，按同比差额降序", () => {
    expect(table.rows).toHaveLength(10);
    const deltas = table.rows.map((row) => row.delta);
    expect(deltas).toEqual([...deltas].sort((a, b) => b - a));
    expect(table.rows[0]?.key).toBe("美团大众");
    expect(table.rows[table.rows.length - 1]?.key).toBe("招商银行");
  });

  it("渠道合计 2024-09 = 759.56、2025-09 = 1000.00（容差 0.01）", () => {
    expect(Math.abs(table.total.previous - 759.56)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(table.total.current - 1000.0)).toBeLessThanOrEqual(0.01);
  });

  it("合计同比 +240.44 万元，+31.66%", () => {
    expect(table.total.delta).toBeCloseTo(240.44, 2);
    expect(table.total.deltaRate).toBeCloseTo(240.44 / 759.56, 10);
  });

  it("美团大众 336.00 → 460.00，+124.00，+36.90%", () => {
    const row = byName(table.rows, "美团大众");

    expect(row.prevRevenue).toBe(336.0);
    expect(row.revenue).toBe(460.0);
    expect(row.delta).toBeCloseTo(124.0, 10);
    expect(row.deltaRate).toBeCloseTo(124 / 336, 10);
  });

  it("招商银行是唯一负增长：3.50 → 3.00，−0.50，−14.29%", () => {
    const row = byName(table.rows, "招商银行");

    expect(row.delta).toBeCloseTo(-0.5, 10);
    expect(row.deltaRate).toBeCloseTo(-0.5 / 3.5, 10);
    expect(table.rows.filter((item) => item.delta < 0)).toHaveLength(1);
  });

  it("抖音 3.00 → 16.00，同比 +433.33%，是增减率最高的渠道", () => {
    const row = byName(table.rows, "抖音");

    expect(row.delta).toBeCloseTo(13.0, 10);
    expect(row.deltaRate).toBeCloseTo(13 / 3, 10);

    const topRate = [...table.rows].sort(
      (a, b) => (b.deltaRate ?? 0) - (a.deltaRate ?? 0),
    )[0];
    expect(topRate?.key).toBe("抖音");
  });

  it("各渠道占比以本期合计为分母，合计为 1", () => {
    const shareSum = table.rows.reduce((total, row) => total + row.share, 0);
    expect(shareSum).toBeCloseTo(1, 10);

    expect(byName(table.rows, "美团大众").share).toBeCloseTo(460 / 1000, 10);
  });

  it("行差额之和等于合计差额（不重不漏）", () => {
    const deltaSum = table.rows.reduce((total, row) => total + row.delta, 0);
    expect(deltaSum).toBeCloseTo(table.total.delta, 10);
  });

  it("两期都为 0 的渠道：增减率为 null，占比为 0", () => {
    const empty: readonly Channel[] = [
      { name: "空渠道", revenue: { "2024-09": 0, "2025-09": 0 } },
    ];
    const rows = channelRevenue(empty, PERIOD).rows;

    expect(rows[0]?.deltaRate).toBeNull();
    expect(rows[0]?.share).toBe(0);
  });

  it("空渠道列表返回空表，合计为 0", () => {
    expect(channelRevenue([], PERIOD)).toEqual({
      rows: [],
      total: { current: 0, previous: 0, delta: 0, deltaRate: null },
    });
  });
});
