import { fail, handle, json, readJsonBody } from "../../../../../lib/api.js";
import { confirmMapping, type MappingInput } from "../../../../../lib/ingestion/store.js";

/** 提交人工映射：{ mappings: [{ sheet, type, headerRow, columns: { 字段: 列序号 } }] }，重跑校验 */
export function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const body = await readJsonBody<{ mappings?: unknown }>(request);
    if (!Array.isArray(body.mappings)) {
      return fail("缺少 mappings 数组");
    }
    const mappings = body.mappings.map((item): MappingInput => {
      const entry = item as Record<string, unknown>;
      return {
        sheet: String(entry.sheet ?? ""),
        type: entry.type === null || entry.type === undefined ? null : String(entry.type),
        headerRow: Number(entry.headerRow),
        columns:
          entry.columns && typeof entry.columns === "object"
            ? Object.fromEntries(
                Object.entries(entry.columns as Record<string, unknown>).map(([key, value]) => [
                  key,
                  value === null || value === undefined || value === "" ? null : Number(value),
                ]),
              )
            : undefined,
      };
    });
    return json(await confirmMapping((await ctx.params).id, mappings));
  });
}
