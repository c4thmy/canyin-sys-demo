import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RawSheet } from "../index.js";
import {
  analyzeBatch,
  confirmMapping,
  createBatch,
  deleteBatch,
  executeBatch,
  getBatch,
  listBatches,
  readActive,
  readLineage,
  rollbackBatch,
  setActiveDataset,
} from "../store.js";
import { loadSeed } from "../../seed.js";
import { seedSheets, sheetOf } from "./seed-sheets.js";

async function xlsxOf(sheets: readonly RawSheet[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const row of sheet.rows) {
      worksheet.getRow(row.rowNumber).values = row.cells.map((cell) => (cell instanceof Date ? cell : cell ?? undefined)) as ExcelJS.CellValue[];
    }
  }
  return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

/** 演示数据反向展开，去掉 S02 的空漏斗行（源表本身为空） */
function cleanSeedSheets(): RawSheet[] {
  return seedSheets().map((sheet) =>
    sheet.name === "线上漏斗"
      ? { ...sheet, rows: sheet.rows.filter((row) => row.cells.every((cell) => cell !== null)) }
      : sheet,
  );
}

describe("store · 批次生命周期（临时目录）", () => {
  let dir: string;
  const demo = loadSeed();

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "canyin-store-"));
    process.env.CANYIN_DATA_DIR = dir;
  });
  afterAll(() => {
    delete process.env.CANYIN_DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it("未导入时默认演示数据集", () => {
    expect(readActive()).toEqual({ dataset: "demo", version: 0 });
    expect(loadSeed().dataset).toBe("demo");
  });

  it("上传 → 解析 → 生效：导入数据与演示数据数值一致，数据集切到已导入", async () => {
    const batch = await createBatch({ fileName: "全量.xlsx", kind: "xlsx", bytes: await xlsxOf(cleanSeedSheets()) });
    expect(batch.status).toBe("uploaded");

    const analyzed = await analyzeBatch(batch.id);
    expect(analyzed.status).toBe("analyzed");
    expect(analyzed.summary?.errors).toBe(0);
    expect(analyzed.summary?.templates).toHaveLength(6);

    const active = await executeBatch(batch.id);
    expect(active.status).toBe("active");

    const imported = loadSeed();
    expect(imported.dataset).toBe("imported");
    expect(imported.stores).toEqual(demo.stores);
    expect(imported.pnl).toEqual(demo.pnl);
    expect(imported.traffic).toEqual(demo.traffic);
    expect(imported.meta.periods).toEqual(demo.meta.periods);
    expect(readLineage()["stores.json|S01|2025-09"]).toMatchObject({ batchId: batch.id, file: "全量.xlsx" });
  });

  it("重复导入同一文件：数据集内容不变", async () => {
    const before = loadSeed();
    const again = await createBatch({ fileName: "全量.xlsx", kind: "xlsx", bytes: await xlsxOf(cleanSeedSheets()) });
    await analyzeBatch(again.id);
    await executeBatch(again.id);
    const after = loadSeed();
    expect(after.stores).toEqual(before.stores);
    expect(after.pnl).toEqual(before.pnl);
    await rollbackBatch(again.id);
  });

  it("补丁批次覆盖 S01 收入，回滚后恢复", async () => {
    const patch = await createBatch({
      fileName: "补丁.xlsx",
      kind: "xlsx",
      bytes: await xlsxOf([sheetOf("store_revenue", [["S01", "门店1", "区域一", "否", "2025-09", 80]])]),
    });
    await analyzeBatch(patch.id);
    await executeBatch(patch.id);
    expect(loadSeed().stores[0].revenue["2025-09"]).toBe(80);

    await rollbackBatch(patch.id);
    expect(getBatch(patch.id).status).toBe("rolled_back");
    expect(loadSeed().stores[0].revenue["2025-09"]).toBe(69.1);
  });

  it("有错误的批次不能生效；手工映射后可以", async () => {
    const batch = await createBatch({
      fileName: "渠道.csv",
      kind: "csv",
      bytes: new TextEncoder().encode("渠道,期间,合计\n抖音,2025-09,20\n"),
    });
    const analyzed = await analyzeBatch(batch.id);
    expect(analyzed.summary?.errors).toBeGreaterThan(0);
    await expect(executeBatch(batch.id)).rejects.toThrow("仍有错误");

    const mapped = await confirmMapping(batch.id, [
      { sheet: "渠道", type: "channel_revenue", headerRow: 1, columns: { revenue: 2 } },
    ]);
    expect(mapped.summary?.errors).toBe(0);
    await deleteBatch(batch.id);
    expect(listBatches().some((item) => item.id === batch.id)).toBe(false);
  });

  it("切回演示数据：数字恢复为 Excel 抽取值", async () => {
    await setActiveDataset("demo");
    expect(loadSeed().dataset).toBe("demo");
    await setActiveDataset("imported");
    expect(loadSeed().dataset).toBe("imported");
  });

  it("全部回滚后回落到演示数据，已生效批次不能删除", async () => {
    const active = listBatches().filter((batch) => batch.status === "active");
    await expect(deleteBatch(active[0].id)).rejects.toThrow("先回滚");
    for (const batch of active) {
      await rollbackBatch(batch.id);
    }
    expect(loadSeed().dataset).toBe("demo");
    await expect(setActiveDataset("imported")).rejects.toThrow("还没有");
  });

  it("批次号做格式校验，防止路径穿越", () => {
    expect(() => getBatch("../../etc/passwd")).toThrow("格式");
  });
});
