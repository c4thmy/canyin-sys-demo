import { describe, expect, it } from "vitest";

import { splitSameNewStore } from "../same-store.js";
import type { Store } from "../types.js";
import { stores } from "./fixtures.js";

const PERIOD = "2025-09";

describe("splitSameNewStore · 真实数据手算对照", () => {
  const split = splitSameNewStore(stores, PERIOD);

  it("同店：759.95 → 857.23，增量 +97.28", () => {
    expect(split.sameStore.previous).toBeCloseTo(759.95, 2);
    expect(split.sameStore.current).toBeCloseTo(857.23, 2);
    expect(split.sameStore.delta).toBeCloseTo(97.28, 2);
    expect(split.sameStore.deltaRate).toBeCloseTo(0.128008422, 8);
  });

  it("新店：0 → 143.00，增量 +143.00", () => {
    expect(split.newStore.previous).toBe(0);
    expect(split.newStore.current).toBeCloseTo(143.0, 2);
    expect(split.newStore.delta).toBeCloseTo(143.0, 2);
    // 上期为 0，增减率无意义，返回 null
    expect(split.newStore.deltaRate).toBeNull();
  });

  it("合计：759.95 → 1000.23，增量 +240.28", () => {
    expect(split.total.previous).toBeCloseTo(759.95, 2);
    expect(split.total.current).toBeCloseTo(1000.23, 2);
    expect(split.total.delta).toBeCloseTo(240.28, 2);
    expect(split.total.deltaRate).toBeCloseTo(0.316178696, 8);
  });

  it("同店增量 + 新店增量 = 合计增量", () => {
    expect(split.sameStore.delta + split.newStore.delta).toBeCloseTo(split.total.delta, 10);
  });
});

describe("splitSameNewStore · 边界", () => {
  const baseStore: Store = {
    id: "S99",
    name: "门店99",
    region: "区域一",
    isNew: false,
    revenue: { "2024-09": 0, "2025-09": 0 },
  };

  const customStores: readonly Store[] = [
    { ...baseStore, id: "S01", name: "门店1", revenue: { "2024-09": 100, "2025-09": 120 } },
    { ...baseStore, id: "S02", name: "门店2", revenue: { "2024-09": 50, "2025-09": 40 } },
    {
      ...baseStore,
      id: "S03",
      name: "新店1",
      isNew: true,
      revenue: { "2024-09": 0, "2025-09": 30 },
    },
  ];

  it("多店拆分同店与新店", () => {
    const split = splitSameNewStore(customStores, PERIOD);
    expect(split.sameStore).toEqual({
      previous: 150,
      current: 160,
      delta: 10,
      deltaRate: 10 / 150,
    });
    expect(split.newStore).toEqual({
      previous: 0,
      current: 30,
      delta: 30,
      deltaRate: null,
    });
    expect(split.total).toEqual({
      previous: 150,
      current: 190,
      delta: 40,
      deltaRate: 40 / 150,
    });
  });

  it("没有新店时新店两项均为 0", () => {
    const split = splitSameNewStore([customStores[0] as Store], PERIOD);
    expect(split.newStore.previous).toBe(0);
    expect(split.newStore.current).toBe(0);
    expect(split.newStore.delta).toBe(0);
    expect(split.newStore.deltaRate).toBeNull();
  });

  it("空门店列表返回全 0 且增减率为 null", () => {
    const split = splitSameNewStore([], PERIOD);
    expect(split.total).toEqual({ previous: 0, current: 0, delta: 0, deltaRate: null });
  });
});
