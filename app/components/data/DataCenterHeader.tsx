import Link from "next/link";

import { RevenueHeader } from "../RevenueHeader.js";
import { analysisPeriods } from "../../lib/dataset-status.js";
import { loadSeed } from "../../lib/seed.js";

const TABS = [
  { key: "overview", href: "/data", label: "数据集与批次" },
  { key: "templates", href: "/data/templates", label: "模板下载" },
  { key: "import", href: "/data/import", label: "导入数据" },
] as const;

export type DataTabKey = (typeof TABS)[number]["key"];

/** 数据中心三个子页共用的页头 + 子导航 */
export function DataCenterHeader({ title, subtitle, active }: { title: string; subtitle: string; active: DataTabKey }) {
  const seed = loadSeed();
  const selected = analysisPeriods(seed);
  return (
    <>
      <RevenueHeader
        title={title}
        eyebrow="Data Center · 数据中心"
        subtitle={<span>{subtitle}</span>}
        active="data"
        periods={selected?.periods ?? []}
        activePeriodId={selected?.current.id ?? ""}
        previousLabel={selected?.previous.label ?? "—"}
        unit={seed.meta.currency_unit ?? "万元"}
      />
      <nav aria-label="数据中心" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] gap-1 overflow-x-auto px-6 lg:px-10">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition",
                  isActive ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
