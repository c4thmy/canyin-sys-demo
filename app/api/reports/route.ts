import { fail, handle, json, readJsonBody } from "../../lib/api.js";
import { buildReport, ReportError } from "../../lib/report/build.js";
import { listReports, saveReport } from "../../lib/report/store.js";

export function GET(): Promise<Response> {
  return handle(() => json(listReports()));
}

/** 生成报告：{ templateId: "boss" | "operations", title? }；基于当前数据集最新期间 */
export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readJsonBody<{ templateId?: unknown; title?: unknown }>(request);
    try {
      const report = buildReport({
        templateId: String(body.templateId ?? ""),
        title: typeof body.title === "string" ? body.title : undefined,
      });
      saveReport(report);
      return json({ id: report.id }, 201);
    } catch (error) {
      if (error instanceof ReportError) {
        return fail(error.message, 422);
      }
      throw error;
    }
  });
}
