import { formatInteger, formatSignedInteger, formatSignedPercent } from "../lib/format.js";
import type { TimeSlotComparison, TimeSlotGroup } from "../lib/metrics/types.js";
import { TYPE } from "../lib/theme.js";
import { DeltaValue } from "./DeltaValue.js";
import { Panel } from "./Panel.js";

function slotName(slot: TimeSlotComparison): string {
  if (slot.span === "9:00-14:00") {
    return "午市";
  }
  if (slot.span === "14:00-24:00") {
    return "晚市";
  }
  return slot.segment === "夜宵" ? "夜宵" : slot.segment;
}

export function TimeSlotPanel({
  groups,
  insight,
}: {
  groups: readonly TimeSlotGroup[];
  insight: string;
}) {
  const maxValue = Math.max(
    ...groups.flatMap((group) => group.slots.flatMap((slot) => [slot.previous, slot.current])),
    1,
  );

  return (
    <Panel
      title="时段客流 · 2024 → 2025"
      description="分平日与节假日看日均客流（人次/日）。同一时段两年对照，条长按全部时段的最大值归一。"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.dayType} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 lg:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/70 pb-3">
              <h3 className={TYPE.cardTitle}>{group.dayType}</h3>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-mono tabular-nums text-slate-500">
                  {formatInteger(group.previous)} → {formatInteger(group.current)} 人次/日
                </span>
                <DeltaValue
                  value={group.delta}
                  text={formatSignedInteger(group.delta)}
                  className="text-sm font-semibold"
                />
                <span className="font-mono text-xs tabular-nums text-slate-400">
                  {formatSignedPercent(group.deltaRate)}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {group.slots.map((slot) => {
                const up = slot.delta >= 0;
                return (
                  <div key={`${slot.dayType}-${slot.span}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-body font-medium text-slate-800">
                        {slotName(slot)}
                        <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                          {slot.span}
                        </span>
                      </span>
                      <span className="flex items-baseline gap-2 font-mono text-sm tabular-nums">
                        <span className="text-slate-400">{formatInteger(slot.previous)}</span>
                        <span className="text-slate-300">→</span>
                        <span className="font-semibold text-slate-900">{formatInteger(slot.current)}</span>
                        <DeltaValue
                          value={slot.delta}
                          text={formatSignedInteger(slot.delta)}
                          className="font-semibold"
                        />
                        <span className="text-xs text-slate-400">{formatSignedPercent(slot.deltaRate)}</span>
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-9 shrink-0 text-right font-mono text-nano text-slate-400">2024</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-sm bg-white">
                          <div
                            className="h-full rounded-sm bg-slate-300"
                            style={{ width: `${(slot.previous / maxValue) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-9 shrink-0 text-right font-mono text-nano text-slate-400">2025</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-sm bg-white">
                          <div
                            className={`h-full rounded-sm ${up ? "bg-up" : "bg-down"}`}
                            style={{ width: `${(slot.current / maxValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-lg border border-teal-100 bg-teal-50/60 px-4 py-3">
        <span className="mt-0.5 rounded bg-teal-600 px-1.5 py-0.5 text-micro font-semibold text-white">
          洞察
        </span>
        <p className="text-sm leading-6 text-teal-900">{insight}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        口径：表7 分时段日均客流；工作日与节假日不加权合并。共 {groups.length} 类日期 ×{' '}
        {groups[0]?.slots.length ?? 0} 个时段。
      </p>
    </Panel>
  );
}
