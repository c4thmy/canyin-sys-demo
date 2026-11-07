import { buildChannelView } from "../channel-view.js";
import { analysisPeriods, missingFor, type MissingData } from "../dataset-status.js";
import { formatAmount, formatPercent, formatSignedAmount, formatSignedPercent } from "../format.js";
import { INSIGHT_SEVERITY_LABELS } from "../insight-labels.js";
import { buildInsightsView, type InsightsView } from "../insights-view.js";
import { buildOverview, type OverviewView } from "../overview.js";
import { buildProductView } from "../product-view.js";
import { buildSameStoreView } from "../same-store-view.js";
import { loadSeed } from "../seed.js";
import { buildStructureView } from "../structure-view.js";
import { deltaBarSvg, profitBridgeSvg } from "./charts.js";
import { getReportTemplate, type ChapterDefinition, type ReportTemplateId } from "./templates.js";

/**
 * 报告生成：模板 × view builder × 快照。
 * 章节数字全部来自页面的 view builder（领域模型 11.5），保证报告与页面一致。
 */

export type ReportBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "kpis"; readonly items: readonly { label: string; value: string; note: string }[] }
  | { readonly kind: "table"; readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] }
  | { readonly kind: "chart"; readonly title: string; readonly svg: string }
  | { readonly kind: "list"; readonly items: readonly { title: string; detail: string; meta?: string }[] };

export interface ReportChapter {
  readonly key: string;
  readonly title: string;
  /** 本章结论句；数据不足时为「数据不足，本章略」 */
  readonly conclusion: string;
  readonly skipped: boolean;
  readonly missing: readonly MissingData[];
  readonly blocks: readonly ReportBlock[];
}

export interface Report {
  readonly id: string;
  readonly title: string;
  readonly templateId: ReportTemplateId;
  readonly templateName: string;
  readonly period: { readonly current: string; readonly previous: string; readonly currentLabel: string; readonly previousLabel: string };
  readonly dataset: "demo" | "imported";
  readonly sourceFile: string;
  readonly unit: string;
  readonly createdAt: string;
  readonly headline: string;
  readonly chapters: readonly ReportChapter[];
}

export class ReportError extends Error {}

const SKIPPED = "数据不足，本章略";

/** 懒加载 + 记忆化：同一份报告里多个章节共用一次 view 计算 */
function lazy<T>(factory: () => T): () => T {
  let value: { v: T } | undefined;
  return () => (value ??= { v: factory() }).v;
}

