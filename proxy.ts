import { NextResponse, type NextRequest } from "next/server";

/**
 * 可选的 HTTP Basic Auth（tasks 7.4）。
 *
 * - 设置环境变量 `CANYIN_BASIC_AUTH="用户名:密码"` 后，全站页面与 /api 都需要登录；
 * - 未设置时直接放行，本地演示行为不变。
 * - Basic Auth 明文传输凭据，公网部署必须同时启用 HTTPS。
 */

function safeEqual(a: string, b: string): boolean {
  // 长度不同也走完整比较，避免按长度泄露信息
  let diff = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function credentialsOf(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return null;
  }
  try {
    return atob(header.slice(6).trim());
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const expected = process.env.CANYIN_BASIC_AUTH;
  if (!expected) {
    return NextResponse.next();
  }
  const given = credentialsOf(request);
  if (given !== null && safeEqual(given, expected)) {
    return NextResponse.next();
  }
  return new NextResponse("需要登录", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="canyin-ops", charset="UTF-8"' },
  });
}

export const config = {
  // 静态资源不拦截
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
