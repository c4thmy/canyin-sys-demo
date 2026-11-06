"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";

/** 整行可点击跳转的表格行；行内仍保留真实链接，键盘与读屏可用 */
export function ClickableRow({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  const go = (): void => {
    router.push(href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      go();
    }
  };

  return (
    <tr
      tabIndex={0}
      onClick={go}
      onKeyDown={onKeyDown}
      title="打开门店详情"
      className={`cursor-pointer transition-colors hover:bg-teal-50/60 focus-visible:bg-teal-50/80 ${className}`}
    >
      {children}
    </tr>
  );
}
