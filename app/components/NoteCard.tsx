import type { ReactNode } from "react";

import { LAYOUT, TYPE } from "../lib/theme.js";

/**
 * 口径说明卡片：标题用小号大写字距，正文按段落排版。
 * 与总览页「一句话小结」同一套视觉语言，但语气更安静，读起来像脚注而不是结论。
 */
export function NoteCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${LAYOUT.card} ${LAYOUT.cardPadding} ${className}`}>
      <h2 className={TYPE.calloutTitle}>{title}</h2>
      <div className={`mt-3 space-y-3 ${TYPE.body}`}>{children}</div>
    </section>
  );
}
