import { formatAmount, formatPercent, formatSignedAmount } from "../lib/format.js";
import type { StoreDetailView } from "../lib/store-view.js";
import { LAYOUT, TYPE } from "../lib/theme.js";
import { DeltaValue } from "./DeltaValue.js";
import { Panel } from "./Panel.js";

export function StoreEffectPanel({ view }: { view: StoreDetailView }) {
  const { effects } = view;

  if (!effects.hasPrevious) {
    return (
      <Panel
        title="收入差拆解"
        description="客流差影响 + 客单价差影响（连环替代法，先替换客流）。"
      >
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
          <p className="text-lg font-medium text-slate-700">新店无上年同期数据</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            新店在 2024 年 9 月无同期数据，客流、客单价与收入均无同期值，因此不做同比，也不做客流 × 客单价拆解。
            本期开业爬坡情况请看上方三项指标与下方的客单价对比。
          </p>
        </div>
      </Panel>
    );
  }

  const maxAbs = Math.max(Math.abs(effects.trafficEffect), Math.abs(effects.ticketEffect), 0.01);
  const rows = [
    {
      key: "traffic",
      label: "客流差影响",
      value: effects.trafficEffect,
      share: effects.trafficShare,
    },
    {
      key: "ticket",
      label: "客单差影响",
      value: effects.ticketEffect,
      share: effects.ticketShare,
    },
  ];

  const gapLabel = Math.abs(effects.reconciliationGap) < 0.005 ? "一致" : `${formatAmount(Math.abs(effects.reconciliationGap))} 万元`;

  return (
    <Panel
      title="收入差拆解"
      description="客流差影响 + 客单价差影响（连环替代法，先替换客流）。"
    >
      <div className="space-y-5">
        {rows.map((row) => {
          const width = Math.max(1.5, (Math.abs(row.value) / maxAbs) * 100);
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body text-slate-600">{row.label}</span>
                <span className={TYPE.numberSm}>
                  <DeltaValue value={row.value} text={`${formatSignedAmount(row.value)} 万元`} />
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    占 {formatPercent(row.share)}
                  </span>
                </span>
              </div>
              <div className="mt-2 h-9 overflow-hidden rounded-lg border border-slate-200/70 bg-slate-100">
                <div
                  className={`h-full rounded-md ${row.value >= 0 ? "bg-up" : "bg-down"}`}
                  style={{ width: `${Math.min(100, width)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <dl className={`mt-6 grid gap-3 ${LAYOUT.inset} p-4 sm:grid-cols-3`}>
        <div>
          <dt className="text-xs text-slate-500">两项合计</dt>
          <dd className={`mt-1 ${TYPE.numberMd}`}>
            <DeltaValue value={effects.effectTotal} text={`${formatSignedAmount(effects.effectTotal)} 万元`} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">门店收入差</dt>
          <dd className={`mt-1 ${TYPE.numberMd}`}>
            <DeltaValue value={effects.revenueDelta} text={`${formatSignedAmount(effects.revenueDelta)} 万元`} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">取整差额</dt>
          <dd className={`mt-1 ${TYPE.numberMd} text-amber-700`}>{gapLabel}</dd>
        </div>
      </dl>

      <p className={`mt-4 ${TYPE.note}`}>
        差额来自 2024 年客流在源表中按整数取整；本期口径「客流 × 客单价」与门店收入一致（误差 &lt; 0.01 万元）。
      </p>
    </Panel>
  );
}
