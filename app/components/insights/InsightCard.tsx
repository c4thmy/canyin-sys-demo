import Link from "next/link";

import {
  drillLabelOf,
  INSIGHT_CATEGORY_LABELS,
  INSIGHT_SEVERITY_LABELS,
} from "../../lib/insight-labels.js";
import type { Insight, InsightSeverity } from "../../lib/metrics/index.js";
import { TYPE } from "../../lib/theme.js";

const SEVERITY_STYLE: Record<
  InsightSeverity,
  { readonly card: string; readonly rail: string; readonly badge: string }
> = {
  critical: {
    card: "border-down/40 bg-down-soft",
    rail: "bg-down",
    badge: "bg-down text-white",
  },
  warning: {
    card: "border-amber-300 bg-amber-50/50",
    rail: "bg-gradient-to-r from-amber-500 to-amber-400",
    badge: "bg-amber-500 text-white",
  },
  positive: {
    card: "border-up/30 bg-white",
    rail: "bg-up",
    badge: "bg-up text-white",
  },
};

/**
 * 一条结论卡片：严重度徽标 + 分类 + 标题 + 带数字的解释 + 可点击证据。
 * warning / critical 分别用琥珀 / 红色边框，正向用中性边框。
 */
export function InsightCard({ insight, wide = false }: { insight: Insight; wide?: boolean }) {
  const style = SEVERITY_STYLE[insight.severity];
  const drillLabel = drillLabelOf(insight.link);

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border-2 p-5 shadow-sm ${style.card} ${wide ? "lg:col-span-2" : ""}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${style.rail}`} aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-micro font-semibold tracking-wide ${style.badge}`}
        >
          {INSIGHT_SEVERITY_LABELS[insight.severity]}
        </span>
        <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-micro font-medium text-slate-600">
          {INSIGHT_CATEGORY_LABELS[insight.category]}
        </span>
        {insight.link ? (
          <Link
            href={insight.link}
            className="ml-auto whitespace-nowrap rounded-sm text-xs font-medium text-teal-700 underline-offset-4 transition hover:text-teal-800 hover:underline"
          >
            在{drillLabel}查看 →
          </Link>
        ) : null}
      </div>

      <h3 className={`mt-3 ${TYPE.featuredTitle}`}>{insight.title}</h3>
      <p className={`mt-2.5 text-body leading-7 text-slate-700 ${wide ? "max-w-5xl" : ""}`}>
        {insight.detail}
      </p>

      <dl className={`mt-4 grid gap-2 sm:grid-cols-2 ${wide ? "xl:grid-cols-3" : ""}`}>
        {insight.evidence.map((evidence) => (
          <div
            key={evidence.label}
            className="min-w-0 rounded-xl border border-white/80 bg-white/85 px-3 py-2"
          >
            <dt className="text-micro leading-4 text-slate-500">{evidence.label}</dt>
            <dd className="mt-0.5 break-words font-mono text-meta font-semibold leading-5 text-slate-900 tabular-nums">
              {evidence.link ? (
                <Link
                  href={evidence.link}
                  title={`查看${drillLabelOf(evidence.link)}的原始数字`}
                  className="rounded-sm underline decoration-dotted decoration-slate-300 underline-offset-4 transition hover:text-teal-700 hover:decoration-teal-400"
                >
                  {evidence.value}
                </Link>
              ) : (
                evidence.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className={`mt-auto pt-4 ${TYPE.micro} text-slate-400`}>
        证据来自本期数据；点击数字可跳到{drillLabel}核对。
      </p>
    </article>
  );
}
