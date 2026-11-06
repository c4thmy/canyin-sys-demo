import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MetricCard } from "../../../components/MetricCard.js";
import { PeerComparisonPanel } from "../../../components/PeerComparisonPanel.js";
import { RevenueHeader } from "../../../components/RevenueHeader.js";
import { StoreEffectPanel } from "../../../components/StoreEffectPanel.js";
import { formatAmount, formatSignedAmount } from "../../../lib/format.js";
import { loadSeed } from "../../../lib/seed.js";
import { buildStoreDetailView } from "../../../lib/store-view.js";

export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return loadSeed().stores.map((store) => ({ id: store.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const view = buildStoreDetailView(id);
  if (!view) {
    return { title: "门店详情 · 餐饮经营分析" };
  }
  return {
    title: `${view.store.name} · 门店详情 · 餐饮经营分析`,
    description: `${view.store.region}${view.store.name}的门店客流、客单价、收入同比与同店横向对比。`,
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = buildStoreDetailView(id);
  if (!view) {
    notFound();
  }
  const seed = loadSeed();
  const periods = [...seed.meta.periods].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <main className="min-h-screen">
      <RevenueHeader
        title={view.store.name}
        back={{ href: "/revenue/same-store", label: "返回同店异动" }}
        subtitle={
          <>
            <span className="rounded-full border border-teal-300/50 bg-teal-400/10 px-3 py-0.5 text-base font-medium text-teal-200">
              {view.store.isNew ? "新店" : "同店"}
            </span>
            <span>{view.store.region}</span>
            <span className="text-slate-500">·</span>
            <span>
              {view.currentLabel} 对比 {view.previousLabel}
            </span>
            <span className="text-slate-500">·</span>
            <span>
              {view.store.isNew
                ? `本期收入 ${formatAmount(view.revenueCurrent)} 万元`
                : `本期收入差 ${formatSignedAmount(view.effects.revenueDelta)} 万元`}
            </span>
          </>
        }
        active="same-store"
        periods={periods}
        activePeriodId={view.currentId}
        previousLabel={view.previousLabel}
        unit={view.unit}
      />

      <div className="mx-auto max-w-[1440px] space-y-6 px-6 py-8 lg:px-10">
        <section aria-label="门店关键指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {view.cards.map((card) => (
            <MetricCard key={card.key} card={card} />
          ))}
        </section>

        <StoreEffectPanel view={view} />

        <PeerComparisonPanel view={view} />

        <footer className="pb-10 pt-2 text-sm leading-6 text-slate-500">
          数据来源：{seed.meta.source_file} · 工作表「{seed.storeSheet}」「{seed.trafficSheet}」 · 单位：
          {view.unit}。收入取门店表，客流与客单价取表6；新店无上年同期，不做同比与拆解。样例数据仅供演示。
        </footer>
      </div>
    </main>
  );
}
