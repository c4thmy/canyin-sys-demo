/**
 * 收入分析指标引擎 · 类型定义
 *
 * 约定：
 * - 金额单位跟随调用方传入的数据（样例数据为「万元」），引擎不做单位换算。
 * - 比率（share / deltaRate / 转化率）统一用 0–1 的小数表示，不乘 100。
 * - 全部为纯数据类型，引擎不读文件、不依赖 React / 数据库。
 */

/** 按期间索引的数值，key 为期间标识（如 "2024-09"） */
export type NumberByPeriod = Readonly<Record<string, number>>;

/** 本期与上年同期的对照 */
export interface PeriodPair {
  /** 本期，如 "2025-09" */
  readonly current: string;
  /** 上年同期，如 "2024-09" */
  readonly previous: string;
}

/** 期间入参：只给本期字符串时自动推算上年同期，也可显式给一对期间 */
export type PeriodInput = string | PeriodPair;

/** 收入结构可切换的四个维度 */
export type DimensionKey = "store" | "region" | "channel" | "category";

/** 聚合函数可接受的最小数据形状：门店 / 渠道 / 品类都满足 */
export interface DimensionItem {
  readonly name: string;
  /** 仅 region 维度需要 */
  readonly region?: string;
  readonly revenue: NumberByPeriod;
}

/** 门店（样例数据含 is_new 标记） */
export interface Store {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly isNew: boolean;
  readonly revenue: NumberByPeriod;
}

/** 渠道 */
export interface Channel {
  readonly id?: string;
  readonly name: string;
  readonly revenue: NumberByPeriod;
}

/** 产品系列 */
export interface Category {
  readonly id?: string;
  readonly name: string;
  readonly qty: NumberByPeriod;
  /** 平均单价，单位元/份；样例数据只有本期值 */
  readonly unitPrice: NumberByPeriod;
  readonly revenue: NumberByPeriod;
  readonly cost?: NumberByPeriod;
}

/** 维度聚合后的一个分组 */
export interface AggregateGroup {
  /** 分组名（门店名 / 区域名 / 渠道名 / 系列名） */
  readonly key: string;
  /** 本期收入 */
  readonly revenue: number;
  /** 上年同期收入 */
  readonly prevRevenue: number;
  /** 同比差额 = revenue - prevRevenue */
  readonly delta: number;
  /** 同比增减率 = delta / prevRevenue；上期为 0 时为 null */
  readonly deltaRate: number | null;
  /** 本期收入占全部项目本期收入的比重（0–1） */
  readonly share: number;
}

/** 两期对照的数值 */
export interface PeriodComparison {
  readonly previous: number;
  readonly current: number;
  readonly delta: number;
  /** 上期为 0 时为 null */
  readonly deltaRate: number | null;
}

/** 同店 / 新店拆分结果 */
export interface SameNewStoreSplit {
  readonly sameStore: PeriodComparison;
  readonly newStore: PeriodComparison;
  readonly total: PeriodComparison;
}

/** 客流 × 客单价分解入参：0 为上年同期，1 为本期 */
export interface TrafficTicketInput {
  readonly traffic0: number;
  readonly ticket0: number;
  readonly traffic1: number;
  readonly ticket1: number;
}

/** 销量 × 单价分解入参 */
export interface QtyPriceInput {
  readonly qty0: number;
  readonly price0: number;
  readonly qty1: number;
  readonly price1: number;
}

/** 客流 × 人均销量 × 单价分解入参 */
export interface TrafficPerCapitaPriceInput {
  readonly traffic0: number;
  readonly perCapita0: number;
  readonly price0: number;
  readonly traffic1: number;
  readonly perCapita1: number;
  readonly price1: number;
}

/** 客流 × 客单价分解结果（金额单位 = 客流单位 × 客单价单位） */
export interface TrafficTicketResult {
  readonly trafficEffect: number;
  readonly ticketEffect: number;
  /** trafficEffect + ticketEffect，等于两期收入差 */
  readonly total: number;
}

/** 销量 × 单价分解结果 */
export interface QtyPriceResult {
  readonly qtyEffect: number;
  readonly priceEffect: number;
  /** qtyEffect + priceEffect，等于两期收入差 */
  readonly total: number;
}

/** 三因素分解结果 */
export interface TrafficPerCapitaPriceResult {
  readonly trafficEffect: number;
  readonly perCapitaEffect: number;
  readonly priceEffect: number;
  /** 三项之和，等于两期收入差 */
  readonly total: number;
}

/** 渠道漏斗的四级人数；缺失用 null 表示（源表 `--`） */
export interface FunnelCounts {
  readonly exposure: number | null;
  readonly visits: number | null;
  readonly payments: number | null;
  readonly consumers: number | null;
}

/** 渠道漏斗的三级转化率 + 整体曝光→消费转化率；无法计算时为 null */
export interface FunnelRates {
  /** 曝光 → 访问 */
  readonly visitRate: number | null;
  /** 访问 → 支付 */
  readonly payRate: number | null;
  /** 支付 → 消费 */
  readonly consumeRate: number | null;
  /** 曝光 → 消费 */
  readonly overallRate: number | null;
}

/** topContributors 的输入行：聚合结果可直接传入 */
export interface ContributionRow {
  readonly key: string;
  readonly revenue: number;
  readonly prevRevenue: number;
  readonly delta: number;
  readonly deltaRate?: number | null;
}

/** 异动贡献排名的一项 */
export interface TopContributor {
  readonly key: string;
  readonly revenue: number;
  readonly prevRevenue: number;
  readonly delta: number;
  readonly deltaRate: number | null;
  /** |delta| 占全部项目 |delta| 之和的比重（0–1） */
  readonly share: number;
}

/** 渠道 ROI 计算入参；金额单位需与收入口径一致 */
export interface ChannelRoiInput {
  /** 平台销售额 */
  readonly platformRevenue: number;
  /** 平台费用 */
  readonly platformFee: number;
  /** 平台毛利额 */
  readonly platformGrossProfit: number;
}

/** 渠道 ROI 结果；无法计算时为 null */
export interface ChannelRoiResult {
  /** 平台费用率 = 平台费用 / 平台销售额 */
  readonly feeRate: number | null;
  /** 毛利口径 ROI = 平台毛利额 / 平台费用 */
  readonly grossRoi: number | null;
  /** 销售额口径 ROI = 平台销售额 / 平台费用 */
  readonly salesRoi: number | null;
  /** 三项阈值是否全部满足；任一比率无法计算时为 null */
  readonly healthy: boolean | null;
}

/** 利润表项目；金额单位跟随数据源（样例数据为万元） */
export interface PnlItem {
  readonly item: string;
  readonly values: NumberByPeriod;
}

/** 利润桥节点类型：起止节点为营业利润总额，中间节点为因素贡献 */
export type ProfitBridgeKind = "start" | "up" | "down" | "end";

/** 利润桥瀑布图节点 */
export interface ProfitBridgeNode {
  /** 稳定标识，如 lastYearProfit / revenue / foodCost / thisYearProfit */
  readonly key: string;
  /** 中文显示名 */
  readonly label: string;
  /** 因素影响额；起止节点固定为 0 */
  readonly effect: number;
  /** 该节点之后的累计营业利润；起止节点即两期营业利润本身 */
  readonly cumulative: number;
  readonly kind: ProfitBridgeKind;
}
