import { describe, expect, it } from "vitest";

import { funnelRates } from "../funnel.js";
import { funnelByStore, funnelRecords, sumFunnel } from "./fixtures.js";

describe("funnelRates · 真实数据手算对照", () => {
  it("S01：曝光 133461 → 访问 15975 → 支付 2045 → 消费 1882", () => {
    const rates = funnelRates(funnelByStore("S01"));

    expect(rates.visitRate).toBeCloseTo(0.119697889, 9);
    expect(rates.payRate).toBeCloseTo(0.12801252, 9);
    expect(rates.consumeRate).toBeCloseTo(0.920293399, 9);
    expect(rates.overallRate).toBeCloseTo(0.014101498, 9);
  });

  it("整体转化率恒等于三个分环节转化率之积", () => {
    const rates = funnelRates(funnelByStore("S01"));
    const product =
      (rates.visitRate ?? 0) * (rates.payRate ?? 0) * (rates.consumeRate ?? 0);
    expect(rates.overallRate).toBeCloseTo(product, 12);
  });

  it("13 家门店合计漏斗：2346954 → 352564 → 38303 → 33723", () => {
    const total = sumFunnel(funnelRecords);
    const rates = funnelRates(total);

    expect(total.exposure).toBe(2346954);
    expect(total.visits).toBe(352564);
    expect(total.payments).toBe(38303);
    expect(total.consumers).toBe(33723);
    expect(rates.visitRate).toBeCloseTo(352564 / 2346954, 12);
    expect(rates.payRate).toBeCloseTo(38303 / 352564, 12);
    expect(rates.consumeRate).toBeCloseTo(33723 / 38303, 12);
    expect(rates.overallRate).toBeCloseTo(33723 / 2346954, 12);
  });
});

describe("funnelRates · 空值安全", () => {
  it("S02 支付及之后为空：仅曝光→访问可算，其余为 null", () => {
    const rates = funnelRates(funnelByStore("S02"));

    expect(rates.visitRate).toBeCloseTo(11573 / 77794, 12);
    expect(rates.payRate).toBeNull();
    expect(rates.consumeRate).toBeNull();
    expect(rates.overallRate).toBeNull();
  });

  it("全部为空时四项都是 null", () => {
    const rates = funnelRates({
      exposure: null,
      visits: null,
      payments: null,
      consumers: null,
    });

    expect(rates).toEqual({
      visitRate: null,
      payRate: null,
      consumeRate: null,
      overallRate: null,
    });
  });

  it("分母为 0 时返回 null，不产生 NaN 或 Infinity", () => {
    const rates = funnelRates({ exposure: 0, visits: 0, payments: 0, consumers: 0 });

    expect(rates.visitRate).toBeNull();
    expect(rates.payRate).toBeNull();
    expect(rates.consumeRate).toBeNull();
    expect(rates.overallRate).toBeNull();
  });

  it("中间环节缺失时后续环节单独为 null", () => {
    const rates = funnelRates({
      exposure: 1000,
      visits: 100,
      payments: null,
      consumers: 50,
    });

    expect(rates.visitRate).toBeCloseTo(0.1, 12);
    expect(rates.payRate).toBeNull();
    // 支付人数缺失，但消费人数与曝光人数都在，整体转化率仍可计算
    expect(rates.consumeRate).toBeNull();
    expect(rates.overallRate).toBeCloseTo(0.05, 12);
  });
});
