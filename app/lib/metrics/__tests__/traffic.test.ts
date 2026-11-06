import { describe, expect, it } from "vitest";

import {
  decomposeStoreTraffic,
  peerBenchmark,
  sameStoreRows,
  summarizeSameStore,
  timeSlotGroups,
} from "../traffic.js";
import type { StoreTrafficRecord } from "../types.js";
import { stores, timeSlots, traffic } from "./fixtures.js";

/** 手算对照基准：本期 2025-09，上年同期 2024-09 */
const PERIOD = "2025-09";

const rows = decomposeStoreTraffic(stores, traffic, PERIOD);
const sameRows = sameStoreRows(rows);
const summary = summarizeSameStore(rows);

function byStoreId(storeId: string) {
  const row = rows.find((item) => item.storeId === storeId);
  if (!row) {
    throw new Error(`找不到门店 ${storeId}`);
  }
  return row;
}

describe("decomposeStoreTraffic · 逐店分解", () => {
  it("15 家门店全部有一行，按 stores.json 顺序输出", () => {
    expect(rows).toHaveLength(15);
    expect(rows.map((row) => row.storeId)).toEqual(stores.map((store) => store.id));
  });

  it("S01 手算：客流 4750→5617.8862，客单价 122→123，影响 +10.5882 / +0.5618 万", () => {
    const row = byStoreId("S01");

    expect(row.trafficPrevious).toBe(4750);
    expect(row.trafficCurrent).toBeCloseTo(5617.8862, 4);
    expect(row.trafficDelta).toBeCloseTo(867.8862, 4);
    expect(row.trafficDeltaRate).toBeCloseTo(867.8862 / 4750, 10);

    expect(row.ticketPrevious).toBe(122);
    expect(row.ticketCurrent).toBe(123);
    expect(row.ticketDelta).toBe(1);

    // 客流影响 = 867.8862 × 122 / 10000
    expect(row.trafficEffect).toBeCloseTo(10.58821164, 8);
    // 客单价影响 = 5617.8862 × 1 / 10000
    expect(row.ticketEffect).toBeCloseTo(0.56178862, 8);
    expect(row.effectTotal).toBeCloseTo(11.15, 5);

    // 收入口径取 stores.json
    expect(row.revenuePrevious).toBe(58.0);
    expect(row.revenueCurrent).toBe(69.1);
    expect(row.revenueDelta).toBeCloseTo(11.1, 10);
  });

  it("新店没有上年同期：hasPrevious=false，客流差为 0、增减率为 null", () => {
    const newStore = byStoreId("S14");
    expect(newStore.isNew).toBe(true);
    expect(newStore.hasPrevious).toBe(false);
    expect(newStore.trafficPrevious).toBe(0);
    expect(newStore.trafficCurrent).toBeCloseTo(6400, 6);
    expect(newStore.trafficDeltaRate).toBeNull();
    expect(newStore.ticketPrevious).toBe(0);
    expect(newStore.revenuePrevious).toBe(0);
    expect(newStore.revenueDeltaRate).toBeNull();
  });

  it("客流记录缺失时抛错", () => {
    const incomplete: readonly StoreTrafficRecord[] = traffic.filter(
      (record) => record.storeId !== "S10",
    );
    expect(() => decomposeStoreTraffic(stores, incomplete, PERIOD)).toThrow(/S10/);
  });

  it("15 家门店 2025 年逐店：客流 × 客单价 / 10000 == stores.json 收入（容差 0.01）", () => {
    for (const row of rows) {
      const before = (row.trafficCurrent * row.ticketCurrent) / 10000;
      expect(Math.abs(before - row.revenueCurrent)).toBeLessThan(0.01);
    }
  });

  it("2024 年源表客流按整数取整，逐店差额不超过 0.5 万（仅记录，不是业务口径）", () => {
    const deviations = rows.map((row) =>
      Math.abs((row.trafficPrevious * row.ticketPrevious) / 10000 - row.revenuePrevious),
    );
    expect(Math.max(...deviations)).toBeLessThan(0.5);
  });
});

