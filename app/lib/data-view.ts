import { completeness, type CompletenessRow } from "./dataset-status.js";
import { hasImportedDataset, listBatches, readActive, type BatchInfo, type BatchStatus } from "./ingestion/store.js";
import { getTemplate } from "./ingestion/templates.js";
import { loadSeed, type SeedPeriod } from "./seed.js";

/** 数据中心页：数据集状态、完整度矩阵与批次列表 */

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  uploaded: "待解析",
  analyzed: "待导入",
  active: "已生效",
  rolled_back: "已回滚",
  failed: "解析失败",
};

export interface BatchRow {
  readonly id: string;
  readonly fileName: string;
  readonly sizeText: string;
  readonly uploadedAt: string;
  readonly status: BatchStatus;
  readonly statusLabel: string;
  readonly templates: string;
  readonly periods: string;
  readonly rows: number;
  readonly errors: number;
  readonly warnings: number;
  readonly failure: string | null;
}

export interface DataCenterView {
  readonly active: "demo" | "imported";
  readonly hasImported: boolean;
  readonly sourceFile: string;
  readonly periods: readonly SeedPeriod[];
  readonly completeness: { readonly periods: readonly SeedPeriod[]; readonly rows: readonly CompletenessRow[] };
  readonly batches: readonly BatchRow[];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** ISO 时间转北京时间展示 */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function batchRow(batch: BatchInfo): BatchRow {
  return {
    id: batch.id,
    fileName: batch.fileName,
    sizeText: formatBytes(batch.size),
    uploadedAt: formatTime(batch.uploadedAt),
    status: batch.status,
    statusLabel: BATCH_STATUS_LABELS[batch.status],
    templates: (batch.summary?.templates ?? []).map((type) => getTemplate(type).name).join("、") || "—",
    periods: (batch.summary?.periods ?? []).join("、") || "—",
    rows: batch.summary?.rows ?? 0,
    errors: batch.summary?.errors ?? 0,
    warnings: batch.summary?.warnings ?? 0,
    failure: batch.failure,
  };
}

export function buildDataCenterView(): DataCenterView {
  const seed = loadSeed();
  return {
    active: seed.dataset,
    hasImported: hasImportedDataset(),
    sourceFile: seed.meta.source_file,
    periods: seed.meta.periods,
    completeness: completeness(seed),
    batches: listBatches().map(batchRow),
  };
}

export { readActive };
