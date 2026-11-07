"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { SheetPlan } from "../../lib/ingestion/detect.js";
import type { BatchInfo } from "../../lib/ingestion/store.js";
import { TEMPLATES, fieldHeader, type TemplateType } from "../../lib/ingestion/templates.js";
import type { Issue } from "../../lib/ingestion/validate.js";
import { LAYOUT, TYPE } from "../../lib/theme.js";
import { jsonInit, useApi } from "./useApi.js";

const STEPS = ["上传文件", "确认映射", "校验报告", "生效"] as const;

const MATCH_LABELS: Record<string, string> = {
  exact: "完全匹配",
  alias: "别名匹配",
  normalized: "近似匹配",
  manual: "手工指定",
};

const CONFIDENCE_LABELS: Record<SheetPlan["confidence"], { text: string; tone: string }> = {
  full: { text: "完全匹配", tone: "bg-up-soft text-up" },
  partial: { text: "部分别名，请确认", tone: "bg-amber-50 text-amber-700" },
  none: { text: "缺少必填字段", tone: "bg-down-soft text-down" },
};

interface Draft {
  type: TemplateType | null;
  headerRow: number;
  columns: Record<string, number | null>;
}

function draftOf(plan: SheetPlan): Draft {
  return {
    type: plan.type,
    headerRow: plan.headerRow,
    columns: Object.fromEntries(plan.matches.map((match) => [match.fieldKey, match.column])),
  };
}

function stepOf(batch: BatchInfo | null): number {
  if (!batch) {
    return 0;
  }
  if (batch.status === "active") {
    return 3;
  }
  return batch.summary && batch.summary.errors === 0 ? 2 : 1;
}

