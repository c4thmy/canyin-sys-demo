"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { jsonInit, useApi } from "../data/useApi.js";

/** 生成报告：选模板、可选标题；成功后跳转到报告预览 */
export function GenerateReport({
  templates,
  periodLabel,
  disabled,
}: {
  templates: readonly { id: string; name: string; description: string }[];
  periodLabel: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const { call, pending, error } = useApi();

  const submit = async () => {
    const result = await call<{ id: string }>("/api/reports", jsonInit("POST", { templateId, title }), false);
    if (result) {
      router.push(`/reports/${result.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-600">报告模板</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <label
              key={template.id}
              className={[
                "cursor-pointer rounded-xl border px-4 py-3 transition",
                template.id === templateId ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500" : "border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              <input
                type="radio"
                name="template"
                value={template.id}
                checked={template.id === templateId}
                onChange={() => setTemplateId(template.id)}
                className="sr-only"
              />
              <span className="block text-base font-semibold text-slate-900">{template.name}</span>
              <span className="mt-0.5 block text-sm text-slate-500">{template.description}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[280px] flex-1 text-sm text-slate-600">
          <span className="mb-1 block">标题（可选）</span>
          <input
            type="text"
            maxLength={80}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={`${periodLabel}经营分析报告`}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || pending || !templateId}
          className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "生成中…" : `生成 ${periodLabel} 报告`}
        </button>
      </div>
      {error ? <p role="alert" className="text-sm text-down">{error}</p> : null}
    </div>
  );
}
