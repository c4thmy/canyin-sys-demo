import type { Metadata } from "next";

import { DeltaValue } from "../../components/DeltaValue.js";
import { PageIntro } from "../../components/PageIntro.js";
import { RevenueHeader } from "../../components/RevenueHeader.js";
import { formatSignedAmount } from "../../lib/format.js";
import { StructureBoard } from "../../components/structure/StructureBoard.js";
import { loadSeed } from "../../lib/seed.js";
import { buildStructureView } from "../../lib/structure-view.js";
import { LAYOUT, TYPE } from "../../lib/theme.js";
import { IncompletePage } from "../../components/IncompletePage.js";
import { analysisPeriods, missingFor } from "../../lib/dataset-status.js";

/** 数据集可在运行时导入 / 切换，页面每次请求重新计算 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "收入结构 · 餐饮经营分析",
  description: "同店/新店、渠道、区域、门店四个维度拆解营业收入与同比变化。",
};

export default function Page() {
  const missing = missingFor(loadSeed(), "structure");
  if (missing.length > 0) {
    return <IncompletePage title="收入结构" active="structure" missing={missing} />;
  }
  const seed = loadSeed();
  const view = buildStructureView();
  const periods = analysisPeriods(seed)?.periods ?? [];

  return (
    <main className="min-h-screen">
      <RevenueHeader
        title="收入结构"
        subtitle={
          <>
            <span>{view.currentLabel}</span>
            <span className="text-slate-500">对比</span>
            <span>{view.previousLabel}</span>
            <span className="text-slate-500">·</span>
            <span>
              {view.counts.total} 家门店 / {view.counts.channels} 个渠道 / {view.counts.regions} 个区域
            </span>
          </>
        }
        active="structure"
        periods={periods}
        activePeriodId={view.currentId}
        previousLabel={view.previousLabel}
        unit={view.unit}
      />

      <div className={LAYOUT.container}>
        <PageIntro>
          <span className="font-medium text-slate-800">先看结构，再看异动：</span>
          营业收入同比{' '}
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {formatSignedAmount(view.split.total.delta)} 万元
          </span>
          ，其中同店{' '}
          <DeltaValue
            value={view.split.sameStore.delta}
            text={`${formatSignedAmount(view.split.sameStore.delta)} 万元`}
            className="font-semibold"
          />
          、新店{' '}
          <DeltaValue
            value={view.split.newStore.delta}
            text={`${formatSignedAmount(view.split.newStore.delta)} 万元`}
            className="font-semibold"
          />
          。同店是经营质量，新店是开店增量——同店为什么涨，去「同店异动」继续拆。
        </PageIntro>

        <StructureBoard view={view} />

        <footer className={`pb-10 pt-2 ${TYPE.note}`}>
          数据来源：{seed.meta.source_file} · 工作表「{[...new Set([seed.storeSheet, seed.channelSheet])].join("」「")}」 · 单位：
          {view.unit}。同店判定沿用门店表的 is_new 标记（新店 {view.counts.newStore} 家）；样例数据仅供演示。
        </footer>
      </div>
    </main>
  );
}
