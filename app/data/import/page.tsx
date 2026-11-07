import type { Metadata } from "next";

import { DataCenterHeader } from "../../components/data/DataCenterHeader.js";
import { ImportWizard } from "../../components/data/ImportWizard.js";
import { getBatch, type BatchInfo } from "../../lib/ingestion/store.js";
import { LAYOUT } from "../../lib/theme.js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "导入数据 · 数据中心 · 餐饮经营分析",
  description: "上传模板文件，确认字段映射，查看校验报告并生效。",
};

function initialBatch(id: string | undefined): BatchInfo | null {
  if (!id) {
    return null;
  }
  try {
    return getBatch(id);
  } catch {
    return null;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ batch?: string | string[] }> }) {
  const { batch } = await searchParams;
  const initial = initialBatch(typeof batch === "string" ? batch : undefined);

  return (
    <main className="min-h-screen">
      <DataCenterHeader title="导入数据" active="import" subtitle="上传 → 确认映射 → 校验报告 → 生效" />
      <div className={LAYOUT.container}>
        <ImportWizard key={initial?.id ?? "new"} initial={initial} />
      </div>
    </main>
  );
}
