import type { MetricCardView } from "../lib/overview.js";
import { LAYOUT, TYPE } from "../lib/theme.js";
import { MetricInfo } from "./MetricInfo.js";

const TONE_CLASS: Record<MetricCardView["tone"], string> = {
  positive: "text-up",
  negative: "text-down",
  neutral: "text-slate-500",
};

export function MetricCard({ card }: { card: MetricCardView }) {
  return (
    <article className={`${LAYOUT.card} relative p-6`}>
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 opacity-80" />
      <h3 className={`flex items-center gap-1.5 ${TYPE.cardLabel}`}>
        <span>{card.label}</span>
        {card.metric ? <MetricInfo metric={card.metric} /> : null}
      </h3>

      <div className="mt-4 flex flex-nowrap items-baseline gap-2 whitespace-nowrap">
        <span className={`${TYPE.numberHero} text-slate-900`}>{card.value}</span>
        {card.unit ? <span className="shrink-0 text-base text-slate-500">{card.unit}</span> : null}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`${TYPE.numberSm} ${TONE_CLASS[card.tone]}`}>{card.delta}</span>
        <span className="text-sm text-slate-500">{card.deltaUnit}</span>
      </div>
      <p className="mt-1 text-sm text-slate-400">{card.note}</p>
    </article>
  );
}
