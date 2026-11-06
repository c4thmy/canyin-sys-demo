import { describe, expect, it } from "vitest";

import {
  DATA_COLOR,
  METRIC_DEFINITIONS,
  metricTooltip,
  type MetricKey,
} from "../theme.js";

const KEY_METRICS: readonly MetricKey[] = [
  "revenue",
  "profit",
  "foodCostRate",
  "sameStoreGrowth",
  "outputRatio",
  "contributionMargin",
];

describe("theme · 指标口径说明", () => {
  it("六个关键指标都有标签、公式与数据来源", () => {
    for (const key of KEY_METRICS) {
      const definition = METRIC_DEFINITIONS[key];
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.formula).toContain("=");
      expect(definition.source).toContain("data/seed/");
    }
  });

  it("tooltip 为三行：指标名 / 公式 / 来源", () => {
    const lines = metricTooltip("outputRatio").split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("产投比");
    expect(lines[1].startsWith("公式：")).toBe(true);
    expect(lines[2].startsWith("来源：")).toBe(true);
  });

  it("口径文案与领域模型一致：不用「1 − 食材成本率」冒充边际贡献率", () => {
    const margin = METRIC_DEFINITIONS.contributionMargin.formula;
    expect(margin).toContain("食材成本");
    expect(margin).toContain("优惠及手续费");
    expect(margin).toContain("水电气低值");
    expect(margin).toContain("宣传费用");
    expect(METRIC_DEFINITIONS.contributionMargin.source).toContain("41.87%");
  });
});

describe("theme · 数据色", () => {
  it("上升绿 / 下降红 / 总计蓝只有一组值", () => {
    expect(DATA_COLOR).toEqual({
      up: "#0f9d76",
      down: "#d64545",
      total: "#2563eb",
    });
  });
});
