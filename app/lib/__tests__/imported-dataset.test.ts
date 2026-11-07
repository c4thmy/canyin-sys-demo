import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { completeness, missingFor, type PageKey } from "../dataset-status.js";
import { analyzeBatch, createBatch, executeBatch, rollbackBatch } from "../ingestion/store.js";
import { seedSheets, sheetOf } from "../ingestion/__tests__/seed-sheets.js";
import { buildChannelView } from "../channel-view.js";
import { buildInsightsView } from "../insights-view.js";
import { buildOverview } from "../overview.js";
import { buildProductView } from "../product-view.js";
import { buildSameStoreView } from "../same-store-view.js";
import { loadSeed } from "../seed.js";
import { buildStoreDetailView } from "../store-view.js";
import { buildStructureView } from "../structure-view.js";
import type { RawSheet } from "../ingestion/index.js";

async function xlsxOf(sheets: readonly RawSheet[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const row of sheet.rows) {
      worksheet.getRow(row.rowNumber).values = row.cells.map((cell) => cell ?? undefined) as ExcelJS.CellValue[];
    }
  }
  return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

async function importSheets(fileName: string, sheets: readonly RawSheet[]) {
  const batch = await createBatch({ fileName, kind: "xlsx", bytes: await xlsxOf(sheets) });
  const analyzed = await analyzeBatch(batch.id);
  expect(analyzed.summary?.errors).toBe(0);
  return executeBatch(batch.id);
}

const PAGES: readonly PageKey[] = ["overview", "structure", "same-store", "store", "channel", "product", "insights"];

describe("导入数据集 · 现有页面不改算法即可计算", () => {
  let dir: string;
  const demoOverview = buildOverview();
  const demoStructure = buildStructureView();
  const demoSameStore = buildSameStoreView();

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "canyin-imported-"));
    process.env.CANYIN_DATA_DIR = dir;
  });
  afterAll(() => {
    delete process.env.CANYIN_DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it("演示数据：7 个页面都不缺数据", () => {
    for (const page of PAGES) {
      expect(missingFor(loadSeed(), page)).toEqual([]);
    }
  });

  it("只导入门店收入：总览缺利润表，结构页缺渠道，均给出缺失期间", async () => {
    const stores = seedSheets().find((sheet) => sheet.name === "门店收入")!;
    const batch = await importSheets("门店.xlsx", [stores]);
    const seed = loadSeed();
    expect(seed.dataset).toBe("imported");
    expect(missingFor(seed, "overview").map((item) => `${item.name}|${item.period.id}`)).toEqual([
      "利润表|2025-09",
      "利润表|2024-09",
    ]);
    expect(missingFor(seed, "structure").map((item) => item.name)).toContain("渠道收入");
    const matrix = completeness(seed);
    expect(matrix.rows.find((row) => row.type === "store_revenue")?.cells.every((cell) => cell.present)).toBe(true);
    expect(matrix.rows.find((row) => row.type === "pnl")?.cells.some((cell) => cell.present)).toBe(false);
    await rollbackBatch(batch.id);
  });

  it("全量导入后：总览、结构、同店数字与演示数据一致", async () => {
    const sheets = seedSheets().map((sheet) =>
      sheet.name === "线上漏斗"
        ? { ...sheet, rows: sheet.rows.filter((row) => row.cells.every((cell) => cell !== null)) }
        : sheet,
    );
    await importSheets("全量.xlsx", sheets);
    const seed = loadSeed();
    for (const page of PAGES) {
      expect(missingFor(seed, page)).toEqual([]);
    }

    const overview = buildOverview();
    expect(overview.currentProfit).toBeCloseTo(demoOverview.currentProfit, 6);
    expect(overview.profitDelta).toBeCloseTo(48.1, 2);
    expect(overview.cards.map((card) => card.value)).toEqual(demoOverview.cards.map((card) => card.value));

    expect(buildStructureView().split).toEqual(demoStructure.split);
    expect(buildSameStoreView().summary).toEqual(demoSameStore.summary);
    expect(buildStoreDetailView("S01")).not.toBeNull();
  });

  it("未开放导入的时段 / 获客 / 套餐为空时，渠道、产品、同店、结论页不报错", () => {
    expect(loadSeed().timeSlots).toEqual([]);
    expect(() => buildSameStoreView()).not.toThrow();
    expect(() => buildChannelView()).not.toThrow();
    expect(() => buildProductView()).not.toThrow();
    expect(() => buildInsightsView()).not.toThrow();
  });

  it("单期数据：本期 2025-10 没有上年同期，结构页提示缺失", async () => {
    const october = sheetOf("store_revenue", [["S01", "门店1", "区域一", "否", "2025-10", 70]]);
    const batch = await importSheets("十月.xlsx", [october]);
    const missing = missingFor(loadSeed(), "structure");
    expect(missing.some((item) => item.period.id === "2024-10")).toBe(true);
    await rollbackBatch(batch.id);
  });
});
