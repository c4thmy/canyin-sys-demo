"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 报告预览页工具栏：打印 / 导出 HTML / 删除；打印时隐藏 */
export function ReportToolbar({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!window.confirm("删除这份报告？不可恢复。")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `删除失败（${response.status}）`);
        return;
      }
      router.push("/reports");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
      >
        打印 / 存为 PDF
      </button>
      <a
        href={`/api/reports/${id}/export/html`}
        download
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
      >
        导出 HTML
      </a>
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:text-down disabled:opacity-50"
      >
        删除
      </button>
      {error ? <p role="alert" className="text-sm text-down">{error}</p> : null}
    </div>
  );
}
