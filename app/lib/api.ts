import { StoreError } from "./ingestion/store.js";

/**
 * Route Handler 公共工具：统一 JSON 响应与错误码。
 *
 * 安全提示：默认不鉴权，仅适合本地 / 内网演示；公网部署须设置
 * CANYIN_BASIC_AUTH 启用 proxy.ts 的 Basic Auth，并配合 HTTPS。
 */

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** 包一层错误处理：业务错误返回其状态码，其余返回 500 且不泄露堆栈 */
export async function handle(task: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof StoreError) {
      return fail(error.message, error.status);
    }
    if (error instanceof SyntaxError) {
      return fail("请求体不是合法的 JSON", 400);
    }
    console.error(error);
    return fail("服务器内部错误", 500);
  }
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (text.length > 1024 * 1024) {
    throw new StoreError("请求体过大", 413);
  }
  return (text === "" ? {} : JSON.parse(text)) as T;
}
