import type { Metadata } from "next";

import { AcquisitionPanel } from "../../components/channel/AcquisitionPanel.js";
import { FunnelPanel } from "../../components/channel/FunnelPanel.js";
import { NoteCard } from "../../components/NoteCard.js";
import { RevenueHeader } from "../../components/RevenueHeader.js";
import { ChannelPanel } from "../../components/channel/ChannelPanel.js";
import { buildChannelView } from "../../lib/channel-view.js";
import { loadSeed } from "../../lib/seed.js";

export const metadata: Metadata = {
  title: "渠道下钻 · 餐饮经营分析",
  description: "10 个渠道收入同比、新客获取成本与产投比，以及仅本期的点评漏斗。",
};

export default function Page() {
  const seed = loadSeed();
  const view = buildChannelView();
  const periods = [...seed.meta.periods].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <main className="min-h-screen">
      <RevenueHeader
        title="渠道下钻"
        subtitle={
          <>
            <span>{view.currentLabel}</span>
            <span className="text-slate-500">对比</span>
            <span>{view.previousLabel}</span>
            <span className="text-slate-500">·</span>
            <span>{view.channels.length} 个渠道</span>
            <span className="text-slate-500">·</span>
            <span>漏斗仅 {view.funnelMonthLabel}</span>
          </>
        }
        active="channel"
        periods={periods}
        activePeriodId={view.currentId}
        previousLabel={view.previousLabel}
        unit={view.unit}
      />

      <div className="mx-auto max-w-[1440px] space-y-6 px-6 py-8 lg:px-10">
        <section className="rounded-2xl border border-slate-200/70 bg-white/60 px-5 py-4 text-[15px] leading-7 text-slate-600">
          <span className="font-medium text-slate-800">这一页只看两件事：</span>
          渠道收入涨在哪、新客投放还值不值得加钱。{view.summary}
        </section>

        <ChannelPanel
          rows={view.channels}
          unit={view.unit}
          totalCurrent={view.channelTotal.current}
          totalPrevious={view.channelTotal.previous}
          storeTotal={view.storeTotal}
          defaultSortKey="delta"
          title="渠道收入同比"
          description={`${view.channels.length} 个渠道 · 默认按同比差额降序 · 可点击「本期收入」或「同比差额」表头切换排序 · 条形图与表格顺序同步`}
        />

        <AcquisitionPanel rows={view.acquisition} unit={view.unit} />

        <FunnelPanel
          summary={view.funnel}
          stores={view.funnelStores}
          month={view.funnelMonth}
          monthLabel={view.funnelMonthLabel}
          hasComparison={view.funnelHasComparison}
        />

        <NoteCard title="口径说明">
          <p>
            <span className="font-medium text-slate-800">为什么不做渠道同比漏斗。</span>
            漏斗源表（工作表「{seed.funnelSheet}」）只有 {view.funnelMonthLabel} 一期的曝光、访问、支付、
            消费人数，没有上年同期的任何记录。单期数据既做不了同比，也算不出渠道 ROI 的同比变化，
            所以本页的「对比」只放在渠道收入上（两期都有数），漏斗退为当期结构诊断，并在面板上
            显式标注「仅本期」。
          </p>
          <p>
            <span className="font-medium text-slate-800">产投比是什么。</span>
            产投比 = 毛利额 ÷ 投入成本 = （新客量 × 客单价 × 毛利率）÷（新客量 × 新客成本）=
            客单价 × 毛利率 ÷ 新客成本，衡量每 1 元获客成本能换回多少元毛利。目标 ROI 来自表8 的预算目标。
            它与投放规模无关——新客量放大一倍，毛利额与投入同比例放大，产投比不变；所以「刚好达标」
            说的是这条链路本身没有余量，放大规模只会同比例放大投入，不会改善效率。
          </p>
          <p>
            <span className="font-medium text-slate-800">数据来源与命名。</span>
            渠道收入取自渠道表（「美团大众」「美团外卖」等 {view.channels.length} 个渠道），
            新客获取取自表8（「大众点评」「外卖」两个渠道）。两处渠道名在源表中本来就不一致，
            本页按源表保留、不强行合并；表8 是预算与目标值，不是当期实际值。
          </p>
        </NoteCard>

        <footer className="pb-10 pt-2 text-sm leading-6 text-slate-500">
          数据来源：{seed.meta.source_file} · 工作表「
          {[...new Set([seed.channelSheet, seed.acquisitionSheet, seed.funnelSheet])].join("」「")}」 ·
          单位：{view.unit}。渠道收入为两期真数，漏斗仅覆盖 {view.funnelMonth}、产投比为预算目标值；
          样例数据仅供演示。
        </footer>
      </div>
    </main>
  );
}