describe("summarizeSameStore · 同店合计（手算对照）", () => {
  it("同店客流合计：2024 = 59,345，2025 = 66,566", () => {
    expect(summary.sameStoreCount).toBe(13);
    expect(Math.round(summary.trafficPrevious)).toBe(59345);
    expect(Math.round(summary.trafficCurrent)).toBe(66566);
    // 展示口径：两期取整后相减 = +7,221 人次
    expect(Math.round(summary.trafficCurrent) - Math.round(summary.trafficPrevious)).toBe(7221);
    // 原始值差 7,221.54；整体增速 12.17%
    expect(summary.trafficDelta).toBeCloseTo(7221.5439, 3);
    expect(summary.trafficDeltaRate).toBeCloseTo(0.121688, 5);
  });

  it("同店客单价（客流加权）：128.08 → 128.78，+0.70 元", () => {
    expect(summary.ticketPrevious).toBeCloseTo(128.077552, 5);
    expect(summary.ticketCurrent).toBeCloseTo(128.778393, 5);
    expect(summary.ticketDelta).toBeCloseTo(0.700841, 5);
    expect(summary.ticketDeltaRate).toBeCloseTo(0.005472, 5);
  });

  it("客流影响 92.07 万、客单价影响 5.08 万、合计 97.16 万（容差 0.05）", () => {
    expect(Math.abs(summary.trafficEffect - 92.07)).toBeLessThan(0.05);
    expect(Math.abs(summary.ticketEffect - 5.08)).toBeLessThan(0.05);
    expect(Math.abs(summary.effectTotal - 97.16)).toBeLessThan(0.05);

    // 更精确的手算基准
    expect(summary.trafficEffect).toBeCloseTo(92.072135, 5);
    expect(summary.ticketEffect).toBeCloseTo(5.084868, 5);
    expect(summary.effectTotal).toBeCloseTo(97.157003, 5);
  });

  it("同店收入取 stores.json：759.95 → 857.23，+97.28", () => {
    expect(summary.revenuePrevious).toBeCloseTo(759.95, 6);
    expect(summary.revenueCurrent).toBeCloseTo(857.23, 6);
    expect(summary.revenueDelta).toBeCloseTo(97.28, 6);
    expect(summary.revenueDeltaRate).toBeCloseTo(0.128008422, 8);
  });

  it("收入差与两项影响合计的差额 = 2024 年源表取整差额 0.123 万", () => {
    expect(summary.reconciliationGap).toBeCloseTo(97.28 - 97.157003, 6);
    expect(Math.abs(summary.reconciliationGap)).toBeLessThan(0.2);
  });

  it("合计等于逐店影响之和", () => {
    const trafficEffect = sameRows.reduce((total, row) => total + row.trafficEffect, 0);
    const ticketEffect = sameRows.reduce((total, row) => total + row.ticketEffect, 0);
    expect(summary.trafficEffect).toBeCloseTo(trafficEffect, 10);
    expect(summary.ticketEffect).toBeCloseTo(ticketEffect, 10);
  });

  it("同店行排除新店", () => {
    expect(sameRows).toHaveLength(13);
    expect(sameRows.every((row) => !row.isNew && row.hasPrevious)).toBe(true);
  });
});

describe("peerBenchmark · 单店横向对比", () => {
  it("同店平均客单价 128.78，S01 客单价 123.00 低于平均 5.78 元", () => {
    const benchmark = peerBenchmark(rows, "S01");

    expect(benchmark.sameStoreCount).toBe(13);
    expect(benchmark.averageTicket).toBeCloseTo(128.778393, 5);
    expect(benchmark.ticketGap).toBeCloseTo(123 - 128.778393, 5);
  });

  it("S01 客流增速 18.27%，高于同店整体 12.17% 约 6.10 个百分点", () => {
    const benchmark = peerBenchmark(rows, "S01");

    expect(benchmark.trafficGrowthRate).toBeCloseTo(0.121688, 5);
    expect(benchmark.trafficGrowthGap).toBeCloseTo(0.0610249, 5);
  });

  it("S01 本期收入 69.10 在同店中排第 6 / 13", () => {
    const benchmark = peerBenchmark(rows, "S01");
    expect(benchmark.revenueRank).toBe(6);
  });

  it("新店不参与同店排名，客流增速差为 null，但客单价仍可对比", () => {
    const benchmark = peerBenchmark(rows, "S14");

    expect(benchmark.revenueRank).toBeNull();
    expect(benchmark.trafficGrowthGap).toBeNull();
    expect(benchmark.ticketGap).toBeCloseTo(125 - 128.778393, 5);
  });

  it("门店不存在时排名与差值为 null，不抛错", () => {
    const benchmark = peerBenchmark(rows, "S99");
    expect(benchmark.revenueRank).toBeNull();
    expect(benchmark.ticketGap).toBeNull();
    expect(benchmark.trafficGrowthGap).toBeNull();
  });
});

describe("timeSlotGroups · 分时段客流", () => {
  const groups = timeSlotGroups(timeSlots, PERIOD);

  it("按数据源顺序分成工作日、节假日两组，每组三个时段", () => {
    expect(groups.map((group) => group.dayType)).toEqual(["工作日", "节假日"]);
    expect(groups[0]?.slots.map((slot) => slot.span)).toEqual([
      "9:00-14:00",
      "14:00-24:00",
      "24:00-5:00",
    ]);
  });

  it("工作日 9:00-14:00（午市）950 → 794，跌 156", () => {
    const slot = groups[0]?.slots.find((item) => item.span === "9:00-14:00");
    expect(slot?.previous).toBe(950);
    expect(slot?.current).toBe(794);
    expect(slot?.delta).toBe(-156);
    expect(slot?.deltaRate).toBeCloseTo(-156 / 950, 10);
  });

  it("节假日 14:00-24:00 975 → 1265，涨 290", () => {
    const slot = groups[1]?.slots.find((item) => item.span === "14:00-24:00");
    expect(slot?.previous).toBe(975);
    expect(slot?.current).toBe(1265);
    expect(slot?.delta).toBe(290);
    expect(slot?.deltaRate).toBeCloseTo(290 / 975, 10);
  });

  it("分组合计：工作日 2850 → 2385（−465），节假日 1706 → 1891（+185）", () => {
    expect(groups[0]?.previous).toBe(2850);
    expect(groups[0]?.current).toBe(2385);
    expect(groups[0]?.delta).toBe(-465);

    expect(groups[1]?.previous).toBe(1706);
    expect(groups[1]?.current).toBe(1891);
    expect(groups[1]?.delta).toBe(185);
  });

  it("空时段列表返回空数组", () => {
    expect(timeSlotGroups([], PERIOD)).toEqual([]);
  });
});
