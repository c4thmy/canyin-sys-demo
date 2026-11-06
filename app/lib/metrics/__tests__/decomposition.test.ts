import { describe, expect, it } from "vitest";

import {
  chainQtyPrice,
  chainTrafficPerCapitaPrice,
  chainTrafficTicket,
} from "../decomposition.js";
import { categories } from "./fixtures.js";

describe("chainTrafficTicket · 客流 × 客单价", () => {
  it("手算对照：1000×50 → 1200×48", () => {
    const result = chainTrafficTicket({
      traffic0: 1000,
      ticket0: 50,
      traffic1: 1200,
      ticket1: 48,
    });

    // 客流影响 = (1200 - 1000) × 50 = +10000
    expect(result.trafficEffect).toBe(10000);
    // 客单价影响 = 1200 × (48 - 50) = -2400
    expect(result.ticketEffect).toBe(-2400);
    expect(result.total).toBe(7600);
    // 两期收入差 = 1200×48 - 1000×50 = 57600 - 50000 = 7600
    expect(result.total).toBeCloseTo(1200 * 48 - 1000 * 50, 10);
  });

  it("客流下降、客单价上升时两因素方向相反", () => {
    const result = chainTrafficTicket({
      traffic0: 800,
      ticket0: 40,
      traffic1: 700,
      ticket1: 45,
    });

    expect(result.trafficEffect).toBeCloseTo(-100 * 40, 10);
    expect(result.ticketEffect).toBeCloseTo(700 * 5, 10);
    expect(result.total).toBeCloseTo(700 * 45 - 800 * 40, 10);
  });

  it("两期完全一致时两项影响均为 0", () => {
    const result = chainTrafficTicket({
      traffic0: 500,
      ticket0: 60,
      traffic1: 500,
      ticket1: 60,
    });
    expect(result).toEqual({ trafficEffect: 0, ticketEffect: 0, total: 0 });
  });
});

describe("chainQtyPrice · 销量 × 单价", () => {
  it("手算对照：100 份×30 元 → 120 份×28 元", () => {
    const result = chainQtyPrice({ qty0: 100, price0: 30, qty1: 120, price1: 28 });

    // 销量影响 = (120 - 100) × 30 = +600
    expect(result.qtyEffect).toBe(600);
    // 单价影响 = 120 × (28 - 30) = -240
    expect(result.priceEffect).toBe(-240);
    expect(result.total).toBe(360);
    expect(result.total).toBeCloseTo(120 * 28 - 100 * 30, 10);
  });

  it("用肉类真实销量与收入反推单价，两项之和等于收入差", () => {
    const meat = categories.find((item) => item.name === "肉类");
    if (!meat) {
      throw new Error("样例数据缺少肉类");
    }

    const qty0 = meat.qty["2024-09"];
    const qty1 = meat.qty["2025-09"];
    const revenue0 = meat.revenue["2024-09"];
    const revenue1 = meat.revenue["2025-09"];
    if (qty0 === undefined || qty1 === undefined || revenue0 === undefined || revenue1 === undefined) {
      throw new Error("肉类样例数据缺少 2024-09 或 2025-09");
    }

    // 2024 单价未入库，用「收入 / 销量」反推，保证与收入口径自洽（万元 → 元）
    const price0 = (revenue0 * 10000) / qty0;
    const price1 = (revenue1 * 10000) / qty1;

    const result = chainQtyPrice({ qty0, price0, qty1, price1 });

    // 销量影响 ≈ 136.61 万，单价影响 ≈ 11.02 万
    expect(result.qtyEffect / 10000).toBeCloseTo(136.61195, 5);
    expect(result.priceEffect / 10000).toBeCloseTo(11.02005, 5);
    // 两项之和 == 收入差（万元），误差小于 0.01
    expect(Math.abs(result.total / 10000 - (revenue1 - revenue0))).toBeLessThan(0.01);
  });
});

describe("chainTrafficPerCapitaPrice · 客流 × 人均销量 × 单价", () => {
  it("手算对照：1000×0.2×30 → 1200×0.21×29", () => {
    const result = chainTrafficPerCapitaPrice({
      traffic0: 1000,
      perCapita0: 0.2,
      price0: 30,
      traffic1: 1200,
      perCapita1: 0.21,
      price1: 29,
    });

    // 客流影响 = (1200 - 1000) × 0.2 × 30 = 1200
    expect(result.trafficEffect).toBeCloseTo(1200, 10);
    // 人均销量影响 = 1200 × (0.21 - 0.2) × 30 = 360
    expect(result.perCapitaEffect).toBeCloseTo(360, 10);
    // 单价影响 = 1200 × 0.21 × (29 - 30) = -252
    expect(result.priceEffect).toBeCloseTo(-252, 10);
    expect(result.total).toBeCloseTo(1308, 10);
  });

  it("三项之和 == 收入差（带小数的真实感数字）", () => {
    const traffic0 = 1234;
    const perCapita0 = 0.173;
    const price0 = 27.5;
    const traffic1 = 1571;
    const perCapita1 = 0.191;
    const price1 = 26.9;

    const revenue0 = traffic0 * perCapita0 * price0;
    const revenue1 = traffic1 * perCapita1 * price1;

    const result = chainTrafficPerCapitaPrice({
      traffic0,
      perCapita0,
      price0,
      traffic1,
      perCapita1,
      price1,
    });

    const effectSum = result.trafficEffect + result.perCapitaEffect + result.priceEffect;
    expect(effectSum).toBeCloseTo(revenue1 - revenue0, 8);
    expect(result.total).toBeCloseTo(effectSum, 12);
    expect(Math.abs(result.total - (revenue1 - revenue0))).toBeLessThan(0.01);
  });

  it("只有客流变化时，另两项影响为 0", () => {
    const result = chainTrafficPerCapitaPrice({
      traffic0: 1000,
      perCapita0: 0.2,
      price0: 30,
      traffic1: 1100,
      perCapita1: 0.2,
      price1: 30,
    });

    expect(result.trafficEffect).toBeCloseTo(100 * 0.2 * 30, 10);
    expect(result.perCapitaEffect).toBe(0);
    expect(result.priceEffect).toBe(0);
    expect(result.total).toBeCloseTo(600, 10);
  });
});
