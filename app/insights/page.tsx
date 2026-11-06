import type { Metadata } from "next";

import { ActionCard } from "../components/insights/ActionCard.js";
import { InsightCard } from "../components/insights/InsightCard.js";
import { OriginPanel } from "../components/insights/OriginPanel.js";
import { NoteCard } from "../components/NoteCard.js";
import { Panel } from "../components/Panel.js";
import { RevenueHeader } from "../components/RevenueHeader.js";
import {
  formatAmount,
  formatSignedAmount,
  formatSignedPercent,
} from "../lib/format.js";
import { buildInsightsView } from "../lib/insights-view.js";
import { LAYOUT, TYPE } from "../lib/theme.js";
import type { InsightSeverity } from "../lib/metrics/index.js";

export const metadata: Metadata = {
  title: "结论与计划 · 餐饮经营分析",
  description:
    "基于本期数据自动生成收入异动原点、七条结构化结论与三条可追溯的行动建议。",
};

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  positive: 2,
};

export default function Page() {
  const view = buildInsightsView();
  const { facts } = view;
  const insights = [...view.insights].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  return (
    <main className="min-h-screen">
      <RevenueHeader
        title="结论与计划"
        subtitle={
          <>
            <span>{view.currentLabel}</span>
            <span className="text-slate-500">对比</span>
            <span>{view.previousLabel}</span>
            <span className="text-slate-500">·</span>
            <span>
              {facts.storeCounts.total} 家门店 · {view.counts.total} 条结论 ·{" "}
              {view.counts.actions} 条行动
            </span>
          </>
        }
        active="insights"
        periods={view.periods}
        activePeriodId={view.currentId}
        previousLabel={view.previousLabel}
        unit={view.unit}
      />

      <div className={LAYOUT.container}>
        <section
          className={`${LAYOUT.card} ${LAYOUT.cardPadding} relative overflow-hidden`}
          aria-labelledby="headline-title"
        >
          <div
            className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-teal-400 via-cyan-400 to-blue-500"
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={TYPE.calloutTitle}>本期一句话总纲</p>
              <h2 id="headline-title" className="mt-1 text-base text-slate-500">
                本期经营结果 + 最核心的一个判断
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                严重 <span className="font-mono font-semibold text-down">{view.counts.critical}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                关注 <span className="font-mono font-semibold text-amber-600">{view.counts.warning}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                正向 <span className="font-mono font-semibold text-up">{view.counts.positive}</span>
              </span>
            </div>
          </div>

          <p className={`mt-4 max-w-5xl ${TYPE.heroStatement}`}>{view.headline}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs text-slate-500">营业收入 · {view.currentLabel}</p>
              <p className={`mt-1 ${TYPE.numberMd} text-slate-900`}>
                {formatAmount(facts.revenue.current)}
                <span className="ml-1 text-sm font-normal text-slate-500">{view.unit}</span>
              </p>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                同比 {formatSignedAmount(facts.revenue.delta)} {view.unit}（
                {formatSignedPercent(facts.revenue.deltaRate)}）
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs text-slate-500">营业利润 · {view.currentLabel}</p>
              <p className={`mt-1 ${TYPE.numberMd} text-slate-900`}>
                {formatAmount(facts.profit.current)}
                <span className="ml-1 text-sm font-normal text-slate-500">{view.unit}</span>
              </p>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                同比 {formatSignedAmount(facts.profit.delta)} {view.unit}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs text-slate-500">同店收入同比</p>
              <p className={`mt-1 ${TYPE.numberMd} text-slate-900`}>
                {formatSignedAmount(facts.sameStore.revenueDelta)}
                <span className="ml-1 text-sm font-normal text-slate-500">{view.unit}</span>
              </p>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                客流影响 {formatSignedAmount(facts.sameStore.trafficEffect)} {view.unit} · 客单价影响{" "}
                {formatSignedAmount(facts.sameStore.ticketEffect)} {view.unit}
              </p>
            </div>
          </div>
        </section>

        <OriginPanel
          origins={view.origins}
          totalDelta={facts.revenue.delta}
          originGap={view.originGap}
          unit={view.unit}
        />

        <section aria-labelledby="insight-list-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="insight-list-title"
                className={TYPE.sectionTitle}
              >
                结论卡片
              </h2>
              <p className={`mt-1 ${TYPE.note}`}>
                按严重度排序：严重 → 关注 → 正向。卡片里的数字可点击，跳到产生该数字的下钻页。
              </p>
            </div>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
              {view.insights.length} 条结论 · 数据口径见页尾
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {insights.map((insight, index) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                wide={insights.length % 2 === 1 && index === insights.length - 1}
              />
            ))}
          </div>
        </section>

        <Panel
          title={`行动建议 · ${view.actions.length} 条`}
          description="按结论严重度取前 3 条；每条行动都能追溯到触发它的结论 id。责任部门为建议，需在月度经营会上确认。"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {view.actions.map((action, index) => (
              <ActionCard key={action.id} action={action} index={index} />
            ))}
          </div>
        </Panel>

        <NoteCard title="数据口径与来源">
          <p>
            <span className="font-medium text-slate-800">真实数据。</span>
            营业收入与全部成本项（利润表 9 项）、{facts.storeCounts.total} 家门店收入、10 个渠道收入、
            {facts.storeCounts.sameStore} 家同店客流与客单价（表6）、31 个套餐的销量 / 销售额 / 优惠（表4）、
            2 个渠道的新客预算与目标 ROI（表8）。
          </p>
          <p>
            <span className="font-medium text-slate-800">推算数据。</span>
            2025 食材成本 267.00 万元（成本率 26.7% × 利润表收入 1,000.00 万元）；8 个系列 2024 收入
            （2024 销量 × 2025 单价，再等比缩放到门店口径 {formatAmount(facts.sameNew.total.previous)} 万元）；
            表8 的收入、毛利额、投入成本、产投比由源表原始字段重算。系列层 2024 收入不参与「产品结构」结论——
            该结论只用两期销量与本期收入。
          </p>
          <p>
            <span className="font-medium text-slate-800">计算规则。</span>
            同店 = {facts.storeCounts.sameStore} 家非新店，新店 = {facts.storeCounts.newStore} 家
            （2024 年无收入）；同店拆解与套餐量价都用连环替代法、先量后价；渠道集中度按本期收入占比；
            引流款按套餐名含「秒杀 / 超值 / 福利 / 活动」判定；加权折扣率 = Σ 优惠额 ÷ Σ 销售额。
          </p>
          <p>
            <span className="font-medium text-slate-800">已知尾差。</span>
            同店客流影响 {formatSignedAmount(facts.sameStore.trafficEffect)} 万元 + 客单价影响{" "}
            {formatSignedAmount(facts.sameStore.ticketEffect)} 万元 ={" "}
            {formatSignedAmount(facts.sameStore.effectTotal)} 万元，与同店收入同比{" "}
            {formatSignedAmount(facts.sameStore.revenueDelta)} 万元相差{" "}
            {formatAmount(Math.abs(facts.sameStore.reconciliationGap))} 万元，来自 2024 年客流在源表中按整数取整；
            门店口径收入 {formatAmount(facts.revenue.current)} 万元与利润表收入 1,000.00 万元相差 0.23 万元，
            为源表四舍五入。渠道集中度按渠道口径（合计 1,000.00 万元）计算，与门店口径同样存在 0.23 万元尾差。
          </p>
          <p className="text-sm text-slate-400">
            规则实现：<span className="font-mono">app/lib/metrics/insights.ts</span> · 阈值常量{" "}
            <span className="font-mono">INSIGHT_THRESHOLDS</span> · 共 7 条规则、{view.counts.actions} 条行动。
          </p>
        </NoteCard>

        <footer className={`pb-10 pt-2 ${TYPE.note}`}>
          数据来源：{view.sourceFile} · 工作表「{view.sheets.join("」「")}」 · 单位：{view.unit}。
          结论由七条规则自动生成；样例数据仅供演示。
        </footer>
      </div>
    </main>
  );
}
