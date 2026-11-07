import type { Metadata } from "next";
import Link from "next/link";

import { CompletenessMatrix } from "../components/dashboard/CompletenessMatrix.js";
import { TrendChart } from "../components/dashboard/TrendChart.js";
import { NewBadge } from "../components/NewBadge.js";
import { Panel } from "../components/Panel.js";
import { RevenueHeader } from "../components/RevenueHeader.js";
import { buildDashboardView, type KpiView } from "../lib/dashboard-view.js";
import { formatAmount, formatPercent, formatSignedPercent } from "../lib/format.js";
import { LAYOUT, TYPE } from "../lib/theme.js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "数据看板 · 餐饮经营分析",
  description: "收入、客流、客单价、营业利润的多期趋势、同比环比与门店排行。",
};

function toneOf(rate: number | null): string {
  if (rate === null || rate === 0) {
    return "text-slate-500";
  }
  return rate > 0 ? "text-up" : "text-down";
}

function KpiCard({ kpi }: { kpi: KpiView }) {
  return (
    <article className={`${LAYOUT.card} p-6`}>
      <h3 className={TYPE.cardLabel}>{kpi.label}</h3>
      <div className="mt-4 flex items-baseline gap-2 whitespace-nowrap">
        <span className={`${TYPE.numberHero} text-slate-900`}>{kpi.value}</span>
        <span className="text-base text-slate-500">{kpi.unit}</span>
      </div>
      <dl className="mt-3 flex gap-6 text-sm">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-slate-500">同比</dt>
          <dd className={`${TYPE.numberSm} ${toneOf(kpi.yoy)}`}>{kpi.yoyText}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-slate-500">环比</dt>
          <dd className={`${TYPE.numberSm} ${toneOf(kpi.mom)}`}>{kpi.momText}</dd>
        </div>
      </dl>
      {kpi.note ? <p className="mt-1 text-sm text-slate-400">{kpi.note}</p> : null}
    </article>
  );
}

export default function Page() {
  const view = buildDashboardView();
  const single = view.periods.length <= 1;

  return (
    <main className="min-h-screen">
      <RevenueHeader
        title="数据看板"
        eyebrow="Dashboard · 数据看板"
        subtitle={
          <>
            <span>{view.current ? `本期 ${view.current.label}` : "暂无数据"}</span>
            <span className="text-slate-500">·</span>
            <span>数据集内共 {view.periods.length} 个期间</span>
          </>
        }
        active="dashboard"
        periods={view.headerPeriods}
        activePeriodId={view.current?.id ?? ""}
        previousLabel={view.previous?.label ?? "—"}
        unit={view.unit}
      />

      <div className={LAYOUT.container}>
        <section aria-label="关键指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {view.kpis.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </section>

        <Panel
          title="多期趋势"
          description={
            single
              ? "当前数据集只有一个期间，趋势图显示单点；导入更多月份后可看到走势。"
              : "按月展示，缺数据的月份断开。"
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            {view.kpis.map((kpi) => (
              <div key={kpi.key} className={`${LAYOUT.inset} p-4`}>
                <p className={TYPE.caption}>
                  {kpi.label}（{kpi.unit}）
                </p>
                <TrendChart label={kpi.label} unit={kpi.unit} points={kpi.trend} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="门店收入排行"
          description={view.current ? `${view.current.label} · 按本期收入降序，新店不计同比` : "暂无数据"}
        >
          {view.stores.length === 0 ? (
            <p className={TYPE.note}>当前数据集没有门店收入，请先导入「门店收入」模板。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
                    <th scope="col" className="py-2 pr-3 font-medium">排名</th>
                    <th scope="col" className="py-2 pr-3 font-medium">门店</th>
                    <th scope="col" className="py-2 pr-3 font-medium">区域</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">收入（万元）</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">同比</th>
                    <th scope="col" className="py-2 text-right font-medium">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {view.stores.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className={`py-2.5 pr-3 ${TYPE.numberInline} text-slate-500`}>{row.rank}</td>
                      <td className="py-2.5 pr-3">
                        <Link href={`/revenue/store/${row.id}`} className="font-medium text-slate-800 hover:text-teal-700 hover:underline">
                          {row.name}
                        </Link>
                        {row.isNew ? <span className="ml-2"><NewBadge /></span> : null}
                      </td>
                      <td className="py-2.5 pr-3 text-sm text-slate-500">{row.region}</td>
                      <td className={`py-2.5 pr-3 text-right ${TYPE.numberInline}`}>{formatAmount(row.revenue)}</td>
                      <td className={`py-2.5 pr-3 text-right ${TYPE.numberInline} ${toneOf(row.yoy)}`}>
                        {formatSignedPercent(row.yoy)}
                      </td>
                      <td className={`py-2.5 text-right ${TYPE.numberInline} text-slate-500`}>{formatPercent(row.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="数据完整度"
          description="各模板在每个期间是否有数据；缺失项点击即可前往导入。"
          actions={
            <Link href="/data/import" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
              导入数据
            </Link>
          }
        >
          <CompletenessMatrix periods={view.completeness.periods} rows={view.completeness.rows} />
        </Panel>

        <footer className={`pb-10 pt-2 ${TYPE.note}`}>
          数据来源：{view.sourceFile} · 单位：收入与利润为万元、客流为人次、客单价为元。口径见领域模型第 11.4 节。
        </footer>
      </div>
    </main>
  );
}
