"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/** 调用本站 API 的小工具：统一错误文案、请求中状态，成功后刷新服务端组件 */
export function useApi() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async <T,>(url: string, init?: RequestInit, refresh = true): Promise<T | null> => {
      setPending(true);
      setError(null);
      try {
        const response = await fetch(url, init);
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? `请求失败（${response.status}）`);
          return null;
        }
        const data = response.status === 204 ? null : ((await response.json()) as T);
        if (refresh) {
          router.refresh();
        }
        return data;
      } catch {
        setError("网络错误，请稍后重试");
        return null;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { call, pending, error, setError };
}

export function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}
