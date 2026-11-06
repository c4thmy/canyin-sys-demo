import { formatAmount, formatPercent, formatSignedAmount, formatSignedPercent } from "../../lib/format.js";
import type { StructureSplitCard, StructureView } from "../../lib/structure-view.js";
import { DeltaValue } from "../DeltaValue.js";
import { Panel } from "../Panel.js";

function SplitCard({ card, tone }: { card: StructureSplitCard; tone: "same" | "new" }) {
  const accent =
    tone === "same"
      ? "from-teal-500/10 to-emerald-500/5 border-teal-100"
      : "from-blue-500/10 to-indigo-500/5 border-blue-100";
  const dot = tone === "same" ? "bg-teal-500" : "bg-blue-500";

  return (
    <article className={`rounded-2xl border bg-gradient-to-br p-5 lg:p-6 ${accent}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <i className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-900">{card.label}</h3>
        </div>
        <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs text-slate-500">
          {card.storeCount} 家门店
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide text-slate-500">本期收入（万元）</p>
          <p className="mt-1 font-mono text-4xl font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
            {formatAmount(card.current)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-wide text-slate-500">占全部门店</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-800 tabular-nums">
            {formatPercent(card.share)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-900/5 pt-4">
        <div>
          <p className="text-xs text-slate-500">同比差额</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            <DeltaValue value={card.delta} text={`${formatSignedAmount(card.delta)} 万`} />
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">同比增减率</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {card.deltaRate === null ? (
              <span className="text-blue-600">新增</span>
            ) : (
              <DeltaValue value={card.delta} text={formatSignedPercent(card.deltaRate)} />
            )}
          </p>
        </div>
      </div>
    </article>
  );
}

export function SameNewPanel({ view }: { view: StructureView }) {
  const { sameStore, newStore, total } = view.split;
  const sameWidth = Math.max(0, sameStore.share * 100);

  return (
    <Panel
      title="同店 / 新店拆分"
      description={`营业收入的增量先分成两段：同店经营增量 ${formatSignedAmount(sameStore.delta)} 万元，新店开店增量 ${formatSignedAmount(newStore.delta)} 万元。`}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SplitCard card={sameStore} tone="same" />
        <SplitCard card={newStore} tone="new" />
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-sm font-medium text-slate-600">本期收入构成（100% 堆叠）</h3>
          <span className="font-mono text-sm text-slate-500 tabular-nums">
            合计 {formatAmount(total.current)} 万元
          </span>
        </div>

        <div
          className="mt-3 flex h-11 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
          role="img"
          aria-label={`同店占比 ${formatPercent(sameStore.share)}，新店占比 ${formatPercent(newStore.share)}`}
        >
          <div
            className="flex items-center justify-start bg-gradient-to-r from-teal-600 to-emerald-500 px-4 text-sm font-semibold text-white"
            style={{ width: `${sameWidth}%` }}
          >
            同店 {formatPercent(sameStore.share)}
          </div>
          <div className="flex flex-1 items-center justify-end bg-gradient-to-r from-blue-500 to-indigo-500 px-4 text-sm font-semibold text-white">
            新店 {formatPercent(newStore.share)}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-sm bg-teal-600" aria-hidden="true" />
            同店 · {sameStore.storeCount} 家可比门店
          </span>
          <span className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-sm bg-blue-500" aria-hidden="true" />
            新店 · {newStore.storeCount} 家新开门店
          </span>
          <span className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-sm bg-slate-400" aria-hidden="true" />
            全部门店 {total.storeCount} 家
          </span>
        </div>
      </div>
    </Panel>
  );
}
