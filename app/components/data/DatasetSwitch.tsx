"use client";

import { jsonInit, useApi } from "./useApi.js";

/** 数据集切换：演示数据 / 已导入数据 */
export function DatasetSwitch({ active, hasImported }: { active: "demo" | "imported"; hasImported: boolean }) {
  const { call, pending, error } = useApi();
  const options = [
    { id: "demo" as const, label: "演示数据", note: "Excel 抽取的 15 家门店样例", disabled: false },
    { id: "imported" as const, label: "已导入数据", note: hasImported ? "由已生效批次合并" : "尚未导入", disabled: !hasImported },
  ];

  return (
    <div>
      <div role="radiogroup" aria-label="当前数据集" className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const checked = option.id === active;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={option.disabled || pending}
              onClick={() => !checked && call("/api/dataset/active", jsonInit("PUT", { dataset: option.id }))}
              className={[
                "rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500" : "border-slate-200 bg-white hover:border-slate-300",
              ].join(" ")}
            >
              <span className="block text-base font-semibold text-slate-900">{option.label}</span>
              <span className="mt-0.5 block text-sm text-slate-500">{option.note}</span>
            </button>
          );
        })}
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-down">{error}</p> : null}
    </div>
  );
}
