import type { Metadata } from "next";
import Link from "next/link";

import { Panel } from "../components/Panel.js";
import { GenerateReport } from "../components/report/GenerateReport.js";
import { ReportsHeader } from "../components/report/ReportsHeader.js";
import { formatTime } from "../lib/data-view.js";
import { analysisPeriods } from "../lib/dataset-status.js";
import { listReports } from "../lib/report/store.js";
import { REPORT_TEMPLATES } from "../lib/report/templates.js";
import { loadSeed } from "../lib/seed.js";
import { LAYOUT, TYPE } from "../lib/theme.js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "分析报告 · 餐饮经营分析",
  description: "按老板版 / 运营版模板生成章节化经营分析报告，可预览、打印与导出。",
};

export default function Page() {
  const seed = loadSeed();
  const selected = analysisPeriods(seed);
  const reports = listReports();

  return (
    <main className="min-h-screen">
      <ReportsHeader title="分析报告" active="all" subtitle="基于当前数据集生成，生成后内容固定，不随之后的导入变化" />

      <div className={LAYOUT.container}>
        <Panel
          title="生成报告"
          description={`数据集：${seed.dataset === "demo" ? "演示数据" : "已导入数据"} · 期间：${selected ? `${selected.current.label} 对比 ${selected.previous.label}` : "暂无"}。缺数据的章节会标注「数据不足，本章略」。`}
        >
          <GenerateReport
            templates={REPORT_TEMPLATES.map((template) => ({ id: template.id, name: template.name, description: template.description }))}
            periodLabel={selected?.current.label ?? ""}
            disabled={!selected}
          />
        </Panel>

        <Panel title="全部报告" description={`共 ${reports.length} 份`}>
          {reports.length === 0 ? (
            <p className={TYPE.note}>还没有生成过报告。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
                    <th scope="col" className="py-2 pr-3 font-medium">标题</th>
                    <th scope="col" className="py-2 pr-3 font-medium">模板</th>
                    <th scope="col" className="py-2 pr-3 font-medium">期间</th>
                    <th scope="col" className="py-2 pr-3 font-medium">数据集</th>
                    <th scope="col" className="py-2 pr-3 font-medium">章节</th>
                    <th scope="col" className="py-2 font-medium">生成时间</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-3">
                        <Link href={`/reports/${report.id}`} className="font-medium text-slate-800 hover:text-teal-700 hover:underline">
                          {report.title}
                        </Link>
                      </td>
                      <td className="py-3 pr-3 text-sm text-slate-600">{report.templateName}</td>
                      <td className="py-3 pr-3 text-sm text-slate-600">{report.period.currentLabel}</td>
                      <td className="py-3 pr-3 text-sm text-slate-600">{report.dataset === "demo" ? "演示数据" : "已导入数据"}</td>
                      <td className="py-3 pr-3 text-sm text-slate-600">
                        {report.chapterCount} 章
                        {report.skippedCount > 0 ? <span className="ml-1 text-amber-700">（{report.skippedCount} 章数据不足）</span> : null}
                      </td>
                      <td className="py-3 text-sm text-slate-500">{formatTime(report.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
