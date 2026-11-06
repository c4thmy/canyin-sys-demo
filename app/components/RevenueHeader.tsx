import Link from "next/link";
import type { ReactNode } from "react";

import type { SeedPeriod } from "../lib/seed.js";
import { LAYOUT, TYPE } from "../lib/theme.js";
import { PeriodSwitch } from "./PeriodSwitch.js";

const NAV = [
  { key: "overview", href: "/", label: "经营总览" },
  { key: "structure", href: "/revenue/structure", label: "收入结构" },
  { key: "same-store", href: "/revenue/same-store", label: "同店异动" },
  { key: "channel", href: "/revenue/channel", label: "渠道下钻" },
  { key: "product", href: "/revenue/product", label: "产品下钻" },
  { key: "insights", href: "/insights", label: "结论与计划" },
] as const;

export type RevenueNavKey = (typeof NAV)[number]["key"];

/**
 * 全站统一页头：标题区 + 期间切换 + 独立一行的导航胶囊。
 *
 * 导航放在标题下单独一行、且不换行（`flex-nowrap` + `whitespace-nowrap`），
 * 保证 1280 宽度下 6 个胶囊仍在一行；更窄的屏幕横向滚动而不是折行。
 */
export function RevenueHeader({
  title,
  subtitle,
  active,
  periods,
  activePeriodId,
  previousLabel,
  unit,
  eyebrow = "Revenue Analysis · 收入分析",
  back,
}: {
  title: string;
  subtitle: ReactNode;
  active?: RevenueNavKey;
  periods: readonly SeedPeriod[];
  activePeriodId: string;
  previousLabel: string;
  unit: string;
  eyebrow?: string;
  back?: { href: string; label: string };
}) {
  return (
    <header className="hero-panel">
      <div className={LAYOUT.header}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            {back ? (
              <Link
                href={back.href}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-teal-300 transition hover:text-teal-200"
              >
                <span aria-hidden="true">←</span>
                {back.label}
              </Link>
            ) : null}
            <p className={TYPE.eyebrow}>{eyebrow}</p>
            <h1 className={`mt-3 ${TYPE.pageTitle}`}>{title}</h1>
            <div className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 ${TYPE.headerMeta}`}>
              {subtitle}
              <span className="rounded-full border border-white/15 px-3 py-1 text-sm text-slate-300">
                单位：{unit}
              </span>
            </div>
          </div>

          <div className="shrink-0 lg:text-right">
            <p className="mb-2 text-xs tracking-wide text-slate-400">期间（固定两期对比）</p>
            <PeriodSwitch periods={periods} activeId={activePeriodId} />
            <p className="mt-2 text-xs text-slate-500">上年同期：{previousLabel}</p>
          </div>
        </div>

        <nav
          aria-label="收入分析导航"
          className="mt-6 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 lg:justify-end"
        >
          {NAV.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-meta font-medium transition lg:px-3.5",
                  isActive
                    ? "border-teal-300/60 bg-teal-400/15 text-teal-200"
                    : "border-white/10 text-slate-300 hover:border-white/25 hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
