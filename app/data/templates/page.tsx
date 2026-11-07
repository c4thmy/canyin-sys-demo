import type { Metadata } from "next";

import { DataCenterHeader } from "../../components/data/DataCenterHeader.js";
import { fieldHeader, TEMPLATES } from "../../lib/ingestion/templates.js";
import { LAYOUT, TYPE } from "../../lib/theme.js";

export const metadata: Metadata = {
  title: "模板下载 · 数据中心 · 餐饮经营分析",
  description: "6 套标准数据导入模板，含字段说明与示例行。",
};

export default function Page() {
  return (
    <main className="min-h-screen">
      <DataCenterHeader title="模板下载" active="templates" subtitle="6 套标准导入模板，每套含字段说明页与一行示例" />

      <div className={LAYOUT.container}>
        <section aria-label="导入模板" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((template) => {
            const required = template.fields.filter((field) => field.required).length;
            return (
              <article key={template.type} className={`${LAYOUT.card} flex flex-col p-6`}>
                <h2 className={TYPE.cardTitle}>{template.name}</h2>
                <p className={`mt-1 ${TYPE.note}`}>{template.description}</p>
                <p className="mt-3 text-sm text-slate-600">
                  {template.fields.length} 个字段（必填 {required} 个）
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {template.fields.map((field) => (
                    <li
                      key={field.key}
                      className={[
                        "rounded-md px-2 py-0.5 text-xs",
                        field.required ? "bg-slate-100 text-slate-700" : "border border-dashed border-slate-300 text-slate-500",
                      ].join(" ")}
                    >
                      {fieldHeader(field)}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-5">
                  <a
                    href={`/api/templates/${template.type}/download`}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    <span aria-hidden="true">↓</span>
                    {`下载 ${template.name}模板`}
                  </a>
                </div>
              </article>
            );
          })}
        </section>

        <section className={`${LAYOUT.card} ${LAYOUT.cardPadding}`}>
          <h2 className={TYPE.calloutTitle}>填写须知</h2>
          <ul className={`mt-3 space-y-1.5 ${TYPE.body}`}>
            <li>· 期间按月填写，格式 YYYY-MM（如 2025-09）；也接受 2025/09、2025年9月、202509。</li>
            <li>· 收入、成本、金额单位为万元；客流为人次；客单价与单价为元。</li>
            <li>· 第 2 行是示例（以「示例-」开头），可直接覆盖，保留也不会被导入。</li>
            <li>· 表头可以用常见叫法（如「营业额」），系统会自动识别，上传后也能手工调整映射。</li>
            <li>· 多套模板可以放进同一个 xlsx 的不同工作表一次上传，也可以分多次上传；同一门店同一月份以最后一次为准。</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
