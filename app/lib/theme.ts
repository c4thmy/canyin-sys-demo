/**
 * 全站唯一一份设计常量：数据色、图表中性色、版式、字号阶梯与指标口径。
 *
 * 只放纯数据，不依赖 React，供 Tailwind 配置、服务端组件与单测共用。
 * 组件里不再直接写 `#0f9d76`、`text-[13px]` 这类 magic number。
 */

/** 数据色：上升绿 / 下降红 / 总计蓝。全站（含 ECharts）只允许用这一组。 */
export const DATA_COLOR = {
  up: "#0f9d76",
  down: "#d64545",
  total: "#2563eb",
} as const;

/** 图表中性色：坐标轴、网格、标签、提示框。 */
export const CHART_COLOR = {
  axisLabel: "#64748b",
  axisLine: "#cbd5e1",
  categoryLabel: "#334155",
  gridLine: "#e9eff5",
  valueLabel: "#0f172a",
  tooltipBackground: "#0f172a",
  tooltipText: "#f8fafc",
} as const;

/** 版式：页头与正文共用同一最大宽度和左右留白。 */
export const LAYOUT = {
  /** 页头容器：1440 上限 + 24/40px 边距 */
  header: "mx-auto w-full max-w-[1440px] px-6 py-10 lg:px-10",
  /** 正文容器：与页头同宽同留白，纵向节奏统一 24px */
  container: "mx-auto w-full max-w-[1440px] space-y-6 px-6 py-8 lg:px-10",
  /** 外层卡片：白底 + 1px slate-200 边框 + 统一圆角，边框与阴影来自 .card-surface */
  card: "card-surface rounded-2xl",
  /** 外层卡片标准内边距 */
  cardPadding: "p-6 lg:p-7",
  /** 引导段落卡片的紧凑内边距 */
  compactCardPadding: "px-6 py-5 lg:px-7",
  /** 卡片内部的次级面板 */
  inset: "rounded-xl border border-slate-200 bg-slate-50/70",
} as const;

/** 字号阶梯：页标题 / 区块标题 / 卡片标题 / 表头 / 正文 / 微标签 / 数字。 */
export const TYPE = {
  pageTitle: "text-4xl font-semibold tracking-tight text-white lg:text-5xl",
  eyebrow: "text-meta font-semibold uppercase tracking-[0.3em] text-teal-300",
  headerMeta: "text-lg text-slate-300",
  /** 区块标题（Panels、页面级 section） */
  sectionTitle: "text-2xl font-semibold tracking-tight text-slate-900",
  /** 结论 / 口径等小号大写标题 */
  calloutTitle: "text-sm font-semibold uppercase tracking-[0.2em] text-teal-700",
  /** 指标卡标签 */
  cardLabel: "text-base font-medium tracking-wide text-slate-500",
  /** 普通卡片标题 */
  cardTitle: "text-lg font-semibold tracking-tight text-slate-900",
  /** 重点结论卡标题 */
  featuredTitle: "text-xl font-semibold leading-8 tracking-tight text-slate-900",
  /** 小节标题 */
  subhead: "text-sm font-semibold text-slate-800",
  /** 图表说明小标题 */
  caption: "text-sm font-medium text-slate-600",
  /** 表头 */
  tableHead: "text-sm text-slate-500",
  /** 嵌套表头（二级表头） */
  tableHeadNested: "text-xs text-slate-400",
  body: "text-body leading-7 text-slate-600",
  /** 一页结论 / 一句话小结的正文 */
  calloutBody: "text-xl leading-9 text-slate-800 lg:text-[1.375rem]",
  /** 结论页总纲，比普通结论正文再大一档 */
  heroStatement: "text-xl leading-9 text-slate-800 lg:text-[1.5rem] lg:leading-10",
  note: "text-sm leading-6 text-slate-500",
  micro: "text-micro leading-5",
  numeric: "font-mono tabular-nums",
  /** 数字阶梯：主指标 → 次级大数 → 中等读数 → 卡片内差值 → 表格内数字 */
  numberHero:
    "font-mono text-4xl font-semibold leading-none tracking-tight tabular-nums xl:text-[2.5rem]",
  numberLg: "font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums",
  numberMd: "font-mono text-2xl font-semibold leading-none tabular-nums",
  numberSm: "font-mono text-lg font-semibold tabular-nums",
  numberInline: "font-mono text-body tabular-nums",
} as const;

/** 六个关键指标：hover 说明里的公式与数据来源，口径以 docs/domain/revenue-analysis-model.md 为准。 */
export type MetricKey =
  | "revenue"
  | "profit"
  | "foodCostRate"
  | "sameStoreGrowth"
  | "outputRatio"
  | "contributionMargin";

export interface MetricDefinition {
  readonly label: string;
  readonly formula: string;
  readonly source: string;
}

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  revenue: {
    label: "营业收入",
    formula: "营业收入 = 堂食 + 外卖；本 Demo 取利润表「营业收入」项",
    source: "data/seed/pnl.json（利润表）",
  },
  profit: {
    label: "营业利润",
    formula:
      "营业利润 = 营业收入 − 变动成本 − 固定成本；变动成本按费率归因，固定成本按绝对额归因",
    source: "data/seed/pnl.json（利润表）与利润桥 9 项因素",
  },
  foodCostRate: {
    label: "食材成本率",
    formula: "食材成本率 = 食材成本 ÷ 营业收入",
    source: "data/seed/pnl.json（利润表）；2025 食材成本为按成本率 26.7% 的推算值",
  },
  sameStoreGrowth: {
    label: "同店收入增速",
    formula: "同店收入增速 =（本期同店收入 − 上年同期同店收入）÷ 上年同期同店收入",
    source: "data/seed/stores.json（门店表），仅统计 is_new = false 的 13 家同店",
  },
  outputRatio: {
    label: "产投比",
    formula:
      "产投比 = 毛利额 ÷ 投入成本 =（新客量 × 客单价 × 毛利率）÷（新客量 × 新客成本）= 客单价 × 毛利率 ÷ 新客成本",
    source: "data/seed/acquisition.json（表8 增收提价的预算&目标），是预算目标值，不是当期实际值",
  },
  contributionMargin: {
    label: "边际贡献率",
    formula:
      "边际贡献率 =（营业收入 − 食材成本 − 优惠及手续费 − 水电气低值 − 宣传费用）÷ 营业收入",
    source: "data/seed/pnl.json（利润表）；2024-09 实测 41.87%，用于利润桥「收入规模」项",
  },
};

/** 原生 title 文案：三行，分别是指标名、公式、来源。 */
export function metricTooltip(key: MetricKey): string {
  const definition = METRIC_DEFINITIONS[key];
  return `${definition.label}\n公式：${definition.formula}\n来源：${definition.source}`;
}
