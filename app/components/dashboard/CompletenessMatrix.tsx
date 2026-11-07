import Link from "next/link";

import type { CompletenessRow } from "../../lib/dataset-status.js";
import type { SeedPeriod } from "../../lib/seed.js";
import { TYPE } from "../../lib/theme.js";

/** 数据完整度矩阵：6 套模板 × 期间，缺失格可跳转导入 */
export function CompletenessMatrix({
  periods,
  rows,
}: {
  periods: readonly SeedPeriod[];
  rows: readonly CompletenessRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left">
        <caption className="sr-only">数据完整度：各模板在各期间是否有数据</caption>
        <thead>
          <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
            <th scope="col" className="py-2 pr-4 font-medium">模板</th>
            {periods.map((period) => (
              <th key={period.id} scope="col" className="px-3 py-2 text-center font-medium">
                {period.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.type} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="py-2.5 pr-4 text-sm font-medium text-slate-800">
                {row.name}
              </th>
              {row.cells.map((cell) => (
                <td key={cell.period} className="px-3 py-2.5 text-center text-sm">
                  {cell.present ? (
                    <span className="inline-flex items-center gap-1 text-up">
                      <span aria-hidden="true">●</span>已有
                    </span>
                  ) : (
                    <Link href="/data/import" className="inline-flex items-center gap-1 text-slate-400 underline-offset-2 hover:text-teal-700 hover:underline">
                      <span aria-hidden="true">○</span>缺失
                    </Link>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
