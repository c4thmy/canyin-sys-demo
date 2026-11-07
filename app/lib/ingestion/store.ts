import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

import { detectSheets, planFor, type SheetPlan } from "./detect.js";
import { buildDatasetFiles, mergeRows } from "./normalize.js";
import { parseUpload, type RawSheet, type UploadKind } from "./parse.js";
import {
  dirs,
  hasImportedDataset,
  readActive,
  readJson,
  writeAtomic,
  writeJson,
  type ActiveState,
  type DatasetKind,
} from "./active.js";
import { isTemplateType, type TemplateType } from "./templates.js";
import { capIssues, crossCheck, extractSheet, type Issue, type NormalizedRow } from "./validate.js";

/**
 * 导入数据的文件存储（服务端专用）。
 *
 * data/uploads/
 *   files/<batchId>.<ext>     原始文件（落盘名只用 batchId，不使用用户文件名）
 *   batches/<batchId>.json    批次：映射计划、校验报告、标准化行
 *   dataset/*.json            已导入数据集（结构同 data/seed），由已生效批次合并重算
 *   active.json               { dataset, version }
 *
 * 写入全部走「临时文件 + rename」；状态变更在进程内串行执行。
 */

export type BatchStatus = "uploaded" | "analyzed" | "active" | "rolled_back" | "failed";

export interface BatchSummary {
  readonly errors: number;
  readonly warnings: number;
  readonly rows: number;
  readonly skippedExamples: number;
  readonly templates: readonly TemplateType[];
  readonly periods: readonly string[];
}

export interface Batch {
  readonly id: string;
  readonly fileName: string;
  readonly kind: UploadKind;
  readonly size: number;
  readonly uploadedAt: string;
  readonly status: BatchStatus;
  readonly plans: readonly SheetPlan[];
  readonly issues: readonly Issue[];
  readonly rows: readonly NormalizedRow[];
  readonly summary: BatchSummary | null;
  readonly executedAt: string | null;
  readonly rolledBackAt: string | null;
  /** 解析失败时的原因 */
  readonly failure: string | null;
}

/** 列表与详情接口返回的批次（不含标准化行，避免响应过大） */
export type BatchInfo = Omit<Batch, "rows">;

export class StoreError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const BATCH_ID = /^B\d{14}-[0-9a-f]{6}$/;

let queue: Promise<unknown> = Promise.resolve();

/** 进程内互斥：状态变更串行执行，避免两个请求同时重算数据集 */
function exclusive<T>(task: () => Promise<T> | T): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function now(): string {
  return new Date().toISOString();
}

function newBatchId(): string {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `B${stamp}-${randomBytes(3).toString("hex")}`;
}

export function assertBatchId(id: string): void {
  if (!BATCH_ID.test(id)) {
    throw new StoreError("批次号格式不正确", 400);
  }
}

function batchFile(id: string): string {
  assertBatchId(id);
  return path.join(dirs().batches, `${id}.json`);
}

function rawFile(id: string, kind: UploadKind): string {
  assertBatchId(id);
  return path.join(dirs().files, `${id}.${kind}`);
}

function info(batch: Batch): BatchInfo {
  const { rows: _rows, ...rest } = batch;
  return rest;
}

export function readBatch(id: string): Batch {
  const batch = readJson<Batch>(batchFile(id));
  if (!batch) {
    throw new StoreError("批次不存在", 404);
  }
  return batch;
}

export function getBatch(id: string): BatchInfo {
  return info(readBatch(id));
}

export function listBatches(): BatchInfo[] {
  const dir = dirs().batches;
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson<Batch>(path.join(dir, name)))
    .filter((batch): batch is Batch => batch !== null)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map(info);
}

export { dataRoot, datasetDir, hasImportedDataset, readActive } from "./active.js";
export type { ActiveState, DatasetKind } from "./active.js";

function bumpActive(dataset: DatasetKind): ActiveState {
  const next = { dataset, version: readActive().version + 1 };
  writeJson(dirs().active, next);
  return next;
}

