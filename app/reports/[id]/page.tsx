import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportBody } from "../../components/report/ReportBody.js";
import { ReportsHeader } from "../../components/report/ReportsHeader.js";
import { ReportToolbar } from "../../components/report/ReportToolbar.js";
import { formatTime } from "../../lib/data-view.js";
import { readReport } from "../../lib/report/store.js";
import type { Report } from "../../lib/report/build.js";
import { LAYOUT, TYPE } from "../../lib/theme.js";

export const dynamic = "force-dynamic";

function load(id: string): Report | null {
  try {
    return readReport(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const report = load((await params).id);
  return { title: report ? `${report.title} · 分析报告` : "分析报告" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const report = load((await params).id);
  if (!report) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <ReportsHeader title={report.title} subtitle={`${report.templateName} · ${report.period.currentLabel} 对比 ${report.period.previousLabel}`} back={{ href: "/reports", label: "返回报告列表" }} />

      <div className={LAYOUT.container}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="print-only hidden">
            <h1 className="text-3xl font-semibold text-slate-900">{report.title}</h1>
          </div>
          <p className={TYPE.note}>
            {report.dataset === "demo" ? "演示数据" : "已导入数据"} · 来源：{report.sourceFile} · 单位：{report.unit} · 生成于 {formatTime(report.createdAt)} · 编号 {report.id}
          </p>
          <ReportToolbar id={report.id} />
        </div>
        <ReportBody report={report} />
      </div>
    </main>
  );
}
