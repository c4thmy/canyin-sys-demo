import { describe, expect, it } from "vitest";

import { formatSignedPercent } from "../../format.js";
import { generateInsights, INSIGHT_THRESHOLDS } from "../insights.js";
import type { Insight, InsightsInput, InsightsResult } from "../insights.js";
import {
  acquisitions,
  bundles,
  categories,
  channels,
  pnl,
  stores,
  traffic,
} from "./fixtures.js";

/**
 * 结论引擎的单测：全部使用 data/seed 真实样例数据，断言直接对应
 * docs/domain/revenue-analysis-model.md 与 data/dictionary.md 的口径。
 */

const input: InsightsInput = {
  period: { current: "2025-09", previous: "2024-09" },
  pnl,
  stores,
  channels,
  categories,
  bundles,
  traffic,
  acquisition: acquisitions,
};

const result: InsightsResult = generateInsights(input);

function insightOf(id: string): Insight {
  const found = result.insights.find((insight) => insight.id === id);
  if (!found) {
    throw new Error(`结论中缺少 ${id}`);
  }
  return found;
}

/** 从 detail 中抽出所有两位小数的数字（金额与百分比都算），用于校验可追溯性 */
function decimalTokens(text: string): string[] {
  return [...new Set(text.match(/[+\u2212-]?\d[\d,]*\.\d{2}/g) ?? [])];
}

describe("结论引擎 · 增长来源", () => {
  it("拆分新店 / 同店增量，并判定为开店驱动", () => {
    const insight = insightOf("growth-source");

    expect(result.facts.sameNew.newStore.delta).toBeCloseTo(143.0, 2);
    expect(result.facts.sameNew.sameStore.delta).toBeCloseTo(97.28, 2);
    expect(
      Math.abs(result.facts.sameNew.newStore.delta - 143.0),
    ).toBeLessThanOrEqual(0.02);
    expect(
      Math.abs(result.facts.sameNew.sameStore.delta - 97.28),
    ).toBeLessThanOrEqual(0.02);

    expect(insight.category).toBe("growth");
    expect(insight.severity).toBe("warning");
    expect(insight.detail).toContain("+143.00");
    expect(insight.detail).toContain("+97.28");
    expect(insight.detail).toContain("开店驱动");
    expect(insight.link).toBe("/revenue/structure");
  });
});

describe("结论引擎 · 同店动因", () => {
  it("客流影响与客单价影响与 PPT 口径一致，判定为客流驱动", () => {
    const insight = insightOf("same-store-driver");

    expect(
      Math.abs(result.facts.sameStore.trafficEffect - 92.07),
    ).toBeLessThanOrEqual(0.02);
    expect(
      Math.abs(result.facts.sameStore.ticketEffect - 5.08),
    ).toBeLessThanOrEqual(0.02);

    expect(insight.title).toContain("客流");
    expect(insight.detail).toContain("客流影响 +92.07 万元");
    expect(insight.detail).toContain("客单价影响 +5.08 万元");
    expect(insight.detail).toContain("「客流驱动」");
    expect(insight.severity).toBe("positive");
    expect(insight.link).toBe("/revenue/same-store");
  });
});

describe("结论引擎 · 渠道集中度", () => {
  it("美团大众 460.00 万元、占比 46.00%，触发风险提示", () => {
    const insight = insightOf("channel-concentration");

    expect(result.facts.topChannel.key).toBe("美团大众");
    expect(result.facts.topChannel.revenue).toBeCloseTo(460.0, 2);
    expect(result.facts.topChannel.share).toBeCloseTo(0.46, 4);
    expect(result.facts.topChannel.share).toBeGreaterThanOrEqual(
      INSIGHT_THRESHOLDS.channelConcentrationShare,
    );
    expect(insight.category).toBe("risk");
    expect(insight.severity).toBe("warning");
    expect(insight.detail).toContain("460.00");
    expect(insight.detail).toContain("46.00%");
    expect(insight.evidence.some((item) => item.value === "+124.00 万元")).toBe(true);
    expect(insight.link).toBe("/revenue/channel");
  });
});

