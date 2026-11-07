import type { Report, ReportBlock } from "./build.js";

/**
 * 报告导出为独立 HTML：内联样式 + 内联 SVG 图表，离线可打开；
 * 打印时每章分页，可直接「打印 → 存为 PDF」。
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const multiline = (text: string) => escapeHtml(text).replace(/\n/g, "<br>");

/** SVG 来自服务端 ECharts 渲染；仍去掉 script 与事件属性，防止快照被篡改后注入 */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/javascript:/gi, "");
}

function block(item: ReportBlock): string {
  switch (item.kind) {
    case "paragraph":
      return `<p>${multiline(item.text)}</p>`;
    case "kpis":
      return `<div class="kpis">${item.items
        .map((kpi) => `<div class="kpi"><div class="label">${escapeHtml(kpi.label)}</div><div class="value">${escapeHtml(kpi.value)}</div><div class="note">${escapeHtml(kpi.note)}</div></div>`)
        .join("")}</div>`;
    case "table":
      return `<table><thead><tr>${item.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${item.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;
    case "chart":
      return `<figure><figcaption>${escapeHtml(item.title)}</figcaption>${sanitizeSvg(item.svg)}</figure>`;
    case "list":
      return `<ol class="list">${item.items
        .map((entry) => `<li><strong>${escapeHtml(entry.title)}</strong>${entry.meta ? ` <span class="meta">${escapeHtml(entry.meta)}</span>` : ""}<p>${multiline(entry.detail)}</p></li>`)
        .join("")}</ol>`;
  }
}

const STYLE = `
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#0f172a;max-width:960px;margin:0 auto;padding:40px 24px;line-height:1.7}
h1{font-size:28px;margin:0}h2{font-size:20px;margin:0 0 8px}
.meta-line{color:#64748b;font-size:14px;margin-top:8px}
.headline{font-size:18px;background:#f0fdfa;border-left:4px solid #0d9488;padding:12px 16px;margin:24px 0}
section{border-top:1px solid #e2e8f0;padding-top:24px;margin-top:24px}
.conclusion{font-size:16px}.skipped{color:#b45309}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:12px 0}
.kpi{border:1px solid #e2e8f0;border-radius:10px;padding:12px}.kpi .label{color:#64748b;font-size:13px}.kpi .value{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}.kpi .note{color:#64748b;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:14px;margin:12px 0}th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left}td{font-variant-numeric:tabular-nums}th{color:#64748b;font-weight:500}
figure{margin:12px 0}figcaption{color:#475569;font-size:13px;margin-bottom:4px}figure svg{max-width:100%;height:auto}
.list li{margin-bottom:12px}.list p{margin:4px 0 0;color:#475569}.meta{color:#0f766e;font-size:12px}
footer{color:#94a3b8;font-size:12px;margin-top:40px}
@media print{body{padding:0}section{break-before:page;border:none}section:first-of-type{break-before:auto}}
`;

export function reportToHtml(report: Report): string {
  const datasetLabel = report.dataset === "demo" ? "演示数据" : "导入数据";
  const chapters = report.chapters
    .map(
      (chapter, index) => `<section><h2>${index + 1}. ${escapeHtml(chapter.title)}</h2><p class="conclusion${chapter.skipped ? " skipped" : ""}">${escapeHtml(chapter.conclusion)}</p>${
        chapter.skipped
          ? `<p class="meta-line">缺少：${escapeHtml([...new Set(chapter.missing.map((item) => `${item.name}（${item.period.label}）`))].join("、"))}</p>`
          : chapter.blocks.map(block).join("")
      }</section>`,
    )
    .join("");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(report.title)}</title><style>${STYLE}</style></head>
<body>
<h1>${escapeHtml(report.title)}</h1>
<div class="meta-line">${escapeHtml(report.period.currentLabel)} 对比 ${escapeHtml(report.period.previousLabel)} · ${escapeHtml(report.templateName)} · ${datasetLabel} · 单位：${escapeHtml(report.unit)} · 生成于 ${escapeHtml(report.createdAt.slice(0, 19).replace("T", " "))} UTC</div>
<p class="headline">${escapeHtml(report.headline)}</p>
${chapters}
<footer>数据来源：${escapeHtml(report.sourceFile)} · 报告编号 ${escapeHtml(report.id)} · 由餐饮经营分析系统自动生成</footer>
</body></html>`;
}
