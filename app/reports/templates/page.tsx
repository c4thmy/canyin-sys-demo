import type { Metadata } from "next";

import { ReportsHeader } from "../../components/report/ReportsHeader.js";
import { REPORT_TEMPLATES } from "../../lib/report/templates.js";
import { LAYOUT, TYPE } from "../../lib/theme.js";

export const metadata: Metadata = {
  title: "报告模板 · 分析报告 · 餐饮经营分析",
  description: "老板版与运营版两套报告模板的章节目录。",
};

export default function Page() {
  return (
    <main className="min-h-screen">
      <ReportsHeader title="报告模板" active="templates" subtitle="两套模板，按受众决定章节深度与语气" />
      <div className={LAYOUT.container}>
        <div className="grid gap-6 lg:grid-cols-2">
          {REPORT_TEMPLATES.map((template) => (
            <section key={template.id} className={`${LAYOUT.card} ${LAYOUT.cardPadding}`} aria-labelledby={`tpl-${template.id}`}>
              <h2 id={`tpl-${template.id}`} className={TYPE.sectionTitle}>
                {template.name}
              </h2>
              <p className={`mt-1 ${TYPE.note}`}>{template.description}</p>
              <dl className="mt-4 grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
                <dt className="text-slate-500">受众</dt>
                <dd className="text-slate-800">{template.audience}</dd>
                <dt className="text-slate-500">语气</dt>
                <dd className="text-slate-800">{template.tone}</dd>
              </dl>
              <ol className="mt-5 space-y-2">
                {template.chapters.map((chapter, index) => (
                  <li key={chapter.key} className={`${LAYOUT.inset} flex gap-3 px-4 py-3`}>
                    <span className="font-mono text-sm text-slate-400">{index + 1}</span>
                    <span>
                      <span className="block text-base font-medium text-slate-900">{chapter.title}</span>
                      <span className="text-sm text-slate-500">{chapter.description}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
