"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { StructureView } from "../../lib/structure-view.js";
import { ChannelPanel } from "../channel/ChannelPanel.js";
import { RegionPanel } from "./RegionPanel.js";
import { SameNewPanel } from "./SameNewPanel.js";
import { StorePanel } from "./StorePanel.js";

type TabKey = "split" | "channel" | "region" | "store";

interface TabDefinition {
  readonly key: TabKey;
  readonly label: string;
  readonly hint: string;
}

export function StructureBoard({ view }: { view: StructureView }) {
  const [active, setActive] = useState<TabKey>("split");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // 支持 /revenue/structure?tab=channel 这类深链，方便投屏时直接打开某一维度
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "split" || tab === "channel" || tab === "region" || tab === "store") {
      setActive(tab);
    }
  }, []);

  const selectTab = (key: TabKey): void => {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url.toString());
  };

  const tabs: readonly (TabDefinition & { count: number })[] = [
    { key: "split", label: "同店/新店", hint: "经营增量与开店增量", count: view.counts.total },
    { key: "channel", label: "渠道", hint: `${view.counts.channels} 个渠道同比`, count: view.counts.channels },
    { key: "region", label: "区域", hint: "区域汇总与成员门店", count: view.counts.regions },
    { key: "store", label: "门店", hint: `${view.counts.total} 家门店排名`, count: view.counts.total },
  ];

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let next = index;
    if (event.key === "ArrowRight") {
      next = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      next = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    selectTab(tabs[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-6">
      <div className="card-surface rounded-2xl p-2">
        <div role="tablist" aria-label="收入结构维度" className="flex flex-wrap gap-1.5">
          {tabs.map((tab, index) => {
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`structure-tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`structure-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                onClick={() => selectTab(tab.key)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={[
                  "flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-body font-medium transition lg:px-5",
                  isActive
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")}
              >
                <span>{tab.label}</span>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 font-mono text-micro tabular-nums",
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {tab.count}
                </span>
                <span
                  className={[
                    "hidden text-xs font-normal xl:inline",
                    isActive ? "text-teal-50/90" : "text-slate-400",
                  ].join(" ")}
                >
                  {tab.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`structure-panel-${active}`}
        aria-labelledby={`structure-tab-${active}`}
        tabIndex={0}
        className="focus-visible:outline-none"
      >
        {active === "split" ? <SameNewPanel view={view} /> : null}
        {active === "channel" ? (
          <ChannelPanel
            rows={view.channels}
            unit={view.unit}
            totalCurrent={view.channelTotal.current}
            totalPrevious={view.channelTotal.previous}
            storeTotal={view.split.total.current}
            description={`${view.counts.channels} 个渠道 · 可点击「本期收入」或「同比差额」表头切换排序 · 条形图与表格顺序同步`}
          />
        ) : null}
        {active === "region" ? <RegionPanel regions={view.regions} unit={view.unit} /> : null}
        {active === "store" ? <StorePanel stores={view.stores} unit={view.unit} /> : null}
      </div>
    </div>
  );
}
