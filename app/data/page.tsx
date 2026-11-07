import type { Metadata } from "next";
import Link from "next/link";

import { BatchActions } from "../components/data/BatchActions.js";
import { DataCenterHeader } from "../components/data/DataCenterHeader.js";
import { DatasetSwitch } from "../components/data/DatasetSwitch.js";
import { CompletenessMatrix } from "../components/dashboard/CompletenessMatrix.js";
import { Panel } from "../components/Panel.js";
import { buildDataCenterView, type BatchRow } from "../lib/data-view.js";
import { LAYOUT, TYPE } from "../lib/theme.js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "数据中心 · 餐饮经营分析",
  description: "切换数据集、查看数据完整度、管理导入批次。",
};

const STATUS_TONE: Record<BatchRow["status"], string> = {
  uploaded: "bg-slate-100 text-slate-600",
  analyzed: "bg-amber-50 text-amber-700",
  active: "bg-up-soft text-up",
  rolled_back: "bg-slate-100 text-slate-500",
  failed: "bg-down-soft text-down",
};

export default function Page() {
  const view = buildDataCenterView();

  return (
    <main className="min-h-screen">
      <DataCenterHeader title="数据中心" active="overview" subtitle="下载模板 → 填数 → 上传 → 校验 → 生效，所有分析页随之更新" />

      <div className={LAYOUT.container}>
        <Panel title="当前数据集" description="所有分析页、看板与报告都基于这里选中的数据集计算。">
          <DatasetSwitch active={view.active} hasImported={view.hasImported} />
          <p className={`mt-3 ${TYPE.note}`}>
            来源：{view.sourceFile} · 期间：{view.periods.map((period) => period.label).join("、") || "—"}
          </p>
        </Panel>

        <Panel
          title="数据完整度"
          description="当前数据集中各模板在每个期间是否有数据。分析页需要本期与上年同期两期数据。"
          actions={
            <div className="flex gap-2">
              <Link href="/data/templates" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400">
                下载模板
              </Link>
              <Link href="/data/import" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
                导入数据
              </Link>
            </div>
          }
        >
          <CompletenessMatrix periods={view.completeness.periods} rows={view.completeness.rows} />
        </Panel>

        <Panel title="导入批次" description="每次上传形成一个批次。已生效批次按生效先后合并，后到覆盖先到；回滚即撤销该批次。">
          {view.batches.length === 0 ? (
            <p className={TYPE.note}>还没有导入记录。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left">
                <thead>
                  <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
                    <th scope="col" className="py-2 pr-3 font-medium">文件</th>
                    <th scope="col" className="py-2 pr-3 font-medium">上传时间</th>
                    <th scope="col" className="py-2 pr-3 font-medium">状态</th>
                    <th scope="col" className="py-2 pr-3 font-medium">模板 / 期间</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">行数</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">错误 / 警告</th>
                    <th scope="col" className="py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {view.batches.map((batch) => (
                    <tr key={batch.id} className="border-b border-slate-100 align-top last:border-0">
                      <td className="py-3 pr-3">
                        <span className="block font-medium text-slate-800">{batch.fileName}</span>
                        <span className="text-xs text-slate-400">
                          {batch.id} · {batch.sizeText}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-sm text-slate-500">{batch.uploadedAt}</td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_TONE[batch.status]}`}>{batch.statusLabel}</span>
                        {batch.failure ? <span className="mt-1 block text-xs text-down">{batch.failure}</span> : null}
                      </td>
                      <td className="py-3 pr-3 text-sm text-slate-600">
                        <span className="block">{batch.templates}</span>
                        <span className="text-xs text-slate-400">{batch.periods}</span>
                      </td>
                      <td className={`py-3 pr-3 text-right ${TYPE.numberInline}`}>{batch.rows}</td>
                      <td className={`py-3 pr-3 text-right ${TYPE.numberInline}`}>
                        <span className={batch.errors > 0 ? "text-down" : "text-slate-500"}>{batch.errors}</span>
                        <span className="text-slate-300"> / </span>
                        <span className={batch.warnings > 0 ? "text-amber-600" : "text-slate-500"}>{batch.warnings}</span>
                      </td>
                      <td className="py-3">
                        <BatchActions id={batch.id} status={batch.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <footer className={`pb-10 pt-2 ${TYPE.note}`}>
          导入数据保存在服务器 data/uploads/ 目录。注意：默认不鉴权，仅适合本地或内网演示；公网部署请设置 CANYIN_BASIC_AUTH 并启用 HTTPS。
        </footer>
      </div>
    </main>
  );
}
