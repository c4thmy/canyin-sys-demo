"use client";

import { useMemo, useState } from "react";

import { formatAmount, formatPercent, formatSignedAmount, formatSignedPercent } from "../../lib/format.js";
import type { AggregateGroup } from "../../lib/metrics/types.js";
import { TYPE } from "../../lib/theme.js";
import { DeltaValue } from "../DeltaValue.js";
import { Panel } from "../Panel.js";

type SortKey = "revenue" | "delta";
type SortDirection = "desc" | "asc";

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === activeKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : "none"}
      className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={[
          "inline-flex items-center gap-1 rounded-sm transition",
          align === "right" ? "justify-end" : "justify-start",
          active ? "text-slate-900" : "text-slate-500 hover:text-slate-800",
        ].join(" ")}
      >
        {label}
        <span aria-hidden="true" className="font-mono text-xs">
          {active ? (direction === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
}

/**
 * 渠道收入表 + 同比差额条形图。
 *
 * - 收入结构页与渠道页共用：前者默认按本期收入排序，后者默认按同比差额排序；
 * - 条形图与表格顺序同步，长度按差额绝对值归一到半轴；
 * - storeTotal 传入时额外给出口径尾差说明（渠道表合计 vs 门店表合计）。
 */
export function ChannelPanel({
  rows,
  unit,
  totalCurrent,
  totalPrevious,
  storeTotal,
  defaultSortKey = "revenue",
  title = "渠道收入结构",
  description,
}: {
  rows: readonly AggregateGroup[];
  unit: string;
  totalCurrent: number;
  totalPrevious: number;
  storeTotal?: number;
  defaultSortKey?: SortKey;
  title?: string;
  description?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey);
  const [direction, setDirection] = useState<SortDirection>("desc");

  const onSort = (key: SortKey): void => {
    if (key === sortKey) {
      setDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setDirection("desc");
  };

  const sorted = useMemo(() => {
    const valueOf = (group: AggregateGroup): number =>
      sortKey === "revenue" ? group.revenue : group.delta;
    return [...rows].sort((a, b) => {
      const diff = valueOf(a) - valueOf(b);
      return (direction === "desc" ? -diff : diff) || a.key.localeCompare(b.key, "zh-Hans-CN");
    });
  }, [rows, sortKey, direction]);

  const maxAbsDelta = Math.max(...rows.map((group) => Math.abs(group.delta)), 0.01);
  const totalDelta = totalCurrent - totalPrevious;

  return (
    <Panel
      title={title}
      description={
        description ??
        `${rows.length} 个渠道 · 可点击「本期收入」或「同比差额」表头切换排序 · 条形图与表格顺序同步`
      }
      actions={
        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm text-slate-600 tabular-nums">
          本期合计 {formatAmount(totalCurrent)} {unit}
        </span>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 lg:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className={TYPE.caption}>渠道同比差额 · 横向条形（{unit}）</h3>
          <p className="text-xs text-slate-400">
            <span className="text-up">■</span> 上升
            <span className="ml-3 text-down">■</span> 下降 · 长度按差额绝对值归一
          </p>
        </div>

        <div className="mt-4 space-y-1.5">
          {sorted.map((group) => {
            const ratio = Math.abs(group.delta) / maxAbsDelta;
            const width = Math.max(0.8, ratio * 50);
            const positive = group.delta >= 0;
            return (
              <div key={group.key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-body text-slate-600" title={group.key}>
                  {group.key}
                </span>
                <div className="relative h-7 flex-1 overflow-hidden rounded-md border border-slate-200/70 bg-white">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" aria-hidden="true" />
                  <span
                    className={[
                      "absolute top-1/2 h-4 -translate-y-1/2",
                      positive ? "rounded-r bg-up" : "rounded-l bg-down",
                    ].join(" ")}
                    style={
                      positive
                        ? { left: "50%", width: `${width}%` }
                        : { right: "50%", width: `${width}%` }
                    }
                  />
                </div>
                <span className="w-24 shrink-0 text-right">
                  <DeltaValue value={group.delta} text={formatSignedAmount(group.delta)} className="text-body" />
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span className="w-28 shrink-0" />
          <div className="flex flex-1 justify-between font-mono tabular-nums">
            <span>−{formatAmount(maxAbsDelta)}</span>
            <span>0</span>
            <span>+{formatAmount(maxAbsDelta)}</span>
          </div>
          <span className="w-24 shrink-0" />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-body">
          <caption className="sr-only">{rows.length} 个渠道收入结构与同比变化，可按本期收入或同比差额排序</caption>
          <thead>
            <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
              <th scope="col" className="py-3 pr-4 text-left font-medium">渠道</th>
              <SortableHeader
                label={`本期收入（${unit}）`}
                sortKey="revenue"
                activeKey={sortKey}
                direction={direction}
                onSort={onSort}
              />
              <th scope="col" className="px-4 py-3 text-right font-medium">上期收入（{unit}）</th>
              <SortableHeader
                label={`同比差额（${unit}）`}
                sortKey="delta"
                activeKey={sortKey}
                direction={direction}
                onSort={onSort}
              />
              <th scope="col" className="px-4 py-3 text-right font-medium">增减率</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">占比</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((group) => (
              <tr
                key={group.key}
                className="border-b border-slate-100 transition-colors last:border-0 hover:bg-teal-50/40"
              >
                <th scope="row" className="py-3.5 pr-4 text-left font-medium text-slate-900">
                  {group.key}
                </th>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono tabular-nums text-slate-900">
                  {formatAmount(group.revenue)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono tabular-nums text-slate-500">
                  {formatAmount(group.prevRevenue)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <DeltaValue value={group.delta} text={formatSignedAmount(group.delta)} />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <DeltaValue
                    value={group.delta}
                    text={formatSignedPercent(group.deltaRate)}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono tabular-nums text-slate-600">
                  {formatPercent(group.share)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <th scope="row" className="py-3.5 pr-4 text-left">合计</th>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums">{formatAmount(totalCurrent)}</td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-500">
                {formatAmount(totalPrevious)}
              </td>
              <td className="px-4 py-3.5 text-right">
                <DeltaValue value={totalDelta} text={formatSignedAmount(totalDelta)} />
              </td>
              <td className="px-4 py-3.5 text-right">
                <DeltaValue
                  value={totalDelta}
                  text={formatSignedPercent(
                    totalPrevious === 0 ? null : totalDelta / totalPrevious,
                  )}
                />
              </td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-500">100.00%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {storeTotal === undefined ? null : (
        <p className={`mt-4 ${TYPE.note}`}>
          渠道口径合计 {formatAmount(totalCurrent)} 万元，与门店口径 {formatAmount(storeTotal)} 万元相差{' '}
          {formatAmount(Math.abs(storeTotal - totalCurrent))} 万元，为源表四舍五入。
        </p>
      )}
    </Panel>
  );
}
