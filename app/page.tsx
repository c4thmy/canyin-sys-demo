import { MetricCard } from "./components/MetricCard.js";
import { PeriodSwitch } from "./components/PeriodSwitch.js";
import { ProfitBridgeChart } from "./components/ProfitBridgeChart.js";
import { formatAmount, formatSignedAmount } from "./lib/format.js";
import { buildOverview } from "./lib/overview.js";

export default function Page() {
  const view = buildOverview();
  const profitTone =
    view.profitDelta >= 0
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <main className="min-h-screen">
      <header className="hero-panel">
        <div className="mx-auto max-w-[1440px] px-6 py-10 lg:px-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-teal-300">
                Revenue Analysis · 收入分析
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white lg:text-5xl">
                经营总览
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-lg text-slate-300">
                <span>{view.currentLabel}</span>
                <span className="text-slate-500">对比</span>
                <span>{view.previousLabel}</span>
                <span className="rounded-full border border-white/15 px-3 py-1 text-sm text-slate-300">
                  单位：{view.unit}
                </span>
              </div>
            </div>

            <div className="lg:text-right">
              <p className="mb-2 text-xs tracking-wide text-slate-400">期间（固定两期对比）</p>
              <PeriodSwitch periods={view.periods} activeId={view.activePeriodId} />
              <p className="mt-2 text-xs text-slate-500">上年同期：{view.previousLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] space-y-6 px-6 py-8 lg:px-10">
        <section aria-label="关键指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {view.cards.map((card) => (
            <MetricCard key={card.key} card={card} />
          ))}
        </section>

        <section className="card-surface rounded-2xl p-6 lg:p-7" aria-labelledby="profit-bridge-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="profit-bridge-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                利润桥 · 营业利润同比
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                从 {formatAmount(view.previousProfit)} 万元到 {formatAmount(view.currentProfit)} 万元 ·
                变动成本看费率变动，固定成本看绝对额变动
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <i className="h-2.5 w-2.5 rounded-sm bg-[#0f9d76]" />
                上升
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <i className="h-2.5 w-2.5 rounded-sm bg-[#d64545]" />
                下降
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <i className="h-2.5 w-2.5 rounded-sm bg-[#2563eb]" />
                合计
              </span>
              <span className={`rounded-lg border px-3 py-1.5 font-mono text-base font-semibold tabular-nums ${profitTone}`}>
                {formatSignedAmount(view.profitDelta)} 万元
              </span>
            </div>
          </div>

          <div className="mt-6">
            <ProfitBridgeChart nodes={view.bridge} />
          </div>
        </section>

        <section className="card-surface relative overflow-hidden rounded-2xl p-6 lg:p-7" aria-labelledby="summary-title">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-teal-400 to-blue-500" />
          <h2 id="summary-title" className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            一句话小结
          </h2>
          <p className="mt-3 text-xl leading-9 text-slate-800 lg:text-[1.375rem]">{view.summary}</p>
          <p className="mt-4 text-sm text-slate-500">
            口径：营业利润 = 营业收入 − 变动成本 − 固定成本；变动成本按费率变动归因，固定成本按绝对额变动归因。
          </p>
        </section>

        <footer className="pb-10 pt-2 text-sm text-slate-500">
          数据来源：{view.sourceFile} · 工作表「{view.pnlSheet}」 · 单位：{view.unit}。样例数据仅供演示。
        </footer>
      </div>
    </main>
  );
}
