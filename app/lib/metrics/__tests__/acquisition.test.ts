import { describe, expect, it } from "vitest";

import { ACQUISITION_THRESHOLDS, acquisitionHealth } from "../acquisition.js";
import type { AcquisitionRecord, AcquisitionRow } from "../types.js";
import { acquisitions } from "./fixtures.js";

function byChannel(rows: readonly AcquisitionRow[], channel: string): AcquisitionRow {
  const row = rows.find((item) => item.channel === channel);
  if (!row) {
    throw new Error(`找不到渠道 ${channel}`);
  }
  return row;
}

describe("acquisitionHealth · 真实数据手算对照", () => {
  const rows = acquisitionHealth(acquisitions);

  it("输出 2 个渠道，保持源表顺序", () => {
    expect(rows.map((row) => row.channel)).toEqual(["大众点评", "外卖"]);
  });

  it("大众点评：新客 820、客单价 100、毛利率 60%、新客成本 30 → 毛利 4.92 万、投入 2.46 万、产投比 2.00", () => {
    const row = byChannel(rows, "大众点评");

    expect(row.revenue).toBeCloseTo(8.2, 10);
    expect(row.grossProfit).toBeCloseTo(4.92, 10);
    expect(row.spend).toBeCloseTo(2.46, 10);
    expect(row.outputRatio).not.toBeNull();
    expect(Math.abs((row.outputRatio ?? 0) - 2.0)).toBeLessThanOrEqual(0.01);
    expect(row.targetRoi).toBe(2.0);
    expect(row.targetGap).toBeCloseTo(0, 10);
    expect(row.meetsTarget).toBe(true);
  });

  it("大众点评是「刚好达标」：目标差率为 0，没有余量", () => {
    const row = byChannel(rows, "大众点评");

    expect(row.targetGapRate).toBeCloseTo(0, 10);
    expect(row.status).toBe("tight");
    expect(row.targetGapRate ?? 1).toBeLessThanOrEqual(ACQUISITION_THRESHOLDS.tightMarginRate);
  });

  it("外卖：新客 1000、客单价 40、新客成本 20 → 毛利 2.40 万、投入 2.00 万、产投比 1.20", () => {
    const row = byChannel(rows, "外卖");

    expect(row.revenue).toBeCloseTo(4.0, 10);
    expect(row.grossProfit).toBeCloseTo(2.4, 10);
    expect(row.spend).toBeCloseTo(2.0, 10);
    expect(Math.abs((row.outputRatio ?? 0) - 1.2)).toBeLessThanOrEqual(0.01);
    expect(row.targetRoi).toBe(1.0);
    expect(row.meetsTarget).toBe(true);
  });

  it("外卖达标且有余量 20%：状态为 met，不是 tight", () => {
    const row = byChannel(rows, "外卖");

    expect(row.targetGap).toBeCloseTo(0.2, 10);
    expect(row.targetGapRate).toBeCloseTo(0.2, 10);
    expect(row.status).toBe("met");
  });

  it("产投比恒等于「客单价 × 毛利率 ÷ 新客成本」，与规模无关", () => {
    for (const row of rows) {
      const perCustomer = (row.ticket * row.grossMarginRate) / row.newCustomerCost;
      expect(row.outputRatio ?? 0).toBeCloseTo(perCustomer, 10);
    }
  });
});

describe("acquisitionHealth · 边界与判定", () => {
  const record = (overrides: Partial<AcquisitionRecord>): AcquisitionRecord => ({
    channel: "测试渠道",
    newCustomers: 1000,
    ticket: 100,
    grossMarginRate: 0.6,
    newCustomerCost: 30,
    targetRoi: 2,
    ...overrides,
  });

  it("产投比低于目标即为 short，距离越远目标差越负", () => {
    const row = acquisitionHealth([record({ newCustomerCost: 40 })])[0];

    // 100 × 0.6 ÷ 40 = 1.5 < 2.0
    expect(row.outputRatio ?? 0).toBeCloseTo(1.5, 10);
    expect(row.status).toBe("short");
    expect(row.meetsTarget).toBe(false);
    expect(row.targetGap ?? 0).toBeCloseTo(-0.5, 10);
    expect(row.targetGapRate ?? 0).toBeCloseTo(-0.25, 10);
  });

  it("浮点误差不会把「刚好相等」判成未达标", () => {
    const row = acquisitionHealth([record({ newCustomerCost: 30 })])[0];

    // 100 × 0.6 ÷ 30 = 2.0000000000000004，仍应算达标
    expect(row.status).toBe("tight");
    expect(row.meetsTarget).toBe(true);
  });

  it("余量刚好超过 5% 阈值时从 tight 变为 met", () => {
    const justTight = acquisitionHealth([record({ newCustomerCost: 28.6 })])[0];
    // 60 ÷ 28.6 = 2.0979，余量 4.9% → tight
    expect(justTight.status).toBe("tight");

    const clear = acquisitionHealth([record({ newCustomerCost: 28.5 })])[0];
    // 60 ÷ 28.5 = 2.1053，余量 5.26% → met
    expect(clear.status).toBe("met");
  });

  it("投入为 0 时产投比为 null、目标差为 null，判为未达标", () => {
    const row = acquisitionHealth([record({ newCustomerCost: 0 })])[0];

    expect(row.spend).toBe(0);
    expect(row.outputRatio).toBeNull();
    expect(row.targetGap).toBeNull();
    expect(row.targetGapRate).toBeNull();
    expect(row.meetsTarget).toBe(false);
    expect(row.status).toBe("short");
  });

  it("目标 ROI ≤ 0 时目标差率无法计算，但仍按达标处理", () => {
    const row = acquisitionHealth([record({ targetRoi: 0 })])[0];

    expect(row.meetsTarget).toBe(true);
    expect(row.targetGap).toBeCloseTo(2, 10);
    expect(row.targetGapRate).toBeNull();
    expect(row.status).toBe("met");
  });

  it("空输入返回空数组", () => {
    expect(acquisitionHealth([])).toEqual([]);
  });
});
