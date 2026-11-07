import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { analyzeBatch, createBatch, executeBatch, rollbackBatch } from "../ingestion/store.js";
import { seedSheets } from "../ingestion/__tests__/seed-sheets.js";
import { buildOverview } from "../overview.js";
import { buildReport } from "../report/build.js";
import { escapeHtml, reportToHtml, sanitizeSvg } from "../report/html.js";
import { deleteReport, listReports, readReport, saveReport } from "../report/store.js";
import { REPORT_TEMPLATES } from "../report/templates.js";

describe("报告 · 生成（演示数据）", () => {
  const boss = buildReport({ templateId: "boss", now: new Date("2026-11-07T00:00:00Z") });
  const ops = buildReport({ templateId: "operations" });

  it("老板版：执行摘要、利润桥、收入异动原点、三条行动建议", () => {
    expect(boss.chapters.map((chapter) => chapter.title)).toEqual(["执行摘要", "利润桥", "收入异动原点", "三条行动建议"]);
    expect(boss.chapters.every((chapter) => !chapter.skipped)).toBe(true);
    const actions = boss.chapters[3].blocks[0];
    expect(actions.kind === "list" && actions.items.length).toBe(3);
    expect(boss.title).toBe("2025年9月经营分析报告 · 老板版");
    expect(boss.period).toMatchObject({ current: "2025-09", previous: "2024-09" });
  });

  it("报告数字与经营总览一致：营业利润 112.70、同比 +48.10", () => {
    const overview = buildOverview();
    const summary = boss.chapters[0].blocks[0];
    expect(summary.kind).toBe("kpis");
    if (summary.kind === "kpis") {
      expect(summary.items.map((item) => item.value.split(" ")[0])).toEqual(overview.cards.map((card) => card.value));
    }
    expect(boss.chapters[1].conclusion).toContain("112.70");
    expect(boss.chapters[1].conclusion).toContain("+48.10");
  });

  it("运营版 8 章，含图表（SVG）", () => {
    expect(ops.chapters).toHaveLength(8);
    const charts = ops.chapters.flatMap((chapter) => chapter.blocks.filter((item) => item.kind === "chart"));
    expect(charts.length).toBeGreaterThanOrEqual(4);
    for (const chart of charts) {
      expect(chart.kind === "chart" && chart.svg.startsWith("<svg")).toBe(true);
    }
  });

  it("模板章节表与生成结果一致", () => {
    for (const template of REPORT_TEMPLATES) {
      expect(buildReport({ templateId: template.id }).chapters.map((chapter) => chapter.key)).toEqual(
        template.chapters.map((chapter) => chapter.key),
      );
    }
    expect(() => buildReport({ templateId: "nope" })).toThrow("未知报告模板");
  });

  it("HTML 导出：自包含、转义、打印分页", () => {
    const html = reportToHtml(boss);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("<svg");
    expect(html).toContain("break-before:page");
    expect(html).not.toMatch(/<script/i);
    expect(escapeHtml('<b a="1">')).toBe("&lt;b a=&quot;1&quot;&gt;");
    expect(sanitizeSvg('<svg onload="x()"><script>1</script></svg>')).toBe("<svg></svg>");
  });
});

describe("报告 · 数据不完整与快照", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "canyin-report-"));
    process.env.CANYIN_DATA_DIR = dir;
  });
  afterAll(() => {
    delete process.env.CANYIN_DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it("只导入门店收入：利润桥章节降级，其他章节照常；快照不随回滚改变", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = seedSheets().find((item) => item.name === "门店收入")!;
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const row of sheet.rows) {
      worksheet.getRow(row.rowNumber).values = row.cells.map((cell) => cell ?? undefined) as ExcelJS.CellValue[];
    }
    const batch = await createBatch({
      fileName: "门店.xlsx",
      kind: "xlsx",
      bytes: new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer),
    });
    await analyzeBatch(batch.id);
    await executeBatch(batch.id);

    const report = buildReport({ templateId: "operations" });
    expect(report.dataset).toBe("imported");
    const byKey = new Map(report.chapters.map((chapter) => [chapter.key, chapter]));
    expect(byKey.get("profitBridge")).toMatchObject({ skipped: true, conclusion: "数据不足，本章略" });
    expect(byKey.get("profitBridge")?.missing.map((item) => item.name)).toContain("利润表");
    expect(byKey.get("sameStore")?.skipped).toBe(true);
    // 收入结构需要渠道收入，也降级
    expect(byKey.get("structure")?.skipped).toBe(true);

    saveReport(report);
    await rollbackBatch(batch.id);
    expect(readReport(report.id)).toEqual(report);
    expect(listReports()).toEqual([expect.objectContaining({ id: report.id, chapterCount: 8, skippedCount: report.chapters.filter((c) => c.skipped).length })]);

    deleteReport(report.id);
    expect(listReports()).toEqual([]);
    expect(() => readReport("../x")).toThrow("格式");
  });
});
