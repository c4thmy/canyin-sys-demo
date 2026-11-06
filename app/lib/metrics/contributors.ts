import type { ContributionRow, TopContributor } from "./types.js";

/**
 * 按 |delta| 降序取前 n 项，返回异动贡献排名与贡献占比。
 *
 * 用途：定位「异动原点」——同比变化最大的前几个渠道 / 系列 / 门店。
 * 占比口径：每项 |delta| 除以**全部传入项目**的 |delta| 之和（不是前 n 项内部归一），
 * 这样 n 变化时每项的占比仍然可横向比较。全部 delta 为 0 时占比记为 0。
 *
 * 输入可直接使用 aggregate() 的返回结果；n <= 0 时返回空数组。
 */
export function topContributors(
  items: readonly ContributionRow[],
  n: number,
): TopContributor[] {
  if (!Number.isFinite(n) || n <= 0) {
    return [];
  }

  const totalAbsDelta = items.reduce((sum, item) => sum + Math.abs(item.delta), 0);

  return [...items]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.key.localeCompare(b.key, "zh-Hans-CN"))
    .slice(0, Math.floor(n))
    .map((item) => {
      const deltaRate =
        item.deltaRate !== undefined
          ? item.deltaRate
          : item.prevRevenue === 0
            ? null
            : item.delta / item.prevRevenue;
      return {
        key: item.key,
        revenue: item.revenue,
        prevRevenue: item.prevRevenue,
        delta: item.delta,
        deltaRate,
        share: totalAbsDelta === 0 ? 0 : Math.abs(item.delta) / totalAbsDelta,
      };
    });
}
