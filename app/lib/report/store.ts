import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

import { dirs, readJson, writeJson } from "../ingestion/active.js";
import { StoreError } from "../ingestion/store.js";
import type { Report } from "./build.js";

/** 报告快照存储：data/uploads/reports/<id>.json，生成后不再随数据变化 */

const REPORT_ID = /^R\d{14}-[0-9a-f]{6}$/;

export type ReportSummary = Omit<Report, "chapters"> & { readonly chapterCount: number; readonly skippedCount: number };

function fileOf(id: string): string {
  if (!REPORT_ID.test(id)) {
    throw new StoreError("报告编号格式不正确", 400);
  }
  return path.join(dirs().reports, `${id}.json`);
}

export function saveReport(report: Report): void {
  writeJson(fileOf(report.id), report);
}

export function readReport(id: string): Report {
  const report = readJson<Report>(fileOf(id));
  if (!report) {
    throw new StoreError("报告不存在", 404);
  }
  return report;
}

export function listReports(): ReportSummary[] {
  const dir = dirs().reports;
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson<Report>(path.join(dir, name)))
    .filter((report): report is Report => report !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ chapters, ...rest }) => ({
      ...rest,
      chapterCount: chapters.length,
      skippedCount: chapters.filter((chapter) => chapter.skipped).length,
    }));
}

export function deleteReport(id: string): void {
  const file = fileOf(id);
  if (!existsSync(file)) {
    throw new StoreError("报告不存在", 404);
  }
  rmSync(file, { force: true });
}
