import type { MetricCardView } from "../lib/overview.js";

const TONE_CLASS: Record<MetricCardView["tone"], string> = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  neutral: "text-slate-500",
};

export function MetricCard({ card }: { card: MetricCardView }) {
  return (
    <article className="card-surface relative overflow-hidden rounded-2xl p-6">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 opacity-80" />
      <h3 className="text-base font-medium tracking-wide text-slate-500">{card.label}</h3>

      <div className="mt-4 flex flex-nowrap items-baseline gap-2 whitespace-nowrap">
        <span className="font-mono text-4xl font-semibold leading-none tracking-tight text-slate-900 tabular-nums xl:text-[2.5rem]">
          {card.value}
        </span>
        {card.unit ? <span className="shrink-0 text-base text-slate-500">{card.unit}</span> : null}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`font-mono text-lg font-semibold tabular-nums ${TONE_CLASS[card.tone]}`}>
          {card.delta}
        </span>
        <span className="text-sm text-slate-500">{card.deltaUnit}</span>
      </div>
      <p className="mt-1 text-sm text-slate-400">{card.note}</p>
    </article>
  );
}
