import { MetricCard } from "./components/MetricCard.js";
import { MetricInfo } from "./components/MetricInfo.js";
import { ProfitBridgeChart } from "./components/ProfitBridgeChart.js";
import { RevenueHeader } from "./components/RevenueHeader.js";
import { formatAmount, formatPercent, formatSignedAmount } from "./lib/format.js";
import { buildOverview } from "./lib/overview.js";
import { LAYOUT, TYPE } from "./lib/theme.js";
import { IncompletePage } from "./components/IncompletePage.js";
import { analysisPeriods, missingFor } from "./lib/dataset-status.js";
import { loadSeed } from "./lib/seed.js";

/** 数据集可在运行时导入 / 切换，页面每次请求重新计算 */
export const dynamic = "force-dynamic";

export default function Page() {
  const missing = missingFor(loadSeed(), "overview");
  if (missing.length > 0) {
    return <IncompletePage title="经营总览" active="overview" missing={missing} />;
  }
  const view = buildOverview();
  const profitTone =
    view.profitDelta >= 0
      ? "border-up/30 bg-up-soft text-up"
      : "border-down/30 bg-down-soft text-down";

  return (
    <main className="min-h-screen">
      <RevenueHeader
        title="经营总览"
        subtitle={
          <>
            <span>{view.currentLabel}</span>
            <span className="text-slate-500">对比</span>
            <span>{view.previousLabel}</span>
            <span className="text-slate-500">·</span>
            <span>收入、利润与利润桥</span>
          </>
        }
        active="overview"
        periods={view.periods}
        activePeriodId={view.activePeriodId}
        previousLabel={view.previousLabel}
        unit={view.unit}
      />

      <div className={LAYOUT.container}>
        <section aria-label="关键指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {view.cards.map((card) => (
            <MetricCard key={card.key} card={card} />
          ))}
        </section>

        <section
          className={`${LAYOUT.card} ${LAYOUT.cardPadding}`}
          aria-labelledby="profit-bridge-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="profit-bridge-title" className={TYPE.sectionTitle}>
                利润桥 · 营业利润同比
              </h2>
              <p className={`mt-1 ${TYPE.note}`}>
                从 {formatAmount(view.previousProfit)} 万元到 {formatAmount(view.currentProfit)} 万元 ·
                变动成本看费率变动，固定成本看绝对额变动
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                <span>边际贡献率（上年同期）</span>
                <span className="font-mono font-semibold text-slate-800 tabular-nums">
                  {formatPercent(view.contributionMarginPrevious)}
                </span>
                <MetricInfo metric="contributionMargin" />
                <span className="text-slate-400">· 收入规模的利润影响按此系数折算</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <i className="h-2.5 w-2.5 rounded-sm bg-up" aria-hidden="true" />
                上升
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <i className="h-2.5 w-2.5 rounded-sm bg-down" aria-hidden="true" />
                下降
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <i className="h-2.5 w-2.5 rounded-sm bg-total" aria-hidden="true" />
                合计
              </span>
              <span className={`rounded-lg border px-3 py-1.5 ${TYPE.numberSm} ${profitTone}`}>
                {formatSignedAmount(view.profitDelta)} 万元
              </span>
            </div>
          </div>

          <div className="mt-6">
            <ProfitBridgeChart nodes={view.bridge} />
          </div>
        </section>

        <section
          className={`${LAYOUT.card} ${LAYOUT.cardPadding} relative overflow-hidden`}
          aria-labelledby="summary-title"
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-teal-400 to-blue-500" />
          <h2 id="summary-title" className={TYPE.calloutTitle}>
            一句话小结
          </h2>
          <p className={`mt-3 ${TYPE.calloutBody}`}>{view.summary}</p>
          <p className={`mt-4 ${TYPE.note}`}>
            口径：营业利润 = 营业收入 − 变动成本 − 固定成本；变动成本按费率变动归因，固定成本按绝对额变动归因。
            本页营业收入取<strong className="font-medium">利润表口径</strong>；收入结构页按
            <strong className="font-medium">门店汇总口径</strong>，两者可能相差零点几万元，来自源表四舍五入。
          </p>
        </section>

        <footer className={`pb-10 pt-2 ${TYPE.note}`}>
          数据来源：{view.sourceFile} · 工作表「{view.pnlSheet}」 · 单位：{view.unit}。样例数据仅供演示。
        </footer>
      </div>
    </main>
  );
}
