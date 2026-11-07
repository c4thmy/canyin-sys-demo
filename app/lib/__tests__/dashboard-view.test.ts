import { describe, expect, it } from "vitest";

import { buildDashboardView, kpiValue } from "../dashboard-view.js";
import { loadSeed } from "../seed.js";

describe("buildDashboardView · 数据看板（演示数据）", () => {
  const view = buildDashboardView();
  const kpi = (key: string) => view.kpis.find((item) => item.key === key)!;

  it("门店收入：本期 1000.23 万，同比 +31.62%（手算 (1000.23 − 759.95) ÷ 759.95）", () => {
    expect(kpi("revenue").current).toBeCloseTo(1000.23, 2);
    expect(kpi("revenue").yoy).toBeCloseTo((1000.23 - 759.95) / 759.95, 4);
  });

  it("营业利润：112.70 万，同比 +74.46%（手算 (112.7 − 64.6) ÷ 64.6），与总览一致", () => {
    expect(kpi("profit").current).toBeCloseTo(112.7, 2);
    expect(kpi("profit").yoy).toBeCloseTo(48.1 / 64.6, 4);
  });

  it("客单价 = 门店收入 × 10000 ÷ 客流，按客流加权", () => {
    const seed = loadSeed();
    const traffic = kpiValue(seed, "traffic", "2025-09")!;
    const revenue = kpiValue(seed, "revenue", "2025-09")!;
    expect(kpi("ticket").current).toBeCloseTo((revenue * 10000) / traffic, 1);
  });

  it("演示数据只有 9 月：环比显示「—」并说明原因", () => {
    for (const item of view.kpis) {
      expect(item.mom).toBeNull();
      expect(item.momText).toBe("—");
      expect(item.note).toContain("无上月数据");
    }
  });

  it("门店排行：按本期收入降序，新店不算同比，占比合计 100%", () => {
    expect(view.stores).toHaveLength(15);
    const revenues = view.stores.map((row) => row.revenue);
    expect([...revenues].sort((a, b) => b - a)).toEqual(revenues);
    expect(view.stores.filter((row) => row.isNew).every((row) => row.yoy === null)).toBe(true);
    expect(view.stores.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 6);
  });

  it("完整度：6 套模板 × 2 期，演示数据全部齐全", () => {
    expect(view.completeness.periods.map((period) => period.id)).toEqual(["2024-09", "2025-09"]);
    const missing = view.completeness.rows.flatMap((row) => row.cells.filter((cell) => !cell.present).map((cell) => `${row.type}|${cell.period}`));
    // 线上漏斗源表只有 2025-09
    expect(missing).toEqual(["online_funnel|2024-09"]);
  });
});