describe("结论引擎 · 产品结构", () => {
  it("销量增幅最大为小料类、降幅最大为凉菜，收入第一为肉类", () => {
    const insight = insightOf("product-mix");

    expect(result.facts.categoryTopIncrease?.name).toBe("小料类");
    expect(result.facts.categoryTopIncrease?.qtyDeltaRate).toBeCloseTo(0.8796, 3);
    expect(result.facts.categoryTopDecrease?.name).toBe("凉菜");
    expect(result.facts.categoryTopDecrease?.qtyDeltaRate).toBeCloseTo(-0.6798, 3);
    expect(result.facts.categoryTopRevenue?.name).toBe("肉类");
    expect(result.facts.categoryTopRevenue?.share).toBeCloseTo(0.546, 3);

    expect(insight.detail).toContain("+87.96%");
    expect(insight.detail).toContain(formatSignedPercent(-0.6798012677745418));
    expect(insight.detail).toContain("546.00");
    expect(insight.detail).toContain("54.60%");
    expect(insight.severity).toBe("warning");
  });
});

describe("结论引擎 · 引流款依赖", () => {
  it("引流款占增量 80.20%，加权折扣率按 优惠额÷销售额 实算为 59.41%", () => {
    const insight = insightOf("leadgen-dependency");
    const leadgen = result.facts.leadgen;

    expect(leadgen.comparableCount).toBe(11);
    expect(leadgen.leadgenCount).toBe(4);
    expect(leadgen.share).toBeCloseTo(0.802, 3);
    expect(leadgen.share).toBeGreaterThanOrEqual(INSIGHT_THRESHOLDS.leadgenDeltaShare);
    expect(leadgen.amountCurrent).toBeCloseTo(85901, 2);
    expect(leadgen.discountCurrent).toBeCloseTo(51033.33, 2);
    expect(leadgen.weightedDiscountRate).toBeCloseTo(0.5941, 3);

    expect(insight.severity).toBe("warning");
    expect(insight.detail).toContain("80.20%");
    expect(insight.detail).toContain("59.41%");
    expect(insight.detail).toContain("85,901.00");
    expect(insight.detail).toContain("51,033.33");
  });

  it("折扣率最高的单套餐是 B04 的 61.36%——任务书里的 61.4% 对应这个单套餐值，不是四个引流款的加权值", () => {
    const highest = [...result.facts.leadgen.bundles].sort(
      (a, b) => (b.discountRate ?? 0) - (a.discountRate ?? 0),
    )[0];

    expect(highest?.id).toBe("B04");
    expect(highest?.discountRate).toBeCloseTo(0.6136, 3);
  });
});

describe("结论引擎 · 利润拖累", () => {
  it("最大负项为其它费用 −37.00，其次为店铺房租 −13.76", () => {
    const insight = insightOf("profit-drag");

    expect(result.facts.profitDrag).toHaveLength(2);
    expect(result.facts.profitDrag[0].label).toBe("其它费用");
    expect(result.facts.profitDrag[0].effect).toBeCloseTo(-37, 2);
    expect(result.facts.profitDrag[0].kind).toBe("fixed");
    expect(result.facts.profitDrag[1].label).toBe("店铺房租");
    expect(result.facts.profitDrag[1].effect).toBeCloseTo(-13.76, 2);

    expect(insight.category).toBe("cost");
    expect(insight.severity).toBe("critical");
    expect(insight.detail).toContain("−37.00");
    expect(insight.detail).toContain("−13.76");
    expect(insight.detail).toContain("固定成本");
    expect(insight.link).toBe("/");
  });
});

describe("结论引擎 · 渠道健康", () => {
  it("大众点评余量率 0.0% 判为压线 warning，外卖 20.0% 正常", () => {
    const insight = insightOf("channel-health");
    const dianping = result.facts.channelHealth.find((row) => row.channel === "大众点评");
    const waimai = result.facts.channelHealth.find((row) => row.channel === "外卖");

    expect(dianping?.marginRate).toBeCloseTo(0, 4);
    expect(dianping?.status).toBe("warning");
    expect(dianping?.statusLabel).toBe("压线");
    expect(waimai?.marginRate).toBeCloseTo(0.2, 4);
    expect(waimai?.status).toBe("normal");
    expect(waimai?.statusLabel).toBe("正常");

    expect(insight.category).toBe("channel");
    expect(insight.severity).toBe("warning");
    expect(insight.detail).toContain("0.0%");
    expect(insight.detail).toContain("20.0%");
    expect(insight.detail).toContain("正常");
    expect(insight.link).toBe("/revenue/channel");
  });
});

