import type { ReactNode } from "react";

import { LAYOUT, TYPE } from "../lib/theme.js";

/** 每页顶部的一句话引导：与 Panel 同一张卡片、同一左右留白。 */
export function PageIntro({ children }: { children: ReactNode }) {
  return (
    <section className={`${LAYOUT.card} ${LAYOUT.compactCardPadding} ${TYPE.body}`}>
      {children}
    </section>
  );
}
