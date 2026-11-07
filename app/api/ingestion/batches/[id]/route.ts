import { handle, json } from "../../../../lib/api.js";
import { deleteBatch, getBatch } from "../../../../lib/ingestion/store.js";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_request: Request, ctx: Ctx): Promise<Response> {
  return handle(async () => json(getBatch((await ctx.params).id)));
}

export function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  return handle(async () => {
    await deleteBatch((await ctx.params).id);
    return new Response(null, { status: 204 });
  });
}
