import { aggregate } from "./aggregate.js";
import type { Channel, ChannelRevenueTable, PeriodInput } from "./types.js";

/**
 * 渠道同比表：10 个渠道的本期收入、上期收入、同比差额、增减率与本期占比。
 *
 * - 聚合与占比复用 aggregate(…, "channel", …)，与收入结构页同一口径；
 * - 排序改为**按同比差额降序**（差额相同按渠道名升序）：渠道页要回答的是
 *   「谁在增长、谁在拖后腿」，而不是「谁体量大」；
 * - total 为全部渠道合计，增减率以合计上期为基数。
 */
export function channelRevenue(
  channels: readonly Channel[],
  period: PeriodInput,
): ChannelRevenueTable {
  const rows = [...aggregate(channels, "channel", period)].sort(
    (a, b) => b.delta - a.delta || a.key.localeCompare(b.key, "zh-Hans-CN"),
  );

  const sums = rows.reduce(
    (total, row) => ({
      current: total.current + row.revenue,
      previous: total.previous + row.prevRevenue,
    }),
    { current: 0, previous: 0 },
  );
  const delta = sums.current - sums.previous;

  return {
    rows,
    total: {
      current: sums.current,
      previous: sums.previous,
      delta,
      deltaRate: sums.previous === 0 ? null : delta / sums.previous,
    },
  };
}
