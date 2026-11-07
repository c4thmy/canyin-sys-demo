"use client";

import Link from "next/link";

import type { BatchStatus } from "../../lib/ingestion/store.js";
import { jsonInit, useApi } from "./useApi.js";

/** 批次行操作：已生效 → 回滚；未生效 → 继续导入 / 删除 */
export function BatchActions({ id, status }: { id: string; status: BatchStatus }) {
  const { call, pending, error } = useApi();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === "active" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("回滚后，该批次写入的数据将被撤销，数据集恢复到导入它之前的状态。确定回滚？")) {
              void call(`/api/ingestion/batches/${id}/rollback`, jsonInit("POST"));
            }
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-down hover:text-down disabled:opacity-50"
        >
          回滚
        </button>
      ) : (
        <>
          {status === "analyzed" || status === "rolled_back" ? (
            <Link
              href={`/data/import?batch=${id}`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700"
            >
              {status === "rolled_back" ? "重新导入" : "继续导入"}
            </Link>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("删除后原始文件与校验报告一并移除，不可恢复。确定删除？")) {
                void call(`/api/ingestion/batches/${id}`, { method: "DELETE" });
              }
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-down disabled:opacity-50"
          >
            删除
          </button>
        </>
      )}
      {error ? <p role="alert" className="w-full text-right text-xs text-down">{error}</p> : null}
    </div>
  );
}