/** 已导入数据集的来源追溯表 */
export function readLineage(): Record<string, { batchId: string; file: string; sheet: string; row: number }> {
  return readJson(path.join(dirs().dataset, "lineage.json")) ?? {};
}

async function loadSheets(batch: Batch): Promise<RawSheet[]> {
  const file = rawFile(batch.id, batch.kind);
  if (!existsSync(file)) {
    throw new StoreError("原始文件已丢失，请重新上传", 410);
  }
  return parseUpload(batch.kind, new Uint8Array(readFileSync(file)), batch.fileName);
}

/** 按计划抽取 + 校验，返回更新后的批次 */
function evaluate(batch: Batch, sheets: readonly RawSheet[], plans: readonly SheetPlan[]): Batch {
  const context = { batchId: batch.id, file: batch.fileName };
  const results = plans.map((plan) => {
    const sheet = sheets.find((candidate) => candidate.name === plan.sheet);
    return sheet ? extractSheet(sheet, plan, context) : { rows: [], issues: [], skippedExamples: 0 };
  });
  const rows = results.flatMap((result) => result.rows);
  const issues: Issue[] = results.flatMap((result) => result.issues);

  if (plans.every((plan) => plan.type === null)) {
    issues.push({ level: "error", sheet: null, row: null, field: null, message: "没有识别出任何模板，请在映射页为工作表选择模板" });
  } else if (rows.length === 0 && !issues.some((issue) => issue.level === "error")) {
    issues.push({ level: "error", sheet: null, row: null, field: null, message: "没有可导入的数据行" });
  }

  // 跨表勾稽：与当前已生效数据合并后再检查，保证「只补一张表」时也能对上
  const activeRows = listBatches()
    .filter((other) => other.status === "active" && other.id !== batch.id)
    .flatMap((other) => readBatch(other.id).rows);
  const merged = mergeRows([
    { id: "active", rows: activeRows },
    { id: batch.id, rows },
  ]);
  const ownKeys = new Set(rows.map((row) => `${row.source.sheet}|${row.source.row}`));
  const cross = crossCheck(merged).filter(
    (issue) => issue.row === null || ownKeys.has(`${issue.sheet}|${issue.row}`),
  );
  const allIssues = capIssues([...issues, ...cross]);

  const summary: BatchSummary = {
    errors: allIssues.filter((issue) => issue.level === "error").length,
    warnings: allIssues.filter((issue) => issue.level === "warning").length,
    rows: rows.length,
    skippedExamples: results.reduce((sum, result) => sum + result.skippedExamples, 0),
    templates: [...new Set(rows.map((row) => row.template))],
    periods: [...new Set(rows.map((row) => row.period))].sort(),
  };
  return { ...batch, status: "analyzed", plans, issues: allIssues, rows, summary, failure: null };
}

export function createBatch(input: { fileName: string; kind: UploadKind; bytes: Uint8Array }): Promise<BatchInfo> {
  return exclusive(() => {
    const id = newBatchId();
    writeAtomic(rawFile(id, input.kind), input.bytes);
    const batch: Batch = {
      id,
      fileName: path.basename(input.fileName).slice(0, 200),
      kind: input.kind,
      size: input.bytes.length,
      uploadedAt: now(),
      status: "uploaded",
      plans: [],
      issues: [],
      rows: [],
      summary: null,
      executedAt: null,
      rolledBackAt: null,
      failure: null,
    };
    writeJson(batchFile(id), batch);
    return info(batch);
  });
}

function assertEditable(batch: Batch): void {
  if (batch.status === "active") {
    throw new StoreError("批次已生效，请先回滚再修改", 409);
  }
}

export function analyzeBatch(id: string): Promise<BatchInfo> {
  return exclusive(async () => {
    const batch = readBatch(id);
    assertEditable(batch);
    let sheets: RawSheet[];
    try {
      sheets = await loadSheets(batch);
    } catch (error) {
      if (error instanceof StoreError) {
        throw error;
      }
      const failed: Batch = { ...batch, status: "failed", failure: error instanceof Error ? error.message : "解析失败" };
      writeJson(batchFile(id), failed);
      return info(failed);
    }
    const next = evaluate(batch, sheets, detectSheets(sheets));
    writeJson(batchFile(id), next);
    return info(next);
  });
}

