import Link from "next/link";

import { RevenueHeader } from "../RevenueHeader.js";
import { analysisPeriods } from "../../lib/dataset-status.js";
import { loadSeed } from "../../lib/seed.js";

const TABS = [
  { key: "all", href: "/reports", label: "全部报告" },
  { key: "templates", href: "/reports/templates", label: "报告模板" },
] as const;

/** 报告中心页头 + 子导航 */
export function ReportsHeader({
  title,
  subtitle,
  active,
  back,
}: {
  title: string;
  subtitle: string;
  active?: (typeof TABS)[number]["key"];
  back?: { href: string; label: string };
}) {
  const seed = loadSeed();
  const selected = analysisPeriods(seed);
  return (
    <div className="no-print">
      <RevenueHeader
        title={title}
        eyebrow="Reports · 分析报告"
        subtitle={<span>{subtitle}</span>}
        active="reports"
        back={back}
        periods={selected?.periods ?? []}
        activePeriodId={selected?.current.id ?? ""}
        previousLabel={selected?.previous.label ?? "—"}
        unit={seed.meta.currency_unit ?? "万元"}
      />
      {active ? (
        <nav aria-label="报告中心" className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-[1440px] gap-1 px-6 lg:px-10">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={tab.key === active ? "page" : undefined}
                className={[
                  "border-b-2 px-4 py-3 text-sm font-medium transition",
                  tab.key === active ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
