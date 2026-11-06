import { describe, expect, it } from "vitest";

import { regionStructure, storeStructure } from "../structure.js";
import type { Store, StoreStructureRow } from "../types.js";
import { stores } from "./fixtures.js";

const PERIOD = "2025-09";

function byId(rows: readonly StoreStructureRow[], id: string): StoreStructureRow {
  const row = rows.find((item) => item.id === id);
  if (!row) {
    throw new Error(`找不到门店 ${id}`);
  }
  return row;
}

describe("storeStructure · 门店维度", () => {
  const rows = storeStructure(stores, PERIOD);

  it("15 家门店全部输出，按同比差额降序", () => {
    expect(rows).toHaveLength(15);
    const deltas = rows.map((row) => row.delta);
    expect(deltas).toEqual([...deltas].sort((a, b) => b - a));
  });

  it("S01：58.00 → 69.10，+11.10，同比 +19.14%，占同店 8.06%", () => {
    const row = byId(rows, "S01");

    expect(row.prevRevenue).toBe(58.0);
    expect(row.revenue).toBe(69.1);
    expect(row.delta).toBeCloseTo(11.1, 10);
    expect(row.deltaRate).toBeCloseTo(11.1 / 58, 10);
    expect(row.sameStoreShare).toBeCloseTo(69.1 / 857.23, 10);
  });

  it("13 家同店的占同店比之和为 1", () => {
    const total = rows
      .filter((row) => !row.isNew)
      .reduce((acc, row) => acc + (row.sameStoreShare ?? 0), 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("同店收入排名：S03 第 1、S01 第 6、S11 第 13", () => {
    expect(byId(rows, "S03").sameStoreRank).toBe(1);
    expect(byId(rows, "S01").sameStoreRank).toBe(6);
    expect(byId(rows, "S11").sameStoreRank).toBe(13);
  });

  it("新店：差额 +80 / +63，增减率为 null，占同店比与排名为 null", () => {
    const s14 = byId(rows, "S14");
    expect(s14.isNew).toBe(true);
    expect(s14.prevRevenue).toBe(0);
    expect(s14.revenue).toBeCloseTo(80.0, 10);
    expect(s14.delta).toBeCloseTo(80.0, 10);
    expect(s14.deltaRate).toBeNull();
    expect(s14.sameStoreShare).toBeNull();
    expect(s14.sameStoreRank).toBeNull();
  });

  it("差额相同时按门店名升序，排序稳定", () => {
    const tied: readonly Store[] = [
      { id: "S02", name: "门店2", region: "区域一", isNew: false, revenue: { "2024-09": 10, "2025-09": 20 } },
      { id: "S01", name: "门店1", region: "区域一", isNew: false, revenue: { "2024-09": 10, "2025-09": 20 } },
    ];
    expect(storeStructure(tied, PERIOD).map((row) => row.name)).toEqual(["门店1", "门店2"]);
  });

  it("空门店列表返回空数组", () => {
    expect(storeStructure([], PERIOD)).toEqual([]);
  });
});

describe("regionStructure · 区域维度", () => {
  const regions = regionStructure(stores, PERIOD);

  it("三个区域，按数据源顺序（区域一、二、三）；每组 5 家门店（区域三含 2 家新店）", () => {
    expect(regions.map((region) => region.key)).toEqual(["区域一", "区域二", "区域三"]);
    expect(regions.map((region) => region.stores.length)).toEqual([5, 5, 5]);
    expect(regions[2]?.stores.filter((store) => store.isNew)).toHaveLength(2);
  });

  it("区域汇总与门店维度口径一致：区域一 321.00→369.76，区域二 268.59→312.29，区域三 170.36→318.18", () => {
    const [region1, region2, region3] = regions;

    expect(region1?.prevRevenue).toBeCloseTo(321.0, 2);
    expect(region1?.revenue).toBeCloseTo(369.76, 2);
    expect(region1?.delta).toBeCloseTo(48.76, 2);

    expect(region2?.prevRevenue).toBeCloseTo(268.59, 2);
    expect(region2?.revenue).toBeCloseTo(312.29, 2);

    expect(region3?.prevRevenue).toBeCloseTo(170.36, 2);
    expect(region3?.revenue).toBeCloseTo(318.18, 2);
  });

  it("区域占比之和为 1，区域合计等于全部门店合计", () => {
    const shareSum = regions.reduce((total, region) => total + region.share, 0);
    expect(shareSum).toBeCloseTo(1, 10);

    const revenueSum = regions.reduce((total, region) => total + region.revenue, 0);
    expect(revenueSum).toBeCloseTo(1000.23, 2);
  });

  it("区域内门店按自身同比差额降序", () => {
    for (const region of regions) {
      const deltas = region.stores.map((store) => store.delta);
      expect(deltas).toEqual([...deltas].sort((a, b) => b - a));
    }
  });
});
