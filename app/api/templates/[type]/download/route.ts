import { fail } from "../../../../lib/api.js";
import { buildTemplateWorkbook } from "../../../../lib/ingestion/template-xlsx.js";
import { getTemplate, isTemplateType } from "../../../../lib/ingestion/templates.js";

/** 下载模板 xlsx（每次请求现场生成，字段定义只来自 templates.ts） */
export async function GET(_request: Request, ctx: { params: Promise<{ type: string }> }): Promise<Response> {
  const { type } = await ctx.params;
  if (!isTemplateType(type)) {
    return fail("未知模板", 404);
  }
  const bytes = await buildTemplateWorkbook(type);
  const fileName = encodeURIComponent(`${getTemplate(type).name}导入模板.xlsx`);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${type}.xlsx"; filename*=UTF-8''${fileName}`,
      "Cache-Control": "no-store",
    },
  });
}