export interface MappingInput {
  readonly sheet: string;
  readonly type: string | null;
  readonly headerRow: number;
  /** 字段 key → 列序号（0 起）；null 表示不映射 */
  readonly columns?: Readonly<Record<string, number | null>>;
}

export function confirmMapping(id: string, mappings: readonly MappingInput[]): Promise<BatchInfo> {
  return exclusive(async () => {
    const batch = readBatch(id);
    assertEditable(batch);
    const sheets = await loadSheets(batch);
    const plans = sheets.map((sheet) => {
      const input = mappings.find((mapping) => mapping.sheet === sheet.name);
      const existing = batch.plans.find((plan) => plan.sheet === sheet.name);
      if (!input) {
        return existing ?? planFor(sheet, null, sheet.rows[0]?.rowNumber ?? 1);
      }
      if (input.type !== null && !isTemplateType(input.type)) {
        throw new StoreError(`未知模板：${input.type}`);
      }
      if (!Number.isInteger(input.headerRow) || input.headerRow < 1) {
        throw new StoreError("表头行号不正确");
      }
      return planFor(sheet, input.type, input.headerRow, input.columns);
    });
    const next = evaluate(batch, sheets, plans);
    writeJson(batchFile(id), next);
    return info(next);
  });
}

/** 由全部已生效批次重算导入数据集（按生效时间先后合并） */
function rebuildDataset(): void {
  const active = listBatches()
    .filter((batch) => batch.status === "active")
    .sort((a, b) => (a.executedAt ?? "").localeCompare(b.executedAt ?? ""))
    .map((batch) => readBatch(batch.id));
  const dir = dirs().dataset;
  if (active.length === 0) {
    rmSync(dir, { recursive: true, force: true });
    return;
  }
  const files = buildDatasetFiles(mergeRows(active), now().slice(0, 10));
  for (const [name, content] of Object.entries(files)) {
    writeJson(path.join(dir, name), content);
  }
}

export function executeBatch(id: string): Promise<BatchInfo> {
  return exclusive(() => {
    const batch = readBatch(id);
    if (batch.status !== "analyzed") {
      throw new StoreError(batch.status === "active" ? "批次已生效" : "请先完成解析与映射", 409);
    }
    if ((batch.summary?.errors ?? 1) > 0) {
      throw new StoreError("校验报告中仍有错误，无法导入", 422);
    }
    const next: Batch = { ...batch, status: "active", executedAt: now(), rolledBackAt: null };
    writeJson(batchFile(id), next);
    rebuildDataset();
    bumpActive("imported");
    return info(next);
  });
}

export function rollbackBatch(id: string): Promise<BatchInfo> {
  return exclusive(() => {
    const batch = readBatch(id);
    if (batch.status !== "active") {
      throw new StoreError("只有已生效的批次可以回滚", 409);
    }
    const next: Batch = { ...batch, status: "rolled_back", rolledBackAt: now() };
    writeJson(batchFile(id), next);
    rebuildDataset();
    bumpActive(hasImportedDataset() ? readActive().dataset : "demo");
    return info(next);
  });
}

export function deleteBatch(id: string): Promise<void> {
  return exclusive(() => {
    const batch = readBatch(id);
    if (batch.status === "active") {
      throw new StoreError("已生效的批次不能删除，请先回滚", 409);
    }
    rmSync(rawFile(id, batch.kind), { force: true });
    rmSync(batchFile(id), { force: true });
  });
}

export function setActiveDataset(dataset: DatasetKind): Promise<ActiveState> {
  return exclusive(() => {
    if (dataset === "imported" && !hasImportedDataset()) {
      throw new StoreError("还没有已导入的数据，请先导入", 409);
    }
    return bumpActive(dataset);
  });
}
