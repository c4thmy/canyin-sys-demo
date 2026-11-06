"use client";

import Link from "next/link";

import { formatAmount, formatInteger, formatSignedAmount, formatSignedInteger } from "../lib/format.js";
import type { StoreTrafficRow } from "../lib/metrics/types.js";
import { ClickableRow } from "./ClickableRow.js";
import { DeltaValue } from "./DeltaValue.js";
import { Panel } from "./Panel.js";

function trafficDelta(row: StoreTrafficRow): number {
  return Math.round(row.trafficCurrent) - Math.round(row.trafficPrevious);
}

export function StoreTrafficTable({
  rows,
  unit,
  averageTicketPrevious,
  averageTicketCurrent,
}: {
  rows: readonly StoreTrafficRow[];
  unit: string;
  averageTicketPrevious: number;
  averageTicketCurrent: number;
}) {
  const totals = rows.reduce(
    (total, row) => ({
      trafficCurrent: total.trafficCurrent + Math.round(row.trafficCurrent),
      trafficPrevious: total.trafficPrevious + Math.round(row.trafficPrevious),
      trafficEffect: total.trafficEffect + row.trafficEffect,
      ticketEffect: total.ticketEffect + row.ticketEffect,
      revenueDelta: total.revenueDelta + row.revenueDelta,
    }),
    { trafficCurrent: 0, trafficPrevious: 0, trafficEffect: 0, ticketEffect: 0, revenueDelta: 0 },
  );

  return (
    <Panel
      title={`${rows.length} 家同店明细`}
      description="按收入差降序。收入差取门店表；客流影响 = 客流差 × 上期客单价，客单价影响 = 本期客流 × 客单价差。点击行下钻门店。"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-left text-[15px]">
          <caption className="sr-only">{rows.length} 家同店客流与客单价拆解明细</caption>
          <thead>
            <tr className="border-b border-slate-200 text-sm text-slate-500">
              <th scope="col" className="py-3 pr-4 text-left font-medium">门店</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">本期客流</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">上期客流</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">客流差</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">本期客单</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">上期客单</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">客单差</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">客流影响</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">客单影响</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">收入差</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ClickableRow key={row.storeId} href={`/revenue/store/${row.storeId}`}>
                <th scope="row" className="py-3.5 pr-4 text-left font-medium">
                  <Link
                    href={`/revenue/store/${row.storeId}`}
                    className="rounded-sm text-slate-900 underline-offset-4 hover:text-teal-700 hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="ml-2 text-xs font-normal text-slate-400">{row.region}</span>
                </th>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-900">
                  {formatInteger(row.trafficCurrent)}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-500">
                  {formatInteger(row.trafficPrevious)}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right">
                  <DeltaValue value={trafficDelta(row)} text={formatSignedInteger(trafficDelta(row))} />
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-900">
                  {formatAmount(row.ticketCurrent)}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-500">
                  {formatAmount(row.ticketPrevious)}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right">
                  <DeltaValue value={row.ticketDelta} text={formatSignedAmount(row.ticketDelta)} />
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right">
                  <DeltaValue value={row.trafficEffect} text={formatSignedAmount(row.trafficEffect)} />
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right">
                  <DeltaValue value={row.ticketEffect} text={formatSignedAmount(row.ticketEffect)} />
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-semibold">
                  <DeltaValue value={row.revenueDelta} text={formatSignedAmount(row.revenueDelta)} />
                </td>
              </ClickableRow>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <th scope="row" className="py-3.5 pr-4 text-left">合计</th>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                {formatInteger(totals.trafficCurrent)}
              </td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-500">
                {formatInteger(totals.trafficPrevious)}
              </td>
              <td className="px-3 py-3.5 text-right">
                <DeltaValue
                  value={totals.trafficCurrent - totals.trafficPrevious}
                  text={formatSignedInteger(totals.trafficCurrent - totals.trafficPrevious)}
                />
              </td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                {formatAmount(averageTicketCurrent)}
              </td>
              <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-500">
                {formatAmount(averageTicketPrevious)}
              </td>
              <td className="px-3 py-3.5 text-right">
                <DeltaValue
                  value={averageTicketCurrent - averageTicketPrevious}
                  text={formatSignedAmount(averageTicketCurrent - averageTicketPrevious)}
                />
              </td>
              <td className="px-3 py-3.5 text-right">
                <DeltaValue value={totals.trafficEffect} text={formatSignedAmount(totals.trafficEffect)} />
              </td>
              <td className="px-3 py-3.5 text-right">
                <DeltaValue value={totals.ticketEffect} text={formatSignedAmount(totals.ticketEffect)} />
              </td>
              <td className="px-3 py-3.5 text-right">
                <DeltaValue value={totals.revenueDelta} text={formatSignedAmount(totals.revenueDelta)} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-500">
        客单价列单位为元/人次，影响额与收入差单位为{unit}。合计行的客单价为按客流加权的平均值。
        逐店「客流影响 + 客单影响」与收入差存在 ≤0.46 万元的差异，来自 2024 年客流在源表中的整数取整。
      </p>
    </Panel>
  );
}
