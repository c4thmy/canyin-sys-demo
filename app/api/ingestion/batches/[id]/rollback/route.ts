import { handle, json } from "../../../../../lib/api.js";
import { rollbackBatch } from "../../../../../lib/ingestion/store.js";

export function POST(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => json(await rollbackBatch((await ctx.params).id)));
}
