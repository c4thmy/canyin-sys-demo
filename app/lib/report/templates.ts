import type { PageKey } from "../dataset-status.js";

/**
 * 报告模板：章节顺序、每章依赖的数据（复用页面的数据需求）与叙述语气。
 * 不调用大模型，章节文字由 view builder 的结论与数字拼成。
 */

export type ReportTemplateId = "boss" | "operations";

export type ChapterKey =
  | "summary"
  | "profitBridge"
  | "origins"
  | "topActions"
  | "structure"
  | "sameStore"
  | "channel"
  | "product"
  | "insights"
  | "allActions";

export interface ChapterDefinition {
  readonly key: ChapterKey;
  readonly title: string;
  /** 本章依赖的页面数据；任一缺失则本章降级为「数据不足，本章略」 */
  readonly requires: PageKey;
  readonly description: string;
}

export interface ReportTemplate {
  readonly id: ReportTemplateId;
  readonly name: string;
  readonly audience: string;
  readonly tone: string;
  readonly description: string;
  readonly chapters: readonly ChapterDefinition[];
}

const CHAPTERS: Record<ChapterKey, ChapterDefinition> = {
  summary: { key: "summary", title: "执行摘要", requires: "overview", description: "一句话总纲与收入、利润等关键数字" },
  profitBridge: { key: "profitBridge", title: "利润桥", requires: "overview", description: "营业利润同比的 9 个因素瀑布图" },
  origins: { key: "origins", title: "收入异动原点", requires: "insights", description: "新店、同店客流、同店客单价三项来源" },
  topActions: { key: "topActions", title: "三条行动建议", requires: "insights", description: "结论引擎排序靠前的三条建议" },
  structure: { key: "structure", title: "收入结构", requires: "structure", description: "同店 / 新店拆分与区域排行" },
  sameStore: { key: "sameStore", title: "同店异动", requires: "same-store", description: "客流 × 客单价拆解与门店贡献排行" },
  channel: { key: "channel", title: "渠道表现", requires: "channel", description: "各渠道收入同比差额" },
  product: { key: "product", title: "产品结构", requires: "product", description: "系列销量结构变化" },
  insights: { key: "insights", title: "结论清单", requires: "insights", description: "全部自动结论，按严重度排序" },
  allActions: { key: "allActions", title: "行动计划", requires: "insights", description: "全部行动建议与责任部门" },
};

export const REPORT_TEMPLATES: readonly ReportTemplate[] = [
  {
    id: "boss",
    name: "老板版",
    audience: "老板 / 投资人",
    tone: "先结论后原因，只讲大数与决策",
    description: "4 章，一页看懂本月赚没赚钱、钱从哪来、下月做什么",
    chapters: [CHAPTERS.summary, CHAPTERS.profitBridge, CHAPTERS.origins, CHAPTERS.topActions],
  },
  {
    id: "operations",
    name: "运营版",
    audience: "运营负责人 / 区域经理",
    tone: "逐层下钻到门店、渠道、产品，附责任部门",
    description: "8 章，从结构到门店、渠道、产品逐层拆解，并给出完整行动计划",
    chapters: [
      CHAPTERS.summary,
      CHAPTERS.profitBridge,
      CHAPTERS.structure,
      CHAPTERS.sameStore,
      CHAPTERS.channel,
      CHAPTERS.product,
      CHAPTERS.insights,
      CHAPTERS.allActions,
    ],
  },
];

export function getReportTemplate(id: string): ReportTemplate | null {
  return REPORT_TEMPLATES.find((template) => template.id === id) ?? null;
}
