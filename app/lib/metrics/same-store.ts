import { amountFor, resolvePeriodPair } from "./period.js";
import type { PeriodComparison, PeriodInput, SameNewStoreSplit, Store } from "./types.js";

function compare(previous: number, current: number): PeriodComparison {
  const delta = current - previous;
  return {
    previous,
    current,
    delta,
    deltaRate: previous === 0 ? null : delta / previous,
  };
}

/**
 * 拆分同店与新店收入，两个期间都返回。
 *
 * 同店判定直接使用门店的 isNew 标记（样例数据由门店名是否以「新店」开头生成）。
 * 口径待确认：真实业务中同店通常指开业满 12 个月且两期均可比的门店，后续应改为
 * 按开业日期判定，见 docs/domain/revenue-analysis-model.md 第 10 节。
 */
export function splitSameNewStore(stores: readonly Store[], period: PeriodInput): SameNewStoreSplit {
  const { current, previous } = resolvePeriodPair(period);

  let samePrevious = 0;
  let sameCurrent = 0;
  let newPrevious = 0;
  let newCurrent = 0;

  for (const store of stores) {
    const prevRevenue = amountFor(store.revenue, previous);
    const currentRevenue = amountFor(store.revenue, current);
    if (store.isNew) {
      newPrevious += prevRevenue;
      newCurrent += currentRevenue;
    } else {
      samePrevious += prevRevenue;
      sameCurrent += currentRevenue;
    }
  }

  return {
    sameStore: compare(samePrevious, sameCurrent),
    newStore: compare(newPrevious, newCurrent),
    total: compare(samePrevious + newPrevious, sameCurrent + newCurrent),
  };
}