describe("结论引擎 · 行动建议", () => {
  it("至少 3 条行动，每条都能追溯到存在的结论 id，且步骤 2–3 条", () => {
    const insightIds = new Set(result.insights.map((insight) => insight.id));

    expect(result.actions.length).toBeGreaterThanOrEqual(3);
    expect(new Set(result.actions.map((action) => action.id)).size).toBe(
      result.actions.length,
    );

    for (const action of result.actions) {
      expect(insightIds.has(action.insightId)).toBe(true);
      expect(action.steps.length).toBeGreaterThanOrEqual(2);
      expect(action.steps.length).toBeLessThanOrEqual(3);
      expect(action.owner.trim().length).toBeGreaterThan(0);
      expect(action.why.length).toBeGreaterThan(10);
    }
  });

  it("行动按 severity 排序取前 3 条", () => {
    const rank: Record<Insight["severity"], number> = {
      critical: 0,
      warning: 1,
      positive: 2,
    };
    const severities = result.actions.map((action) => {
      const insight = result.insights.find((item) => item.id === action.insightId);
      if (!insight) {
        throw new Error(`行动 ${action.id} 指向了不存在的结论`);
      }
      return rank[insight.severity];
    });

    expect(severities).toEqual([...severities].sort((a, b) => a - b));
    expect(result.actions.length).toBe(3);
    expect(result.actions[0].insightId).toBe("profit-drag");
  });
});

describe("结论引擎 · 异动原点", () => {
  it("按贡献排序的前 3 项为 新店 / 同店客流 / 同店客单价，占比合计接近 100%", () => {
    expect(result.origins).toHaveLength(3);
    expect(result.origins.map((origin) => origin.key)).toEqual([
      "newStore",
      "sameStoreTraffic",
      "sameStoreTicket",
    ]);
    expect(result.origins[0].amount).toBeCloseTo(143.0, 2);
    expect(result.origins[1].amount).toBeCloseTo(92.07, 2);
    expect(result.origins[2].amount).toBeCloseTo(5.08, 2);
    expect(result.origins.every((origin) => origin.highlighted)).toBe(true);

    const shareSum = result.origins.reduce((total, origin) => total + origin.share, 0);
    expect(shareSum).toBeGreaterThan(0.99);
    expect(shareSum).toBeLessThanOrEqual(1.001);
    expect(Math.abs(result.originGap - 0.12)).toBeLessThanOrEqual(0.02);
  });
});

describe("结论引擎 · 可追溯与口径", () => {
  it("每条结论 detail 里的两位小数数字都能在 evidence 中找到", () => {
    for (const insight of result.insights) {
      const evidenceText = insight.evidence
        .map((evidence) => `${evidence.label} ${evidence.value}`)
        .join(" ");
      const tokens = decimalTokens(insight.detail);

      expect(tokens.length).toBeGreaterThan(0);
      for (const token of tokens) {
        const bare = token.replace(/^[+\u2212-]/, "");
        expect(
          evidenceText.includes(bare),
          `${insight.id} 的 ${token} 未出现在 evidence 中：${evidenceText}`,
        ).toBe(true);
      }
    }
  });

  it("结论 id 稳定、分类与严重度取值合法、每条都带下钻链接", () => {
    const allowedCategories = new Set(["growth", "cost", "channel", "product", "risk"]);
    const allowedSeverities = new Set(["positive", "warning", "critical"]);
    const ids = result.insights.map((insight) => insight.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "growth-source",
      "same-store-driver",
      "channel-concentration",
      "product-mix",
      "leadgen-dependency",
      "profit-drag",
      "channel-health",
    ]);

    for (const insight of result.insights) {
      expect(allowedCategories.has(insight.category)).toBe(true);
      expect(allowedSeverities.has(insight.severity)).toBe(true);
      expect(insight.title.length).toBeGreaterThan(0);
      expect(insight.detail.length).toBeGreaterThan(0);
      expect(insight.evidence.length).toBeGreaterThanOrEqual(2);
      expect(insight.link).toBeTruthy();
    }
  });

  it("一句话总纲包含本期收入、利润与核心判断", () => {
    expect(result.headline).toContain("1,000.23 万元");
    expect(result.headline).toContain("112.70 万元");
    expect(result.headline).toContain("+48.10 万元");
    expect(result.headline).toContain("客流");
  });

  it("纯函数：同一输入重复调用结果一致", () => {
    const again = generateInsights(input);
    expect(again.insights).toEqual(result.insights);
    expect(again.actions).toEqual(result.actions);
    expect(again.origins).toEqual(result.origins);
    expect(again.headline).toBe(result.headline);
  });
});
