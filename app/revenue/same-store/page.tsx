import type { Metadata } from "next";

import { MetricCard } from "../../components/MetricCard.js";
import { RevenueHeader } from "../../components/RevenueHeader.js";
import { SameStoreDecomposition } from "../../components/SameStoreDecomposition.js";
import { StoreTrafficTable } from "../../components/StoreTrafficTable.js";
import { TimeSlotPanel } from "../../components/TimeSlotPanel.js";
import { formatSignedAmount } from "../../lib/format.js";
import { buildSameStoreView } from "../../lib/same-store-view.js";
import { loadSeed } from "../../lib/seed.js";
import { LAYOUT, TYPE } from "../../lib/theme.js";
import { IncompletePage } from "../../components/IncompletePage.js";
import { analysisPeriods, missingFor } from "../../lib/dataset-status.js";

/** 数据集可在运行时导入 / 切换，页面每次请求重新计算 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "同店异动 · 餐饮经营分析",
  description: "把同店收入变化拆成客流与客单价两个因素，并下钻到同店与分时段客流。",
};

export default function Page() {
  const missing = missingFor(loadSeed(), "same-store");
  if (missing.length > 0) {
    return <IncompletePage title="同店异动" active="same-store" missing={missing} />;
  }
  const seed = loadSeed();
  const view = buildSameStoreView();
  const periods = analysisPeriods(seed)?.periods ?? [];

  return (
    <main className="min-h-screen">
      <RevenueHeader
        title="同店异动"
        subtitle={
          <>
            <span>{view.currentLabel}</span>
            <span className="text-slate-500">对比</span>
            <span>{view.previousLabel}</span>
            <span className="text-slate-500">·</span>
            <span>
              同店 {view.summary.sameStoreCount} 家 · 收入 {formatSignedAmount(view.summary.revenueDelta)} 万元
            </span>
          </>
        }
        active="same-store"
        periods={periods}
        activePeriodId={view.currentId}
        previousLabel={view.previousLabel}
        unit={view.unit}
      />

      <div className={LAYOUT.container}>
        <section aria-label="同店关键指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {view.cards.map((card) => (
            <MetricCard key={card.key} card={card} />
          ))}
        </section>

        <SameStoreDecomposition
          effects={view.effects}
          summary={view.summary}
          unit={view.unit}
        />

        <StoreTrafficTable
          rows={view.rows}
          unit={view.unit}
          averageTicketPrevious={view.summary.ticketPrevious}
          averageTicketCurrent={view.summary.ticketCurrent}
        />

        <TimeSlotPanel groups={view.timeSlots} insight={view.timeInsight} />

        <footer className={`pb-10 pt-2 ${TYPE.note}`}>
          数据来源：{seed.meta.source_file} · 工作表「{seed.trafficSheet}」「{seed.timeSlotSheet}」 · 单位：
          {view.unit}。客流与客单价取表6，收入取门店表；两者的取整差额已在拆解卡与明细表注明。样例数据仅供演示。
        </footer>
      </div>
    </main>
  );
}
