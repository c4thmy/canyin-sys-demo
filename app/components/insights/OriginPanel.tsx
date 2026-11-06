import Link from "next/link";

import type { InsightOrigin } from "../../lib/metrics/index.js";
import { formatAmount, formatPercent, formatSignedAmount } from "../../lib/format.js";
import { LAYOUT, TYPE } from "../../lib/theme.js";
import { DeltaValue } from "../DeltaValue.js";
import { Panel } from "../Panel.js";

/**
 * 异动原点：把营业收入同比增量拆成 新店 / 同店客流 / 同店客单价 三项，
 * 按贡献绝对值排序，前 3 项高亮；每张卡片可跳到产生该数字的下钻页。
 */
export function OriginPanel({
  origins,
  totalDelta,
  originGap,
  unit,
}: {
  origins: readonly InsightOrigin[];
  totalDelta: number;
  originGap: number;
  unit: string;
}) {
  const originTotal = origins.reduce((total, origin) => total + origin.amount, 0);
  const maxAbs = Math.max(...origins.map((origin) => Math.abs(origin.amount)), 0.01);

  return (
    <Panel
      title="异动原点 · 收入增量拆解"
      description="按对营业收入同比增量的贡献排序，前 3 项高亮。原点之和与总增量之间的尾差来自源表四舍五入。"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {origins.map((origin) => {
          const isTop = origin.rank === 1;
          const width = Math.max(4, Math.min(100, (Math.abs(origin.amount) / maxAbs) * 100));
          return (
            <Link
              key={origin.key}
              href={origin.link}
              className={[
                "group relative flex flex-col overflow-hidden rounded-2xl border-2 p-5 transition duration-150",
                "hover:-translate-y-0.5 hover:shadow-md focus-visible:-translate-y-0.5",
                isTop
                  ? "border-teal-400 bg-gradient-to-br from-teal-50 to-white ring-2 ring-teal-100"
                  : "border-teal-200 bg-teal-50/40",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={[
                    "inline-flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-semibold tabular-nums",
                    isTop
                      ? "bg-teal-600 text-white"
                      : "border border-teal-200 bg-white text-teal-700",
                  ].join(" ")}
                >
                  {origin.rank}
                </span>
                <span className="rounded-full border border-teal-200 bg-white/80 px-2 py-0.5 text-micro font-medium text-teal-700">
                  前 3 高亮
                </span>
              </div>

              <p className="mt-4 text-sm font-medium text-slate-500">{origin.label}</p>
              <p className={`mt-1 ${TYPE.numberLg}`}>
                <DeltaValue value={origin.amount} text={formatSignedAmount(origin.amount)} />
                <span className="ml-1.5 font-sans text-sm font-normal text-slate-500">{unit}</span>
              </p>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/90">
                <div
                  className={`h-full rounded-full ${
                    origin.amount >= 0
                      ? isTop
                        ? "bg-up"
                        : "bg-up/60"
                      : isTop
                        ? "bg-down"
                        : "bg-down/60"
                  }`}
                  style={{ width: `${width}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                占营业收入增量 <span className="font-mono tabular-nums">{formatPercent(origin.share)}</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{origin.note}</p>

              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-700 transition group-hover:gap-2">
                查看来源 <span aria-hidden="true">→</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className={`mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 ${LAYOUT.inset} px-4 py-3 text-sm leading-6 text-slate-600`}>
        <span>
          三项合计 <span className="font-mono font-semibold text-slate-800 tabular-nums">{formatSignedAmount(originTotal)} {unit}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span>
          营业收入同比 <span className="font-mono font-semibold text-slate-800 tabular-nums">{formatSignedAmount(totalDelta)} {unit}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span>
          取整尾差 <span className="font-mono font-semibold text-amber-700 tabular-nums">{formatAmount(Math.abs(originGap))} {unit}</span>
        </span>
      </div>
    </Panel>
  );
}
