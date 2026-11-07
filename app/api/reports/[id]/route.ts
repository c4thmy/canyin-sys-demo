import { handle, json } from "../../../lib/api.js";
import { deleteReport, readReport } from "../../../lib/report/store.js";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_request: Request, ctx: Ctx): Promise<Response> {
  return handle(async () => json(readReport((await ctx.params).id)));
}

export function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  return handle(async () => {
    deleteReport((await ctx.params).id);
    return new Response(null, { status: 204 });
  });
}
