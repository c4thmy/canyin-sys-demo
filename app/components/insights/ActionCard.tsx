import Link from "next/link";

import { drillLabelOf } from "../../lib/insight-labels.js";
import type { Action } from "../../lib/metrics/index.js";
import { TYPE } from "../../lib/theme.js";

/**
 * 一条行动建议：标题、为什么做、2–3 条动作、责任部门，以及触发它的结论 id。
 * 底部链接回触发结论对应的下钻页，方便演示时当场核对证据。
 */
export function ActionCard({ action, index }: { action: Action; index: number }) {
  return (
    <article className="card-surface flex h-full flex-col rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-2.5 py-1 text-micro font-semibold tracking-wide text-white">
          行动 {index + 1}
        </span>
        <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-micro font-medium text-teal-700">
          建议责任：{action.owner}
        </span>
      </div>

      <h3 className={`mt-3 ${TYPE.cardTitle} leading-7`}>{action.title}</h3>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
        <p className={`${TYPE.micro} font-semibold uppercase tracking-[0.18em] text-slate-400`}>
          为什么做
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{action.why}</p>
      </div>

      <ol className="mt-4 space-y-2.5">
        {action.steps.map((step, stepIndex) => (
          <li key={step} className="flex gap-2.5 text-sm leading-6 text-slate-700">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 font-mono text-micro font-semibold text-teal-700">
              {stepIndex + 1}
            </span>
            <span className="min-w-0">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-micro">
        <span className="min-w-0 truncate text-slate-400">
          触发结论：
          <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">
            {action.insightId}
          </span>
        </span>
        {action.link ? (
          <Link
            href={action.link}
            className="shrink-0 whitespace-nowrap rounded-sm font-medium text-teal-700 underline-offset-4 transition hover:text-teal-800 hover:underline"
          >
            去{drillLabelOf(action.link)}看依据 →
          </Link>
        ) : null}
      </div>
    </article>
  );
}
