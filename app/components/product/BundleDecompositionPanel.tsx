import { formatAmount, formatInteger, formatPercent, formatSignedInteger } from "../../lib/format.js";
import type { BundleDecompositionRow } from "../../lib/metrics/types.js";
import type { BundleTotals } from "../../lib/product-view.js";
import { TYPE } from "../../lib/theme.js";
import { DeltaValue } from "../DeltaValue.js";
import { Panel } from "../Panel.js";

/** 源表个别套餐名带未解码的 HTML 实体（如 B06/B09），展示前解码；不参与任何计算 */
function decodeName(name: string): string {
  return name
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

const KIND_LABEL: Record<BundleDecompositionRow["kind"], string> = {
  leadgen: "引流款",
  regular: "正价",
};

const KIND_STYLE: Record<BundleDecompositionRow["kind"], string> = {
  leadgen: "bg-amber-100 text-amber-800",
  regular: "bg-slate-100 text-slate-600",
};

function EffectBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
}) {
  const width = max === 0 ? 0 : Math.min(100, (Math.abs(value) / max) * 100);
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="w-16 shrink-0 text-right text-micro text-slate-400">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-sm border border-slate-100 bg-white">
        <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right">
        <DeltaValue value={value} text={formatSignedInteger(value)} className="text-xs" />
      </span>
    </div>
  );
}

/**
 * 套餐量价分解：连环替代法（先量后价），只用两期都有数据的套餐。
 *
 * 图表取 |收入差| 最大的 5 个套餐，每个套餐画两条条：销量影响与单价影响共用同一量表，
 * 这样「几乎全部增量来自销量」在视觉上一眼可见（单价影响的条几乎为零）。
 */
