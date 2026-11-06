import type { Metadata } from "next";

import { NoteCard } from "../../components/NoteCard.js";
import { PageIntro } from "../../components/PageIntro.js";
import { RevenueHeader } from "../../components/RevenueHeader.js";
import { BundleDecompositionPanel } from "../../components/product/BundleDecompositionPanel.js";
import { CategoryMixPanel } from "../../components/product/CategoryMixPanel.js";
import { formatPercent, formatSignedInteger } from "../../lib/format.js";
import { loadSeed } from "../../lib/seed.js";
import { buildProductView } from "../../lib/product-view.js";
import { LAYOUT, TYPE } from "../../lib/theme.js";

export const metadata: Metadata = {
  title: "产品下钻 · 餐饮经营分析",
  description: "8 个系列的销量结构，以及 11 个两期可比套餐的真实量价分解。",
};

export default function Page() {
  const seed = loadSeed();
  const view = buildProductView();
  const periods = [...seed.meta.periods].sort((a, b) => a.id.localeCompare(b.id));
  const leadgen = view.kindSummary.leadgen;
  const regular = view.kindSummary.regular;

  return (
    <main className="min-h-screen">
      <RevenueHeader
        title="产品下钻"
        subtitle={
          <>
            <span>{view.currentLabel}</span>
            <span className="text-slate-500">对比</span>
            <span>{view.previousLabel}</span>
            <span className="text-slate-500">·</span>
            <span>{view.categories.length} 个系列</span>
            <span className="text-slate-500">·</span>
            <span>
              套餐 {view.bundles.length} / {view.bundleTotalCount} 可比
            </span>
          </>
        }
        active="product"
        periods={periods}
        activePeriodId={view.currentId}
        previousLabel={view.previousLabel}
        unit={view.unit}
      />

      <div className={LAYOUT.container}>
        <PageIntro>
          <span className="font-medium text-slate-800">系列看结构，套餐看量价：</span>
          系列层的 2024 单价在源表缺失、2024 收入是按本期单价反推的，在这一层做销量 × 单价分解，
          每个系列都会得到同一个假涨幅。所以系列层只讲销量结构，真正的量价分解放在套餐层——
          套餐的销量与销售额两期都是源表真数，单价可以由「销售额 ÷ 销量」实算。
        </PageIntro>

        <CategoryMixPanel
          rows={view.categories}
          focus={view.categoryFocus}
          unit={view.unit}
          total={view.categoryTotal}
        />

        <BundleDecompositionPanel
          rows={view.bundles}
          totals={view.bundleTotals}
          totalCount={view.bundleTotalCount}
        />

        <section className="card-surface relative overflow-hidden rounded-2xl p-6 lg:p-7" aria-labelledby="conclusion-title">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-teal-400 to-blue-500" />
          <h2 id="conclusion-title" className={TYPE.calloutTitle}>一行结论</h2>
          <p className={`mt-3 ${TYPE.calloutBody}`}>{view.insights.conclusion}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
              <p className="text-sm font-medium text-amber-900">引流款 · {leadgen.count} 个</p>
              <p className={`mt-1 ${TYPE.numberSm} text-amber-900`}>
                {formatSignedInteger(leadgen.amountDelta)}
                <span className="ml-1 text-xs font-normal">元</span>
              </p>
              <p className="mt-0.5 text-xs text-amber-800/80">占套餐收入差 {formatPercent(leadgen.share)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-sm font-medium text-slate-700">正价套餐 · {regular.count} 个</p>
              <p className={`mt-1 ${TYPE.numberSm} text-slate-900`}>
                {formatSignedInteger(regular.amountDelta)}
                <span className="ml-1 text-xs font-normal">元</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">占套餐收入差 {formatPercent(regular.share)}</p>
            </div>
          </div>
        </section>

        <NoteCard title="口径说明">
          <p>
            <span className="font-medium text-slate-800">系列层为什么不做量价分解。</span>
            源表只给了系列的 2025 平均单价，2024 单价缺失；2024 收入是按「2024 销量 × 2025 单价」
            推算后再等比校准到门店口径的。若在系列层套用销量 × 单价分解，单价差恒为 0、
            收入差全部落到销量上，且每个系列的「单价影响」都会是同一个假值。所以本页系列层只给销量结构、
            本期单价与本期收入占比；2024 收入不出现在页面上，也不参与任何同比计算。
          </p>
          <p>
            <span className="font-medium text-slate-800">套餐层为什么可以分解。</span>
            表4 的 31 个线上套餐，销量与销售额两期都是原表真数，单价 = 销售额 ÷ 销量 可以实算。
            其中 11 个套餐两期都有数据，按连环替代法（先量后价）分解：
            销量影响 =（本期销量 − 上期销量）× 上期单价；单价影响 = 本期销量 ×（本期单价 − 上期单价）。两项之和恒等于收入差。
          </p>
          <p>
            <span className="font-medium text-slate-800">本次分解的实际结论。</span>
            11 个可比套餐的收入差合计 {formatSignedInteger(view.bundleTotals.amountDelta)} 元，其中销量影响{' '}
            {formatSignedInteger(view.bundleTotals.qtyEffect)} 元、单价影响{' '}
            {formatSignedInteger(view.bundleTotals.priceEffect)} 元——增量几乎全部来自卖出更多份数，
            单价几乎没有变化。也就是说这批线上套餐是「以量换收入」，靠的是活动款放量，不是提价。
            另外 {view.bundleTotalCount - view.bundles.length} 个只在单期出现的套餐（新上架 / 已下架）
            不参与分解，也没有可比基期。
          </p>
        </NoteCard>

        <footer className={`pb-10 pt-2 ${TYPE.note}`}>
          数据来源：{seed.meta.source_file} · 工作表「
          {[...new Set([seed.categorySheet, seed.bundleSheet])].join("」「")}」 · 单位：系列与收入为
          {view.unit}，套餐金额与量价影响为元。2025 收入为源表值，2024 收入为推算值；样例数据仅供演示。
        </footer>
      </div>
    </main>
  );
}
