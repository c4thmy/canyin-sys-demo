import type { ReactNode } from "react";

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
    <section className={`card-surface rounded-2xl p-6 lg:p-7 ${className}`}>
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-600">{children}</div>
    </section>
  );
}
