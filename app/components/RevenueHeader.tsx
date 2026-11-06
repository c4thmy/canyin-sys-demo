import Link from "next/link";
import type { ReactNode } from "react";

import type { SeedPeriod } from "../lib/seed.js";
import { PeriodSwitch } from "./PeriodSwitch.js";

const NAV = [
  { key: "overview", href: "/", label: "经营总览" },
  { key: "structure", href: "/revenue/structure", label: "收入结构" },
  { key: "same-store", href: "/revenue/same-store", label: "同店异动" },
  { key: "channel", href: "/revenue/channel", label: "渠道下钻" },
  { key: "product", href: "/revenue/product", label: "产品下钻" },
] as const;

export type RevenueNavKey = (typeof NAV)[number]["key"];

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
      <div className="mx-auto max-w-[1440px] px-6 py-10 lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
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
            <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-teal-300">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white lg:text-5xl">
              {title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-lg text-slate-300">
              {subtitle}
              <span className="rounded-full border border-white/15 px-3 py-1 text-sm text-slate-300">
                单位：{unit}
              </span>
            </div>
          </div>

          <div className="lg:text-right">
            <nav aria-label="收入分析导航" className="mb-4 flex flex-wrap gap-2 lg:justify-end">
              {NAV.map((item) => {
                const isActive = item.key === active;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "rounded-full border px-3 py-1.5 text-[13px] font-medium transition lg:px-3.5",
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
            <p className="mb-2 text-xs tracking-wide text-slate-400">期间（固定两期对比）</p>
            <PeriodSwitch periods={periods} activeId={activePeriodId} />
            <p className="mt-2 text-xs text-slate-500">上年同期：{previousLabel}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
