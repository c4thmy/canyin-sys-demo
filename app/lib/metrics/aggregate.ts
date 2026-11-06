import { amountFor, resolvePeriodPair } from "./period.js";
import type {
  AggregateGroup,
  DimensionItem,
  DimensionKey,
  PeriodInput,
} from "./types.js";

/** 取出分组键；region 维度要求数据带 region 字段 */
function groupKey(item: DimensionItem, dimension: DimensionKey): string {
  if (dimension === "region") {
    if (!item.region) {
      throw new Error(`维度 region 需要数据带 region 字段，${item.name} 缺失`);
    }
    return item.region;
  }
  return item.name;
}

/**
 * 按维度聚合收入，返回每组的两期收入、同比差额、增减率与本期占比。
 *
 * - store / channel / category 维度用条目的 name 作为分组键；
 * - region 维度用条目的 region 作为分组键；
 * - 结果按本期收入降序，同额时按分组键升序，保证输出稳定；
 * - 占比 share 的分母是本次传入全部项目的本期收入合计。
 */
export function aggregate(
  items: readonly DimensionItem[],
  dimension: DimensionKey,
  period: PeriodInput,
): AggregateGroup[] {
  const { current, previous } = resolvePeriodPair(period);

  const buckets = new Map<string, { revenue: number; prevRevenue: number }>();
  for (const item of items) {
    const key = groupKey(item, dimension);
    const bucket = buckets.get(key) ?? { revenue: 0, prevRevenue: 0 };
    bucket.revenue += amountFor(item.revenue, current);
    bucket.prevRevenue += amountFor(item.revenue, previous);
    buckets.set(key, bucket);
  }

  const totalRevenue = [...buckets.values()].reduce((sum, bucket) => sum + bucket.revenue, 0);

  return [...buckets.entries()]
    .map(([key, bucket]): AggregateGroup => {
      const delta = bucket.revenue - bucket.prevRevenue;
      return {
        key,
        revenue: bucket.revenue,
        prevRevenue: bucket.prevRevenue,
        delta,
        deltaRate: bucket.prevRevenue === 0 ? null : delta / bucket.prevRevenue,
        share: totalRevenue === 0 ? 0 : bucket.revenue / totalRevenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || a.key.localeCompare(b.key, "zh-Hans-CN"));
}
