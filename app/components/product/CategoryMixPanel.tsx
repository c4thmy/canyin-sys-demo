import { formatAmount, formatInteger, formatPercent, formatSignedInteger, formatSignedPercent } from "../../lib/format.js";
import type { CategoryMixRow } from "../../lib/metrics/types.js";
import type { CategoryFocus } from "../../lib/product-view.js";
import { TYPE } from "../../lib/theme.js";
import { DeltaValue } from "../DeltaValue.js";
import { Panel } from "../Panel.js";

/**
 * 系列销量结构：8 个系列的销量同比 + 2025 单价与收入占比。
 *
 * 不做销量 × 单价分解——2024 系列单价在源表缺失、2024 收入是按本期单价反推的，
 * 在这里分解只会得到每个系列相同的假涨幅；量价分解放到套餐层。
 */
export function CategoryMixPanel({
  rows,
  focus,
  unit,
  total,
}: {
  rows: readonly CategoryMixRow[];
  focus: readonly CategoryFocus[];
  unit: string;
  total: { readonly qtyCurrent: number; readonly qtyPrevious: number; readonly qtyDelta: number; readonly revenueCurrent: number };
}) {
  const focusReasonOf = new Map(focus.map((item) => [item.name, item.reason]));
  const maxAbsRate = Math.max(...rows.map((row) => Math.abs(row.qtyDeltaRate ?? 0)), 0.01);
  const totalUnitPrice = total.qtyCurrent === 0 ? null : (total.revenueCurrent * 10000) / total.qtyCurrent;

  return (
    <Panel
      title={`系列销量结构 · ${rows.length} 个系列`}
      description="按 2025 收入降序。列只给销量与本期单价、本期收入——2024 单价源表缺失，系列层不做量价分解。"
      actions={
        <span className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 ${TYPE.note}`}>
          本期收入 <span className="font-mono tabular-nums">{formatAmount(total.revenueCurrent)}</span> {unit}
        </span>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 lg:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className={TYPE.caption}>销量增减率 · 横向条形</h3>
          <p className="text-xs text-slate-400">
            <span className="text-up">■</span> 上升
            <span className="ml-3 text-down">■</span> 下降 · 长度按增减率绝对值归一
          </p>
        </div>

        <div className="mt-4 space-y-1.5">
          {rows.map((row) => {
            const rate = row.qtyDeltaRate ?? 0;
            const width = Math.max(0.8, (Math.abs(rate) / maxAbsRate) * 50);
            const positive = rate >= 0;
            return (
              <div key={row.name} className="flex items-center gap-3">
                <span className="w-16 shrink-0 truncate text-body text-slate-600" title={row.name}>
                  {row.name}
                </span>
                <div className="relative h-7 flex-1 overflow-hidden rounded-md border border-slate-200/70 bg-white">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" aria-hidden="true" />
                  <span
                    className={[
                      "absolute top-1/2 h-4 -translate-y-1/2",
                      positive ? "rounded-r bg-up" : "rounded-l bg-down",
                    ].join(" ")}
                    style={
                      positive
                        ? { left: "50%", width: `${width}%` }
                        : { right: "50%", width: `${width}%` }
                    }
                  />
                </div>
                <span className="w-20 shrink-0 text-right">
                  <DeltaValue
                    value={rate}
                    text={formatSignedPercent(row.qtyDeltaRate)}
                    className="text-body"
                  />
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span className="w-16 shrink-0" />
          <div className="flex flex-1 justify-between font-mono tabular-nums">
            <span>−{formatPercent(maxAbsRate)}</span>
            <span>0</span>
            <span>+{formatPercent(maxAbsRate)}</span>
          </div>
          <span className="w-20 shrink-0" />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-left text-body">
          <caption className="sr-only">{rows.length} 个产品系列的销量同比、本期平均单价与收入占比</caption>
          <thead>
            <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
              <th scope="col" className="py-3 pr-4 text-left font-medium">系列</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">2025 销量（份）</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">2024 销量（份）</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">销量差（份）</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">增减率</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">2025 单价（元/份）</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">2025 收入（{unit}）</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">收入占比</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const reason = focusReasonOf.get(row.name);
              return (
                <tr
                  key={row.name}
                  className="border-b border-slate-100 transition-colors last:border-0 hover:bg-teal-50/40"
                >
                  <th scope="row" className="py-3.5 pr-4 text-left font-medium text-slate-900">
                    {row.name}
                    {reason ? (
                      <span
                        title={reason}
                        className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-micro font-medium text-amber-800"
                      >
                        关注
                      </span>
                    ) : null}
                  </th>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-900">
                    {formatInteger(row.qtyCurrent)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-500">
                    {formatInteger(row.qtyPrevious)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right">
                    <DeltaValue
                      value={row.qtyDelta}
                      text={formatSignedInteger(row.qtyDelta)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right">
                    <DeltaValue value={row.qtyDelta} text={formatSignedPercent(row.qtyDeltaRate)} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-600">
                    {row.unitPriceCurrent === null ? "—" : formatAmount(row.unitPriceCurrent)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-900">
                    {formatAmount(row.revenueCurrent)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-600">
                    {formatPercent(row.share)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <th scope="row" className="py-3.5 pr-4 text-left">合计</th>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">{formatInteger(total.qtyCurrent)}</td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-500">
                {formatInteger(total.qtyPrevious)}
              </td>
              <td className="px-3 py-3.5 text-right">
                <DeltaValue value={total.qtyDelta} text={formatSignedInteger(total.qtyDelta)} />
              </td>
              <td className="px-3 py-3.5 text-right">
                <DeltaValue
                  value={total.qtyDelta}
                  text={formatSignedPercent(
                    total.qtyPrevious === 0 ? null : total.qtyDelta / total.qtyPrevious,
                  )}
                />
              </td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-500">
                {totalUnitPrice === null ? "—" : formatAmount(totalUnitPrice)}
              </td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                {formatAmount(total.revenueCurrent)}
              </td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-500">100.00%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className={`mt-4 ${TYPE.note}`}>
        单价单位为元/份，收入单位为{unit}。合计单价 = 本期收入 ÷ 本期总销量（混合口径，仅供量级参考）。
        2025 收入为源表值；2024 收入是按本期单价反推的推算值，本表不使用，也不参与页面上任何同比计算。
        「关注」标记由数据算出：本期收入前二 + 销量降幅最大。
      </p>
    </Panel>
  );
}
