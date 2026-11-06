import { formatAmount, formatPercent, formatSignedAmount } from "../lib/format.js";
import type { EffectBreakdown } from "../lib/same-store-view.js";
import type { SameStoreSummary } from "../lib/metrics/types.js";
import { LAYOUT, TYPE } from "../lib/theme.js";
import { DeltaValue } from "./DeltaValue.js";
import { Panel } from "./Panel.js";

interface BarRow {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly share: number | null;
  readonly tag?: string;
}

export function SameStoreDecomposition({
  effects,
  summary,
  unit,
}: {
  effects: EffectBreakdown;
  summary: SameStoreSummary;
  unit: string;
}) {
  const maxAbs = Math.max(
    Math.abs(effects.trafficEffect),
    Math.abs(effects.ticketEffect),
    Math.abs(effects.effectTotal),
    0.01,
  );

  const rows: readonly BarRow[] = [
    {
      key: "traffic",
      label: "客流影响",
      value: effects.trafficEffect,
      share: effects.trafficShare,
      tag: "主因",
    },
    {
      key: "ticket",
      label: "客单价影响",
      value: effects.ticketEffect,
      share: effects.ticketShare,
    },
    {
      key: "total",
      label: "两项合计",
      value: effects.effectTotal,
      share: null,
    },
  ];

  return (
    <Panel
      title="同店收入拆解 · 客流 vs 客单价"
      description="连环替代法：先替换客流，再替换客单价。收入差 = 客流差 × 上期客单价 + 本期客流 × 客单价差。"
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-4">
          {rows.map((row) => {
            const width = Math.max(1.2, (Math.abs(row.value) / maxAbs) * 100);
            return (
              <div key={row.key} className="grid grid-cols-[128px_1fr_170px] items-center gap-3 lg:gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-body text-slate-600">{row.label}</span>
                  {row.tag ? (
                    <span className="rounded bg-up-soft px-1.5 py-0.5 text-micro font-semibold text-up">
                      {row.tag}
                    </span>
                  ) : null}
                </div>
                <div className="relative h-10 overflow-hidden rounded-lg border border-slate-200/70 bg-slate-100">
                  <div
                    className={`h-full rounded-md ${row.key === "total" ? "bg-total" : row.value >= 0 ? "bg-up" : "bg-down"}`}
                    style={{ width: `${Math.min(100, width)}%` }}
                  />
                </div>
                <div className="text-right">
                  <span className={TYPE.numberSm}>
                    <DeltaValue value={row.value} text={`${formatSignedAmount(row.value)} 万元`} />
                  </span>
                  <span className="ml-2 inline-block w-14 text-right font-mono text-xs tabular-nums text-slate-400">
                    {row.share === null ? "" : formatPercent(row.share)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={`${LAYOUT.inset} p-4 lg:w-64`}>
          <p className="text-xs tracking-wide text-slate-500">同店收入同比</p>
          <p className={`mt-1 ${TYPE.numberLg}`}>
            <DeltaValue
              value={summary.revenueDelta}
              text={`${formatSignedAmount(summary.revenueDelta)} 万元`}
            />
          </p>
          <dl className="mt-3 space-y-1.5 text-sm text-slate-500">
            <div className="flex items-baseline justify-between gap-2">
              <dt>本期收入</dt>
              <dd className="font-mono tabular-nums text-slate-800">
                {formatAmount(summary.revenueCurrent)} 万元
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt>上年同期</dt>
              <dd className="font-mono tabular-nums text-slate-500">
                {formatAmount(summary.revenuePrevious)} 万元
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="mt-5 rounded-lg bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-900">
        两项影响合计 {formatSignedAmount(effects.effectTotal)} 万元，与同店收入同比{' '}
        {formatSignedAmount(effects.revenueDelta)} 万元相差{' '}
        {formatAmount(Math.abs(effects.reconciliationGap))} 万元——差额来自 2024 年客流在源表中按整数取整，
        不影响「增长主要来自客流」的判断。
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        面积按影响额归一；客流贡献 {formatPercent(effects.trafficShare)}，客单价贡献{' '}
        {formatPercent(effects.ticketShare)}。单位：{unit}。
      </p>
    </Panel>
  );
}