export function BundleDecompositionPanel({
  rows,
  totals,
  totalCount,
}: {
  rows: readonly BundleDecompositionRow[];
  totals: BundleTotals;
  totalCount: number;
}) {
  const top5 = [...rows].sort((a, b) => Math.abs(b.amountDelta) - Math.abs(a.amountDelta)).slice(0, 5);
  const maxEffect = Math.max(
    ...top5.flatMap((row) => [Math.abs(row.qtyEffect), Math.abs(row.priceEffect)]),
    1,
  );
  const story = rows[0];
  const priceMoved = rows.filter((row) => Math.abs(row.priceDelta) > 0.005);
  const priceMoveText =
    priceMoved.length === 0
      ? "两期单价完全一致"
      : priceMoved.length === 1
        ? `只有「${decodeName(priceMoved[0].name)}」的单价从 ${formatAmount(
            priceMoved[0].pricePrevious,
          )} 变成 ${formatAmount(priceMoved[0].priceCurrent)} 元`
        : `${priceMoved.length} 个套餐的单价发生变化`;

  return (
    <Panel
      title={`套餐量价分解 · 两期可比 ${rows.length} 个`}
      description="连环替代法，先量后价：销量影响 =（本期销量 − 上期销量）× 上期单价；单价影响 = 本期销量 ×（本期单价 − 上期单价）。单价由「销售额 ÷ 销量」实算，两期都是源表真数。"
      actions={
        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm text-slate-600 tabular-nums">
          {rows.length} / {totalCount} 可比
        </span>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 lg:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className={TYPE.caption}>
            收入差 Top {top5.length} · 销量影响 vs 单价影响（元）
          </h3>
          <p className="text-xs text-slate-400">
            <span className="text-teal-600">■</span> 销量影响
            <span className="ml-3 text-blue-600">■</span> 单价影响 · 两条共用同一量表
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {top5.map((row) => (
            <div key={row.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 truncate text-body font-medium text-slate-800" title={row.name}>
                  {decodeName(row.name)}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="text-xs text-slate-400">收入差</span>
                  <DeltaValue
                    value={row.amountDelta}
                    text={`${formatSignedInteger(row.amountDelta)} 元`}
                    className="text-body font-semibold"
                  />
                </span>
              </div>
              <EffectBar label="销量影响" value={row.qtyEffect} max={maxEffect} tone="bg-teal-600" />
              <EffectBar label="单价影响" value={row.priceEffect} max={maxEffect} tone="bg-blue-500" />
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span className="w-16 shrink-0" />
          <div className="flex flex-1 justify-between font-mono tabular-nums">
            <span>0</span>
            <span>{formatInteger(maxEffect)} 元</span>
          </div>
          <span className="w-20 shrink-0" />
        </div>
      </div>

      <p className={`mt-3 ${TYPE.note}`}>
        蓝色条几乎为零不是画错了：{rows.length} 个可比套餐里{priceMoveText}，
        单价影响合计只有 {formatSignedInteger(totals.priceEffect)} 元——增量几乎全部来自销量。
      </p>

      {story ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-teal-100 bg-teal-50/60 px-4 py-3">
          <span className="mt-0.5 shrink-0 rounded bg-teal-600 px-1.5 py-0.5 text-micro font-semibold text-white">
            最典型的{story.kind === "leadgen" ? "引流款" : "正价套餐"}
          </span>
          <p className="text-sm leading-6 text-teal-900">
            「{decodeName(story.name)}」{formatInteger(story.qtyPrevious)} → {formatInteger(story.qtyCurrent)} 份、
            销售额 {formatAmount(story.amountPrevious)} → {formatAmount(story.amountCurrent)} 元；
            两期单价都是 {formatAmount(story.pricePrevious)} 元，收入差 {formatSignedInteger(story.amountDelta)} 元里
            销量贡献 {formatSignedInteger(story.qtyEffect)} 元、单价贡献 {formatSignedInteger(story.priceEffect)} 元
            {story.discountRate === null ? "" : `，本期优惠率 ${formatPercent(story.discountRate)}`}。
          </p>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[1140px] border-collapse text-left text-body">
          <caption className="sr-only">
            两期可比的 {rows.length} 个套餐的销量、销售额、单价与量价分解
          </caption>
          <thead>
            <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
              <th rowSpan={2} scope="col" className="whitespace-nowrap py-3 pr-4 text-left align-bottom font-medium">
                套餐
              </th>
              <th rowSpan={2} scope="col" className="whitespace-nowrap px-3 py-3 text-center align-bottom font-medium">
                类型
              </th>
              <th colSpan={2} scope="colgroup" className="whitespace-nowrap border-b border-slate-100 px-2.5 pb-1 pt-3 text-center font-medium">
                销量（份）
              </th>
              <th colSpan={2} scope="colgroup" className="whitespace-nowrap border-b border-slate-100 px-2.5 pb-1 pt-3 text-center font-medium">
                销售额（元）
              </th>
              <th colSpan={2} scope="colgroup" className="whitespace-nowrap border-b border-slate-100 px-2.5 pb-1 pt-3 text-center font-medium">
                单价（元/份）
              </th>
              <th colSpan={2} scope="colgroup" className="whitespace-nowrap border-b border-slate-100 px-2.5 pb-1 pt-3 text-center font-medium">
                影响（元）
              </th>
              <th rowSpan={2} scope="col" className="whitespace-nowrap px-3 py-3 text-right align-bottom font-medium">
                收入差
              </th>
            </tr>
            <tr className={`border-b border-slate-200 ${TYPE.tableHeadNested}`}>
              <th scope="col" className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">2024</th>
              <th scope="col" className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">2025</th>
              <th scope="col" className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">2024</th>
              <th scope="col" className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">2025</th>
              <th scope="col" className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">2024</th>
              <th scope="col" className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">2025</th>
              <th scope="col" className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">销量</th>
              <th scope="col" className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">单价</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 transition-colors last:border-0 hover:bg-teal-50/40"
              >
                <th scope="row" className="py-3.5 pr-4 text-left font-medium text-slate-900">
                  <span className="mr-2 align-middle font-mono text-micro font-normal text-slate-400">
                    {row.id}
                  </span>
                  <span className="align-middle leading-6">{decodeName(row.name)}</span>
                </th>
                <td className="whitespace-nowrap px-2 py-3.5 text-center">
                  <span className={`rounded px-1.5 py-0.5 text-micro font-medium ${KIND_STYLE[row.kind]}`}>
                    {KIND_LABEL[row.kind]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-500">
                  {formatInteger(row.qtyPrevious)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-900">
                  {formatInteger(row.qtyCurrent)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-500">
                  {formatAmount(row.amountPrevious)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-900">
                  {formatAmount(row.amountCurrent)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-500">
                  {formatAmount(row.pricePrevious)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-900">
                  {formatAmount(row.priceCurrent)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-3.5 text-right">
                  <DeltaValue value={row.qtyEffect} text={formatSignedInteger(row.qtyEffect)} />
                </td>
                <td className="whitespace-nowrap px-2.5 py-3.5 text-right">
                  <DeltaValue value={row.priceEffect} text={formatSignedInteger(row.priceEffect)} />
                </td>
                <td className="whitespace-nowrap px-2.5 py-3.5 text-right font-semibold">
                  <DeltaValue value={row.amountDelta} text={formatSignedInteger(row.amountDelta)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <th scope="row" className="py-3.5 pr-4 text-left">合计</th>
              <td className="px-2 py-3.5 text-center text-xs font-normal text-slate-400">—</td>
              <td className="px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-500">
                {formatInteger(rows.reduce((total, row) => total + row.qtyPrevious, 0))}
              </td>
              <td className="px-2.5 py-3.5 text-right font-mono tabular-nums">
                {formatInteger(rows.reduce((total, row) => total + row.qtyCurrent, 0))}
              </td>
              <td className="px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-500">
                {formatAmount(totals.amountPrevious)}
              </td>
              <td className="px-2.5 py-3.5 text-right font-mono tabular-nums">
                {formatAmount(totals.amountCurrent)}
              </td>
              <td className="px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-400">—</td>
              <td className="px-2.5 py-3.5 text-right font-mono tabular-nums text-slate-400">—</td>
              <td className="px-2.5 py-3.5 text-right">
                <DeltaValue value={totals.qtyEffect} text={formatSignedInteger(totals.qtyEffect)} />
              </td>
              <td className="px-2.5 py-3.5 text-right">
                <DeltaValue value={totals.priceEffect} text={formatSignedInteger(totals.priceEffect)} />
              </td>
              <td className="px-2.5 py-3.5 text-right">
                <DeltaValue value={totals.amountDelta} text={formatSignedInteger(totals.amountDelta)} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className={`mt-4 ${TYPE.note}`}>
        金额沿用源表单位「元」，与系列层的「万元」不同源，不合并计算。合计行的单价留空——
        不同套餐单价不可加总。另外 {totalCount - rows.length} 个套餐只在单期出现（新上架或已下架），
        没有可比基期，不参与分解；它们不影响本表的量价结论。
      </p>
    </Panel>
  );
}
