import { formatInteger, formatPercent } from "../../lib/format.js";
import type { FunnelRates, FunnelSummary } from "../../lib/metrics/types.js";
import type { FunnelStoreRow } from "../../lib/channel-view.js";
import { TYPE } from "../../lib/theme.js";
import { Panel } from "../Panel.js";

function countText(value: number | null): string {
  return value === null ? "—" : formatInteger(value);
}

interface Stage {
  readonly key: string;
  readonly label: string;
  readonly value: number | null;
  readonly rate: number | null;
  readonly rateLabel: string | null;
}

function stagesOf(summary: FunnelSummary): readonly Stage[] {
  const { counts, rates } = summary;
  return [
    { key: "exposure", label: "曝光人数", value: counts.exposure, rate: null, rateLabel: null },
    {
      key: "visits",
      label: "访问人数",
      value: counts.visits,
      rate: rates.visitRate,
      rateLabel: "曝光 → 访问",
    },
    {
      key: "payments",
      label: "支付人数",
      value: counts.payments,
      rate: rates.payRate,
      rateLabel: "访问 → 支付",
    },
    {
      key: "consumers",
      label: "消费人数",
      value: counts.consumers,
      rate: rates.consumeRate,
      rateLabel: "支付 → 消费",
    },
  ];
}

const RATE_COLUMNS: readonly { readonly label: string; readonly pick: (rates: FunnelRates) => number | null }[] = [
  { label: "曝光→访问", pick: (rates) => rates.visitRate },
  { label: "访问→支付", pick: (rates) => rates.payRate },
  { label: "支付→消费", pick: (rates) => rates.consumeRate },
  { label: "曝光→消费", pick: (rates) => rates.overallRate },
];

/**
 * 点评渠道漏斗：四级人数 + 三级转化率（汇总口径）与逐店明细。
 *
 * 源表只有 2025-09 一期，没有任何上年同期的曝光 / 转化记录，因此本面板不做同比、
 * 也不参与渠道同比归因；这一点必须在页面上显式标注，避免观众误以为有对比。
 */
export function FunnelPanel({
  summary,
  stores,
  month,
  monthLabel,
  hasComparison,
}: {
  summary: FunnelSummary;
  stores: readonly FunnelStoreRow[];
  /** 期间编号，如 2025-09 */
  month: string;
  monthLabel: string;
  hasComparison: boolean;
}) {
  const stages = stagesOf(summary);
  const storeCount = stores.length;
  const mobileStores = stores.filter((store) => store.counts.payments === null).length;

  return (
    <Panel
      title="点评漏斗 · 曝光 → 消费"
      description={`${storeCount} 家在营门店的线上曝光与转化。汇总口径为「总量之比」：先逐级加总人数，再用汇总人数算转化率。`}
      actions={
        <span className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 ${TYPE.note}`}>
          <span className="font-mono tabular-nums">{month} · {storeCount}</span> 家门店
        </span>
      }
    >
      {hasComparison ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <span className="rounded bg-amber-500 px-1.5 py-0.5 text-micro font-semibold text-white">
            仅 {month}（{monthLabel}）本期
          </span>
          <span>
            漏斗只有这一期的曝光与转化数据，<strong className="font-semibold">没有上年同期，不做同比</strong>，
            也不参与渠道同比归因。它只回答「当期线上流量在哪一级掉得最多」。
          </span>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage) => (
          <div key={stage.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-sm font-medium text-slate-600">{stage.label}</p>
            <p className={`mt-2 whitespace-nowrap ${TYPE.numberMd} text-slate-900`}>
              {countText(stage.value)}
              <span className="ml-1 text-xs font-normal text-slate-500">人</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {stage.rateLabel === null ? (
                <span className="text-slate-400">漏斗起点</span>
              ) : (
                <>
                  {stage.rateLabel}{" "}
                  <span className="font-mono tabular-nums text-slate-800">{formatPercent(stage.rate)}</span>
                </>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm text-teal-900">
        <span className="font-medium">整体 曝光 → 消费</span>
        <span className="font-mono text-lg font-semibold tabular-nums">
          {formatPercent(summary.rates.overallRate)}
        </span>
        <span className="text-teal-800/80">
          三个分环节转化率之积；曝光 {countText(summary.counts.exposure)} 人 → 消费{" "}
          {countText(summary.counts.consumers)} 人
        </span>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-body">
          <caption className="sr-only">{storeCount} 家门店的曝光、访问、支付、消费四级人数与三级转化率</caption>
          <thead>
            <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
              <th scope="col" className="py-3 pr-4 text-left font-medium">门店</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">曝光（人）</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">访问（人）</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">支付（人）</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">消费（人）</th>
              {RATE_COLUMNS.map((column) => (
                <th key={column.label} scope="col" className="px-3 py-3 text-right font-medium">
                  {column.label}（%）
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr
                key={store.storeId}
                className="border-b border-slate-100 transition-colors last:border-0 hover:bg-teal-50/40"
              >
                <th scope="row" className="py-3.5 pr-4 text-left font-medium text-slate-900">
                  {store.name}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {store.region} · {store.storeId}
                  </span>
                </th>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-900">
                  {countText(store.counts.exposure)}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-600">
                  {countText(store.counts.visits)}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-600">
                  {countText(store.counts.payments)}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-900">
                  {countText(store.counts.consumers)}
                </td>
                {RATE_COLUMNS.map((column) => (
                  <td
                    key={column.label}
                    className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-600"
                  >
                    {formatPercent(column.pick(store.rates))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <th scope="row" className="py-3.5 pr-4 text-left">
                汇总
              </th>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">{countText(summary.counts.exposure)}</td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">{countText(summary.counts.visits)}</td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">{countText(summary.counts.payments)}</td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">{countText(summary.counts.consumers)}</td>
              {RATE_COLUMNS.map((column) => (
                <td key={column.label} className="px-3 py-3.5 text-right font-mono tabular-nums">
                  {formatPercent(column.pick(summary.rates))}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className={`mt-4 ${TYPE.note}`}>
        逐店明细按门店编号排序（与源表行序一致）。转化率 = 后一级人数 ÷ 前一级人数，与汇总行同口径。
        {mobileStores > 0 ? `其中 ${mobileStores} 家门店源表缺支付及之后数据（记为「—」），汇总时跳过，不按 0 计。` : ""}
      </p>
    </Panel>
  );
}
