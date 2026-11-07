import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 数据集激活状态与目录约定（轻量模块，不依赖 exceljs）。
 * loadSeed() 只依赖这里；批次的读写在 store.ts。
 */

export type DatasetKind = "demo" | "imported";

export interface ActiveState {
  readonly dataset: DatasetKind;
  /** 每次导入 / 回滚 / 切换自增，loadSeed 用它判断缓存是否过期 */
  readonly version: number;
}

/** 运行时数据目录；可用 CANYIN_DATA_DIR 覆盖（测试与 Docker 卷挂载） */
export function dataRoot(): string {
  return process.env.CANYIN_DATA_DIR ?? path.join(process.cwd(), "data", "uploads");
}

export function dirs() {
  const root = dataRoot();
  return {
    root,
    files: path.join(root, "files"),
    batches: path.join(root, "batches"),
    dataset: path.join(root, "dataset"),
    reports: path.join(root, "reports"),
    active: path.join(root, "active.json"),
  };
}

export function datasetDir(): string {
  return dirs().dataset;
}

export function writeAtomic(file: string, content: string | Uint8Array): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(temp, content);
  renameSync(temp, file);
}

export function writeJson(file: string, value: unknown): void {
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson<T>(file: string): T | null {
  if (!existsSync(file)) {
    return null;
  }
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function readActive(): ActiveState {
  return readJson<ActiveState>(dirs().active) ?? { dataset: "demo", version: 0 };
}

export function hasImportedDataset(): boolean {
  return existsSync(path.join(dirs().dataset, "meta.json"));
}
