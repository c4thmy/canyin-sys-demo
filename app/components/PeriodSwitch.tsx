import type { SeedPeriod } from "../lib/seed.js";

/** 演示固定两期对比：展示期次与当前分析期，不做任意月份选择 */
export function PeriodSwitch({
  periods,
  activeId,
}: {
  periods: readonly SeedPeriod[];
  activeId: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 p-1"
      role="group"
      aria-label="期间：固定两期对比"
    >
      {periods.map((period) => {
        const active = period.id === activeId;
        return (
          <span
            key={period.id}
            aria-current={active ? "true" : undefined}
            className={[
              "flex items-baseline gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-teal-400 text-slate-950 shadow-sm"
                : "text-slate-300",
            ].join(" ")}
          >
            <span className="font-mono text-xs opacity-70">{period.id}</span>
            {period.label}
          </span>
        );
      })}
    </div>
  );
}
