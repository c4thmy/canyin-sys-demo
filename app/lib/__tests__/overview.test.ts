import { describe, expect, it } from "vitest";

import { buildOverview } from "../overview.js";
import { METRIC_DEFINITIONS } from "../theme.js";

describe("buildOverview · 经营总览", () => {
  const view = buildOverview();

  it("利润桥闭合：起止节点差 = 各因素影响之和 + 48.10 万", () => {
    expect(view.currentProfit - view.previousProfit).toBeCloseTo(48.1, 2);
    expect(view.profitDelta).toBeCloseTo(48.1, 2);
  });

  it("上期边际贡献率 = 收入规模影响 ÷ 收入同比 = 41.87%", () => {
    const margin = view.contributionMarginPrevious;
    expect(margin).not.toBeNull();
    expect(margin ?? Number.NaN).toBeCloseTo(0.4187, 4);
  });

  it("四张指标卡都挂上关键指标口径", () => {
    expect(view.cards.map((card) => card.key)).toEqual([
      "revenue",
      "profit",
      "foodCostRate",
      "sameStoreGrowth",
    ]);
    for (const card of view.cards) {
      expect(card.metric).toBeDefined();
      if (card.metric) {
        expect(METRIC_DEFINITIONS[card.metric].label.length).toBeGreaterThan(0);
      }
    }
  });
});
