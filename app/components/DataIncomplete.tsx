import Link from "next/link";

import type { MissingData } from "../lib/dataset-status.js";
import { LAYOUT, TYPE } from "../lib/theme.js";

/**
 * 「数据不完整」提示：列出缺失的模板与期间，并给出导入入口。
 * 用于整页降级（页面依赖的数据缺失）与区块降级。
 */
export function DataIncomplete({
  missing,
  title = "数据不完整",
  compact = false,
}: {
  missing: readonly MissingData[];
  title?: string;
  compact?: boolean;
}) {
  const names = [...new Set(missing.map((item) => item.name))];
  return (
    <section
      role="status"
      className={`${LAYOUT.card} ${compact ? LAYOUT.compactCardPadding : LAYOUT.cardPadding} border-amber-200 bg-amber-50/60`}
    >
      <h2 className={compact ? TYPE.cardTitle : TYPE.sectionTitle}>{title}</h2>
      <p className={`mt-2 ${TYPE.body}`}>
        当前数据集缺少本页需要的数据，请导入「{names.join("」「")}」模板后再查看。
      </p>
      <ul className={`mt-3 space-y-1 ${TYPE.note}`}>
        {missing.map((item) => (
          <li key={`${item.type}-${item.period.id}`}>
            · {item.name}：{item.period.label}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/data/import"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          前往导入数据
        </Link>
        <Link
          href="/data/templates"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
        >
          下载模板
        </Link>
        <Link
          href="/data"
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          切换数据集
        </Link>
      </div>
    </section>
  );
}