function chapterBlocks(
  key: ChapterDefinition["key"],
  views: {
    overview: () => OverviewView;
    insights: () => InsightsView;
    structure: () => ReturnType<typeof buildStructureView>;
    sameStore: () => ReturnType<typeof buildSameStoreView>;
    channel: () => ReturnType<typeof buildChannelView>;
    product: () => ReturnType<typeof buildProductView>;
  },
): { conclusion: string; blocks: ReportBlock[] } {
  switch (key) {
    case "summary": {
      const overview = views.overview();
      return {
        conclusion: overview.summary,
        blocks: [
          {
            kind: "kpis",
            items: overview.cards.map((card) => ({
              label: card.label,
              value: `${card.value}${card.unit ? ` ${card.unit}` : ""}`,
              note: `${card.delta} ${card.deltaUnit} · ${card.note}`,
            })),
          },
        ],
      };
    }
    case "profitBridge": {
      const overview = views.overview();
      return {
        conclusion: `营业利润从 ${formatAmount(overview.previousProfit)} 万元到 ${formatAmount(overview.currentProfit)} 万元，同比 ${formatSignedAmount(overview.profitDelta)} 万元。`,
        blocks: [
          { kind: "chart", title: "利润桥 · 营业利润同比", svg: profitBridgeSvg(overview.bridge) },
          {
            kind: "table",
            columns: ["因素", "影响额（万元）"],
            rows: overview.bridge
              .filter((node) => node.kind === "up" || node.kind === "down")
              .map((node) => [node.label, formatSignedAmount(node.effect)]),
          },
        ],
      };
    }
    case "origins": {
      const insights = views.insights();
      return {
        conclusion: insights.headline,
        blocks: [
          {
            kind: "table",
            columns: ["排名", "来源", "贡献（万元）", "占比", "说明"],
            rows: insights.origins.map((origin) => [
              String(origin.rank),
              origin.label,
              formatSignedAmount(origin.amount),
              formatPercent(origin.share),
              origin.note,
            ]),
          },
        ],
      };
    }
    case "topActions":
    case "allActions": {
      const insights = views.insights();
      const actions = key === "topActions" ? insights.actions.slice(0, 3) : insights.actions;
      return {
        conclusion:
          actions.length === 0 ? "本期没有触发行动建议。" : `本期共 ${insights.actions.length} 条行动建议${key === "topActions" ? "，以下为优先级最高的三条" : ""}。`,
        blocks: [
          {
            kind: "list",
            items: actions.map((action) => ({
              title: action.title,
              detail: `${action.why}\n${action.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`,
              meta: `责任部门：${action.owner}`,
            })),
          },
        ],
      };
    }
    case "structure": {
      const view = views.structure();
      const { sameStore, newStore, total } = view.split;
      return {
        conclusion: `营业收入同比 ${formatSignedAmount(total.delta)} 万元（${formatSignedPercent(total.deltaRate)}），其中同店 ${formatSignedAmount(sameStore.delta)} 万元、新店 ${formatSignedAmount(newStore.delta)} 万元。`,
        blocks: [
          {
            kind: "table",
            columns: ["分组", "本期（万元）", "上年同期（万元）", "同比差额", "增减率", "门店数"],
            rows: [sameStore, newStore, total].map((card) => [
              card.label,
              formatAmount(card.current),
              formatAmount(card.previous),
              formatSignedAmount(card.delta),
              formatSignedPercent(card.deltaRate),
              String(card.storeCount),
            ]),
          },
          {
            kind: "chart",
            title: "区域收入同比差额（万元）",
            svg: deltaBarSvg(view.regions.map((region) => ({ label: region.key, value: region.delta }))),
          },
        ],
      };
    }
    case "sameStore": {
      const view = views.sameStore();
      const { summary } = view;
      const top = [...view.rows].sort((a, b) => b.revenueDelta - a.revenueDelta);
      return {
        conclusion: `${summary.sameStoreCount} 家同店收入同比 ${formatSignedAmount(summary.revenueDelta)} 万元：客流影响 ${formatSignedAmount(summary.trafficEffect)} 万元，客单价影响 ${formatSignedAmount(summary.ticketEffect)} 万元。`,
        blocks: [
          {
            kind: "chart",
            title: "门店收入同比差额（万元）",
            svg: deltaBarSvg(top.map((row) => ({ label: row.name, value: row.revenueDelta }))),
          },
          {
            kind: "table",
            columns: ["门店", "收入差", "客流影响", "客单价影响"],
            rows: top.map((row) => [
              row.name,
              formatSignedAmount(row.revenueDelta),
              formatSignedAmount(row.trafficEffect),
              formatSignedAmount(row.ticketEffect),
            ]),
          },
        ],
      };
    }
    case "channel": {
      const view = views.channel();
      return {
        conclusion: view.summary,
        blocks: [
          {
            kind: "chart",
            title: "渠道收入同比差额（万元）",
            svg: deltaBarSvg(view.channels.map((channel) => ({ label: channel.key, value: channel.delta }))),
          },
        ],
      };
    }
    case "product": {
      const view = views.product();
      return {
        conclusion: view.insights.conclusion || "系列销量结构见下表。",
        blocks: [
          {
            kind: "table",
            columns: ["系列", "本期销量", "上年同期销量", "销量差", "本期收入（万元）", "收入占比"],
            rows: view.categories.map((row) => [
              row.name,
              formatAmount(row.qtyCurrent).replace(/\.00$/, ""),
              formatAmount(row.qtyPrevious).replace(/\.00$/, ""),
              formatSignedAmount(row.qtyDelta).replace(/\.00$/, ""),
              formatAmount(row.revenueCurrent),
              formatPercent(row.share),
            ]),
          },
        ],
      };
    }
    case "insights": {
      const insights = views.insights();
      return {
        conclusion: `共 ${insights.counts.total} 条结论：严重 ${insights.counts.critical}、关注 ${insights.counts.warning}、正向 ${insights.counts.positive}。`,
        blocks: [
          {
            kind: "list",
            items: insights.insights.map((insight) => ({
              title: insight.title,
              detail: insight.detail,
              meta: INSIGHT_SEVERITY_LABELS[insight.severity],
            })),
          },
        ],
      };
    }
  }
}

export function newReportId(): string {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `R${stamp}-${Math.random().toString(16).slice(2, 8).padEnd(6, "0")}`;
}

/** 生成报告：只支持当前数据集的最新期间（与页面一致） */
export function buildReport(input: { templateId: string; title?: string; id?: string; now?: Date }): Report {
  const template = getReportTemplate(input.templateId);
  if (!template) {
    throw new ReportError("未知报告模板");
  }
  const seed = loadSeed();
  const selected = analysisPeriods(seed);
  if (!selected) {
    throw new ReportError("当前数据集没有任何期间，请先导入数据");
  }

  const views = {
    overview: lazy(buildOverview),
    insights: lazy(buildInsightsView),
    structure: lazy(buildStructureView),
    sameStore: lazy(buildSameStoreView),
    channel: lazy(buildChannelView),
    product: lazy(buildProductView),
  };

  const chapters: ReportChapter[] = template.chapters.map((chapter) => {
    const missing = missingFor(seed, chapter.requires);
    if (missing.length > 0) {
      return { key: chapter.key, title: chapter.title, conclusion: SKIPPED, skipped: true, missing, blocks: [] };
    }
    const { conclusion, blocks } = chapterBlocks(chapter.key, views);
    return { key: chapter.key, title: chapter.title, conclusion, skipped: false, missing: [], blocks };
  });

  const headlineChapter = chapters.find((chapter) => !chapter.skipped);
  const createdAt = (input.now ?? new Date()).toISOString();
  const title = input.title?.trim().slice(0, 80) || `${selected.current.label}经营分析报告 · ${template.name}`;

  return {
    id: input.id ?? newReportId(),
    title,
    templateId: template.id,
    templateName: template.name,
    period: {
      current: selected.current.id,
      previous: selected.previous.id,
      currentLabel: selected.current.label,
      previousLabel: selected.previous.label,
    },
    dataset: seed.dataset,
    sourceFile: seed.meta.source_file,
    unit: seed.meta.currency_unit,
    createdAt,
    headline: headlineChapter?.conclusion ?? "当前数据集不足以生成任何章节，请先导入数据。",
    chapters,
  };
}
