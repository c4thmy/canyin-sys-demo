import { handle } from "../../../../../lib/api.js";
import { reportToHtml } from "../../../../../lib/report/html.js";
import { readReport } from "../../../../../lib/report/store.js";

/** 导出独立 HTML（图表为内联 SVG，离线可看，可打印为 PDF） */
export function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const report = readReport((await ctx.params).id);
    const fileName = encodeURIComponent(`${report.title}.html`);
    return new Response(reportToHtml(report), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${report.id}.html"; filename*=UTF-8''${fileName}`,
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
        "Cache-Control": "no-store",
      },
    });
  });
}
