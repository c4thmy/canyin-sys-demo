import { describe, expect, it } from "vitest";

import { channelRoi, ROI_THRESHOLDS } from "../roi.js";

describe("channelRoi · 手算对照", () => {
  it("销售额 100、费用 14、毛利 20：费用率 14%，毛利 ROI 1.43，销售 ROI 7.14，健康", () => {
    const result = channelRoi({ platformRevenue: 100, platformFee: 14, platformGrossProfit: 20 });

    expect(result.feeRate).toBeCloseTo(0.14, 10);
    expect(result.grossRoi).toBeCloseTo(20 / 14, 10);
    expect(result.salesRoi).toBeCloseTo(100 / 14, 10);
    expect(result.healthy).toBe(true);
  });

  it("费用率超 15% 且毛利 ROI < 1 时判定不健康", () => {
    const result = channelRoi({ platformRevenue: 100, platformFee: 20, platformGrossProfit: 15 });

    expect(result.feeRate).toBeCloseTo(0.2, 10);
    expect(result.grossRoi).toBeCloseTo(0.75, 10);
    expect(result.salesRoi).toBeCloseTo(5, 10);
    expect(result.healthy).toBe(false);
  });

  it("阈值边界值取等号时视为满足", () => {
    // 费用率正好 15%，毛利 ROI 正好 1，销售 ROI 6.67（高于 4）
    const result = channelRoi({ platformRevenue: 100, platformFee: 15, platformGrossProfit: 15 });

    expect(result.feeRate).toBeCloseTo(ROI_THRESHOLDS.maxFeeRate, 10);
    expect(result.grossRoi).toBeCloseTo(ROI_THRESHOLDS.minGrossRoi, 10);
    expect(result.salesRoi).toBeCloseTo(100 / 15, 10);
    expect(result.healthy).toBe(true);
  });

  it("费用为 0 时费用率为 0、两个 ROI 为 null，健康判定为 null", () => {
    const result = channelRoi({ platformRevenue: 100, platformFee: 0, platformGrossProfit: 20 });

    expect(result).toEqual({
      feeRate: 0,
      grossRoi: null,
      salesRoi: null,
      healthy: null,
    });
  });

  it("平台销售额为 0 时费用率为 null，其余比率仍可计算", () => {
    const result = channelRoi({ platformRevenue: 0, platformFee: 10, platformGrossProfit: 12 });

    expect(result.feeRate).toBeNull();
    expect(result.grossRoi).toBeCloseTo(1.2, 10);
    expect(result.salesRoi).toBe(0);
    expect(result.healthy).toBeNull();
  });
});
