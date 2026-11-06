import Link from "next/link";

import { formatAmount, formatPercent, formatSignedAmount, formatSignedPercent } from "../../lib/format.js";
import type { StoreStructureRow } from "../../lib/metrics/types.js";
import { ClickableRow } from "../ClickableRow.js";
import { DeltaValue } from "../DeltaValue.js";
import { NewBadge } from "../NewBadge.js";
import { Panel } from "../Panel.js";

export function StorePanel({
  stores,
  unit,
}: {
  stores: readonly StoreStructureRow[];
  unit: string;
}) {
  const totals = stores.reduce(
    (total, store) => ({
      revenue: total.revenue + store.revenue,
      prevRevenue: total.prevRevenue + store.prevRevenue,
      delta: total.delta + store.delta,
    }),
    { revenue: 0, prevRevenue: 0, delta: 0 },
  );

  return (
    <Panel
      title="门店收入结构"
      description={`${stores.length} 家门店（含 ${stores.filter((store) => store.isNew).length} 家新店）· 默认按同比差额降序 · 点击任意门店行下钻详情`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left text-[15px]">
          <caption className="sr-only">15 家门店收入结构，含本期、上期、同比差额与占同店比</caption>
          <thead>
            <tr className="border-b border-slate-200 text-sm text-slate-500">
              <th scope="col" className="py-3 pr-4 font-medium">门店</th>
              <th scope="col" className="px-4 py-3 font-medium">区域</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">本期（{unit}）</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">上期（{unit}）</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">同比差额</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">增减率</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">占同店比</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <ClickableRow key={store.id} href={`/revenue/store/${store.id}`}>
                <th scope="row" className="py-3.5 pr-4 font-medium text-slate-900">
                  <span className="flex items-center gap-2">
                    <Link
                      href={`/revenue/store/${store.id}`}
                      className="rounded-sm text-slate-900 underline-offset-4 hover:text-teal-700 hover:underline"
                    >
                      {store.name}
                    </Link>
                    {store.isNew ? <NewBadge /> : null}
                  </span>
                </th>
                <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">{store.region}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono tabular-nums text-slate-900">
                  {formatAmount(store.revenue)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono tabular-nums text-slate-500">
                  {formatAmount(store.prevRevenue)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <DeltaValue value={store.delta} text={formatSignedAmount(store.delta)} />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  {store.deltaRate === null ? (
                    <span className="font-mono text-slate-400">新增</span>
                  ) : (
                    <DeltaValue
                      value={store.delta}
                      text={formatSignedPercent(store.deltaRate)}
                    />
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono tabular-nums text-slate-600">
                  {store.sameStoreShare === null ? "—" : formatPercent(store.sameStoreShare)}
                </td>
              </ClickableRow>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 text-[15px] font-semibold text-slate-900">
              <th scope="row" className="py-3.5 pr-4 text-left">合计</th>
              <td className="px-4 py-3.5 text-slate-500">{stores.length} 家</td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums">{formatAmount(totals.revenue)}</td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-500">
                {formatAmount(totals.prevRevenue)}
              </td>
              <td className="px-4 py-3.5 text-right">
                <DeltaValue value={totals.delta} text={formatSignedAmount(totals.delta)} />
              </td>
              <td className="px-4 py-3.5 text-right">
                <DeltaValue
                  value={totals.delta}
                  text={formatSignedPercent(totals.prevRevenue === 0 ? null : totals.delta / totals.prevRevenue)}
                />
              </td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-500">100.00%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">
        占同店比的分母为 13 家同店本期收入合计；新店不参与同店占比与排名。
        收入口径取门店表（{formatAmount(totals.revenue)} {unit}），与新店、同店拆分一致。
      </p>
    </Panel>
  );
}