/** 四步导入向导：上传 → 映射确认 → 校验报告 → 生效 */
export function ImportWizard({ initial }: { initial: BatchInfo | null }) {
  const [batch, setBatch] = useState<BatchInfo | null>(initial);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries((initial?.plans ?? []).map((plan) => [plan.sheet, draftOf(plan)])),
  );
  const [file, setFile] = useState<File | null>(null);
  const { call, pending, error, setError } = useApi();
  const step = stepOf(batch);

  const accept = (next: BatchInfo | null) => {
    if (next) {
      setBatch(next);
      setDrafts(Object.fromEntries(next.plans.map((plan) => [plan.sheet, draftOf(plan)])));
    }
  };

  const upload = async () => {
    if (!file) {
      setError("请先选择文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("文件超过 10 MB");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    accept(await call<BatchInfo>("/api/ingestion/upload", { method: "POST", body: form }, false));
  };

  const confirm = async () => {
    if (!batch) {
      return;
    }
    const mappings = Object.entries(drafts).map(([sheet, draft]) => ({
      sheet,
      type: draft.type,
      headerRow: draft.headerRow,
      columns: draft.columns,
    }));
    accept(await call<BatchInfo>(`/api/ingestion/batches/${batch.id}/confirm-mapping`, jsonInit("POST", { mappings }), false));
  };

  const execute = async () => {
    if (!batch) {
      return;
    }
    accept(await call<BatchInfo>(`/api/ingestion/batches/${batch.id}/execute`, jsonInit("POST")));
  };

  const updateDraft = (sheet: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [sheet]: { ...current[sheet], ...patch } }));

  const errors = useMemo(() => batch?.issues.filter((issue) => issue.level === "error") ?? [], [batch]);
  const warnings = useMemo(() => batch?.issues.filter((issue) => issue.level === "warning") ?? [], [batch]);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="导入步骤">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={[
              "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium",
              index < step
                ? "border-teal-200 bg-teal-50 text-teal-700"
                : index === step
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-slate-200 text-slate-400",
            ].join(" ")}
          >
            <span className="font-mono text-xs">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="rounded-xl border border-down/30 bg-down-soft px-4 py-3 text-sm text-down">
          {error}
        </p>
      ) : null}

      {/* 1. 上传 */}
      <section className={`${LAYOUT.card} ${LAYOUT.cardPadding}`}>
        <h2 className={TYPE.sectionTitle}>1. 上传文件</h2>
        <p className={`mt-1 ${TYPE.note}`}>
          支持 .xlsx 与 .csv，单文件不超过 10 MB。一个 xlsx 可以包含多套模板（每套一张工作表）。还没有模板？
          <Link href="/data/templates" className="text-teal-700 underline-offset-2 hover:underline">
            先下载模板
          </Link>
          。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="upload-file">
            选择导入文件
          </label>
          <input
            id="upload-file"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <button
            type="button"
            onClick={upload}
            disabled={pending || !file}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {pending && step === 0 ? "上传中…" : "上传并解析"}
          </button>
        </div>
        {batch ? (
          <p className="mt-3 text-sm text-slate-600">
            当前批次 <span className="font-mono">{batch.id}</span> · {batch.fileName}
            {batch.failure ? <span className="ml-2 text-down">解析失败：{batch.failure}</span> : null}
          </p>
        ) : null}
      </section>

      {/* 2. 映射 */}
      {batch && batch.plans.length > 0 && batch.status !== "active" ? (
        <section className={`${LAYOUT.card} ${LAYOUT.cardPadding}`}>
          <h2 className={TYPE.sectionTitle}>2. 确认映射</h2>
          <p className={`mt-1 ${TYPE.note}`}>系统已自动识别模板与列。可以改模板、表头行或任一字段对应的列，改完点「应用映射并重新校验」。</p>
          <div className="mt-5 space-y-5">
            {batch.plans.map((plan) => {
              const draft = drafts[plan.sheet] ?? draftOf(plan);
              const template = TEMPLATES.find((item) => item.type === draft.type) ?? null;
              const confidence = CONFIDENCE_LABELS[plan.confidence];
              return (
                <div key={plan.sheet} className={`${LAYOUT.inset} p-4`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className={TYPE.cardTitle}>工作表「{plan.sheet}」</h3>
                    {plan.type ? (
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${confidence.tone}`}>{confidence.text}</span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">未识别 / 跳过</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <label className="text-sm text-slate-600">
                      <span className="mb-1 block">模板</span>
                      <select
                        value={draft.type ?? ""}
                        onChange={(event) =>
                          updateDraft(plan.sheet, { type: (event.target.value || null) as TemplateType | null, columns: {} })
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                      >
                        <option value="">不导入此工作表</option>
                        {TEMPLATES.map((item) => (
                          <option key={item.type} value={item.type}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-600">
                      <span className="mb-1 block">表头所在行</span>
                      <input
                        type="number"
                        min={1}
                        value={draft.headerRow}
                        onChange={(event) => updateDraft(plan.sheet, { headerRow: Math.max(1, Number(event.target.value) || 1) })}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                  {template && draft.headerRow === plan.headerRow && plan.type === draft.type ? (
                    <table className="mt-4 w-full text-left">
                      <thead>
                        <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
                          <th scope="col" className="py-2 pr-3 font-medium">模板字段</th>
                          <th scope="col" className="py-2 pr-3 font-medium">对应列</th>
                          <th scope="col" className="py-2 font-medium">匹配方式</th>
                        </tr>
                      </thead>
                      <tbody>
                        {template.fields.map((field) => {
                          const match = plan.matches.find((item) => item.fieldKey === field.key);
                          const column = draft.columns[field.key] ?? null;
                          const changed = column !== (match?.column ?? null);
                          return (
                            <tr key={field.key} className="border-b border-slate-100 last:border-0">
                              <th scope="row" className="py-2 pr-3 text-sm font-medium text-slate-800">
                                {fieldHeader(field)}
                                {field.required ? <span className="ml-1 text-down" aria-label="必填">*</span> : null}
                              </th>
                              <td className="py-2 pr-3">
                                <select
                                  aria-label={`${field.label}对应的列`}
                                  value={column ?? ""}
                                  onChange={(event) =>
                                    updateDraft(plan.sheet, {
                                      columns: { ...draft.columns, [field.key]: event.target.value === "" ? null : Number(event.target.value) },
                                    })
                                  }
                                  className={[
                                    "w-full max-w-xs rounded-lg border bg-white px-3 py-1.5 text-sm",
                                    column === null && field.required ? "border-down/50" : "border-slate-300",
                                  ].join(" ")}
                                >
                                  <option value="">（不映射）</option>
                                  {plan.headers.map((header, index) =>
                                    header ? (
                                      <option key={index} value={index}>
                                        第 {index + 1} 列：{header}
                                      </option>
                                    ) : null,
                                  )}
                                </select>
                              </td>
                              <td className="py-2 text-sm text-slate-500">
                                {changed ? "手工指定（待应用）" : match?.kind ? MATCH_LABELS[match.kind] : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : draft.type ? (
                    <p className={`mt-3 ${TYPE.note}`}>模板或表头行已修改，点「应用映射并重新校验」后显示字段映射。</p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="mt-5 rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
          >
            应用映射并重新校验
          </button>
        </section>
      ) : null}

      {/* 3. 校验报告 */}
      {batch?.summary ? (
        <section className={`${LAYOUT.card} ${LAYOUT.cardPadding}`}>
          <h2 className={TYPE.sectionTitle}>3. 校验报告</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              { label: "可导入行", value: batch.summary.rows, tone: "text-slate-900" },
              { label: "错误（阻断）", value: batch.summary.errors, tone: batch.summary.errors > 0 ? "text-down" : "text-slate-900" },
              { label: "警告（可继续）", value: batch.summary.warnings, tone: batch.summary.warnings > 0 ? "text-amber-600" : "text-slate-900" },
              { label: "跳过的示例行", value: batch.summary.skippedExamples, tone: "text-slate-500" },
            ].map((item) => (
              <div key={item.label} className={`${LAYOUT.inset} px-4 py-3`}>
                <dt className="text-sm text-slate-500">{item.label}</dt>
                <dd className={`mt-1 ${TYPE.numberSm} ${item.tone}`}>{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className={`mt-3 ${TYPE.note}`}>
            模板：{batch.summary.templates.map((type) => TEMPLATES.find((item) => item.type === type)?.name ?? type).join("、") || "—"} · 期间：
            {batch.summary.periods.join("、") || "—"}
          </p>
          {errors.length > 0 ? <IssueTable title="错误" issues={errors} tone="text-down" /> : null}
          {warnings.length > 0 ? <IssueTable title="警告" issues={warnings} tone="text-amber-700" /> : null}
          {batch.issues.length === 0 ? <p className="mt-4 text-sm text-up">未发现问题。</p> : null}
        </section>
      ) : null}

      {/* 4. 生效 */}
      {batch?.summary ? (
        <section className={`${LAYOUT.card} ${LAYOUT.cardPadding}`}>
          <h2 className={TYPE.sectionTitle}>4. 生效</h2>
          {batch.status === "active" ? (
            <div className="mt-3 space-y-3">
              <p className="text-base text-up">已生效。当前数据集已切换为「已导入数据」，所有分析页与看板按新数据计算。</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
                  查看数据看板
                </Link>
                <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400">
                  经营总览
                </Link>
                <Link href="/data" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800">
                  管理批次 / 回滚
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className={TYPE.body}>
                {batch.summary.errors > 0
                  ? "校验报告中仍有错误，请修改文件后重新上传，或调整映射后重新校验。"
                  : `确认后写入 ${batch.summary.rows} 行数据；同一主键以本批次为准，之后可在数据中心回滚。`}
              </p>
              <button
                type="button"
                onClick={execute}
                disabled={pending || batch.summary.errors > 0 || batch.summary.rows === 0}
                className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "处理中…" : "确认导入"}
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function IssueTable({ title, issues, tone }: { title: string; issues: readonly Issue[]; tone: string }) {
  return (
    <div className="mt-5">
      <h3 className={`text-base font-semibold ${tone}`}>
        {title}（{issues.length}）
      </h3>
      <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr className={TYPE.tableHead}>
              <th scope="col" className="px-3 py-2 font-medium">工作表</th>
              <th scope="col" className="px-3 py-2 font-medium">行号</th>
              <th scope="col" className="px-3 py-2 font-medium">字段</th>
              <th scope="col" className="px-3 py-2 font-medium">问题</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => (
              <tr key={index} className="border-t border-slate-100">
                <td className="px-3 py-1.5 text-slate-600">{issue.sheet ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono text-slate-600">{issue.row ?? "—"}</td>
                <td className="px-3 py-1.5 text-slate-600">{issue.field ?? "—"}</td>
                <td className="px-3 py-1.5 text-slate-800">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
