import type { Report, ReportBlock } from "../../lib/report/build.js";
import { sanitizeSvg } from "../../lib/report/html.js";
import { LAYOUT, TYPE } from "../../lib/theme.js";

/** 报告正文：页面预览与打印共用；每章在打印时另起一页 */

function Block({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p className={`whitespace-pre-line ${TYPE.body}`}>{block.text}</p>;
    case "kpis":
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {block.items.map((item) => (
            <div key={item.label} className={`${LAYOUT.inset} px-4 py-3`}>
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className={`mt-1 ${TYPE.numberSm} text-slate-900`}>{item.value}</p>
              <p className="mt-1 text-xs text-slate-500">{item.note}</p>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b border-slate-200 ${TYPE.tableHead}`}>
                {block.columns.map((column) => (
                  <th key={column} scope="col" className="py-2 pr-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, index) => (
                <tr key={index} className="border-b border-slate-100 last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className={`py-2 pr-3 text-sm ${cellIndex === 0 ? "text-slate-800" : "font-mono tabular-nums text-slate-700"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "chart":
      return (
        <figure>
          <figcaption className={TYPE.caption}>{block.title}</figcaption>
          {/* SVG 由服务端 ECharts 渲染并已清洗（去 script / 事件属性） */}
          <div
            role="img"
            aria-label={block.title}
            className="mt-2 w-full overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: sanitizeSvg(block.svg) }}
          />
        </figure>
      );
    case "list":
      return (
        <ol className="space-y-3">
          {block.items.map((item, index) => (
            <li key={index} className={`${LAYOUT.inset} px-4 py-3`}>
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm text-slate-400">{index + 1}</span>
                <span className="text-base font-semibold text-slate-900">{item.title}</span>
                {item.meta ? <span className="text-xs font-medium text-teal-700">{item.meta}</span> : null}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{item.detail}</p>
            </li>
          ))}
        </ol>
      );
  }
}

export function ReportBody({ report }: { report: Report }) {
  return (
    <div className="space-y-6">
      <section className={`${LAYOUT.card} ${LAYOUT.cardPadding} relative overflow-hidden`}>
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-teal-400 to-blue-500" />
        <h2 className={TYPE.calloutTitle}>总纲</h2>
        <p className={`mt-3 ${TYPE.calloutBody}`}>{report.headline}</p>
      </section>

      {report.chapters.map((chapter, index) => (
        <section key={chapter.key} className={`report-chapter ${LAYOUT.card} ${LAYOUT.cardPadding}`} aria-labelledby={`chapter-${chapter.key}`}>
          <h2 id={`chapter-${chapter.key}`} className={TYPE.sectionTitle}>
            {index + 1}. {chapter.title}
          </h2>
          <p className={`mt-2 ${chapter.skipped ? "text-amber-700" : "text-slate-800"} text-base leading-7`}>{chapter.conclusion}</p>
          {chapter.skipped ? (
            <p className={`mt-2 ${TYPE.note}`}>
              缺少：{[...new Set(chapter.missing.map((item) => `${item.name}（${item.period.label}）`))].join("、")}
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              {chapter.blocks.map((block, blockIndex) => (
                <Block key={blockIndex} block={block} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
