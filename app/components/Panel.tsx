import type { ReactNode } from "react";

import { LAYOUT, TYPE } from "../lib/theme.js";

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${LAYOUT.card} ${LAYOUT.cardPadding} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={TYPE.sectionTitle}>{title}</h2>
          {description ? <p className={`mt-1 ${TYPE.note}`}>{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
