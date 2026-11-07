import type { MissingData } from "../lib/dataset-status.js";
import { analysisPeriods } from "../lib/dataset-status.js";
import { loadSeed } from "../lib/seed.js";
import { LAYOUT } from "../lib/theme.js";
import { DataIncomplete } from "./DataIncomplete.js";
import { RevenueHeader, type RevenueNavKey } from "./RevenueHeader.js";

/** 整页降级：页面依赖的数据缺失时，保留页头与导航，正文换成导入引导 */
export function IncompletePage({
  title,
  active,
  missing,
}: {
  title: string;
  active?: RevenueNavKey;
  missing: readonly MissingData[];
}) {
  const seed = loadSeed();
  const selected = analysisPeriods(seed);
  return (
    <main className="min-h-screen">
      <RevenueHeader
        title={title}
        subtitle={<span>当前数据集缺少本页所需数据</span>}
        active={active}
        periods={selected?.periods ?? []}
        activePeriodId={selected?.current.id ?? ""}
        previousLabel={selected?.previous.label ?? "—"}
        unit={seed.meta.currency_unit ?? "万元"}
      />
      <div className={LAYOUT.container}>
        <DataIncomplete missing={missing} />
      </div>
    </main>
  );
}
