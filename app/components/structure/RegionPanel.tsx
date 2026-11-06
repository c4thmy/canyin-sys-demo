import Link from "next/link";

import { formatAmount, formatPercent, formatSignedAmount, formatSignedPercent } from "../../lib/format.js";
import type { RegionStructure } from "../../lib/metrics/types.js";
import { DeltaValue } from "../DeltaValue.js";
import { NewBadge } from "../NewBadge.js";
import { Panel } from "../Panel.js";

const GRID =
  "grid grid-cols-[minmax(110px,1.25fr)_repeat(5,minmax(82px,1fr))_28px] items-center gap-2";

export function RegionPanel({
  regions,
  unit,
}: {
  regions: readonly RegionStructure[];
  unit: string;
}) {
  return (
    <Panel
      title="区域收入结构"
      description={`${regions.length} 个区域 · 点击区域展开成员门店 · 区域内门店按同比差额降序`}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className={`${GRID} border-b border-slate-200 pb-2 text-sm text-slate-500`}>
            <span>区域</span>
            <span className="text-right">本期（{unit}）</span>
            <span className="text-right">上期（{unit}）</span>
            <span className="text-right">同比差额</span>
            <span className="text-right">增减率</span>
            <span className="text-right">占比</span>
            <span aria-hidden="true" />
          </div>

          <div className="divide-y divide-slate-100">
            {regions.map((region, index) => (
              <details key={region.key} className="group" open={index === 0}>
                <summary className={`${GRID} cursor-pointer list-none rounded-lg py-3.5 transition hover:bg-teal-50/40 [&::-webkit-details-marker]:hidden`}>
                  <span className="flex items-center gap-2 text-[15px] font-medium text-slate-900">
                    <span
                      aria-hidden="true"
                      className="inline-block text-xs text-slate-400 transition-transform group-open:rotate-90"
                    >
                      ▶
                    </span>
                    {region.key}
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-normal text-slate-500">
                      {region.stores.length} 家
                    </span>
                  </span>
                  <span className="text-right font-mono text-[15px] tabular-nums text-slate-900">
                    {formatAmount(region.revenue)}
                  </span>
                  <span className="text-right font-mono text-[15px] tabular-nums text-slate-500">
                    {formatAmount(region.prevRevenue)}
                  </span>
                  <span className="text-right">
                    <DeltaValue value={region.delta} text={formatSignedAmount(region.delta)} />
                  </span>
                  <span className="text-right">
                    <DeltaValue value={region.delta} text={formatSignedPercent(region.deltaRate)} />
                  </span>
                  <span className="text-right font-mono text-[15px] tabular-nums text-slate-600">
                    {formatPercent(region.share)}
                  </span>
                  <span aria-hidden="true" />
                </summary>

                <div className="pb-4 pl-6 pr-1">
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">{region.key}成员门店收入与同比</caption>
                    <thead>
                      <tr className="border-b border-slate-100 text-xs text-slate-400">
                        <th scope="col" className="py-2 pr-3 text-left font-medium">门店</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">本期</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">上期</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">同比差额</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">增减率</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">占同店比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {region.stores.map((store) => (
                        <tr key={store.id} className="border-b border-slate-50 last:border-0">
                          <th scope="row" className="py-2.5 pr-3 text-left font-normal text-slate-800">
                            <span className="flex items-center gap-2">
                              <Link
                                href={`/revenue/store/${store.id}`}
                                className="rounded-sm underline-offset-4 hover:text-teal-700 hover:underline"
                              >
                                {store.name}
                              </Link>
                              {store.isNew ? <NewBadge /> : null}
                            </span>
                          </th>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800">
                            {formatAmount(store.revenue)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-400">
                            {formatAmount(store.prevRevenue)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <DeltaValue value={store.delta} text={formatSignedAmount(store.delta)} />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {store.deltaRate === null ? (
                              <span className="font-mono text-slate-400">新增</span>
                            ) : (
                              <DeltaValue value={store.delta} text={formatSignedPercent(store.deltaRate)} />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500">
                            {store.sameStoreShare === null ? "—" : formatPercent(store.sameStoreShare)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-500">
        区域占比的分母为全部门店本期收入；新店不参与同店占比与排名。
      </p>
    </Panel>
  );
}
