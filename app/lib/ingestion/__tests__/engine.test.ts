import { describe, expect, it } from "vitest";

import {
  buildDatasetFiles,
  buildTemplateWorkbook,
  crossCheck,
  detectSheet,
  exampleRow,
  extractSheet,
  fieldHeader,
  getTemplate,
  mergeRows,
  normalizeBoolean,
  normalizeNumber,
  normalizePeriod,
  parseCsvText,
  parseUpload,
  planFor,
  TEMPLATES,
  type RawSheet,
  type TemplateType,
} from "../index.js";
import { seed, seedSheets, sheetOf } from "./seed-sheets.js";

function runPipeline(sheets: readonly RawSheet[]) {
  const results = sheets.map((sheet) => extractSheet(sheet, detectSheet(sheet), { batchId: "B1", file: "seed.xlsx" }));
  const rows = results.flatMap((result) => result.rows);
  const issues = results.flatMap((result) => result.issues);
  return { rows, issues };
}

describe("values · 单元格归一化", () => {
  it("期间：多种写法统一为 YYYY-MM", () => {
    for (const input of ["2025-09", "2025/9", "2025.09", "2025年9月", "202509", "2025-09-01", 202509]) {
      expect(normalizePeriod(input)).toBe("2025-09");
    }
    expect(normalizePeriod(new Date(Date.UTC(2025, 8, 1)))).toBe("2025-09");
    // Excel 日期序列号 45901 = 2025-09-01
    expect(normalizePeriod(45901)).toBe("2025-09");
    for (const input of ["2025-13", "9月", "abc", "", null, 12]) {
      expect(normalizePeriod(input)).toBeNull();
    }
  });

  it("数值：去千分位、货币符号与单位", () => {
    expect(normalizeNumber("1,234.5")).toBe(1234.5);
    expect(normalizeNumber("￥88")).toBe(88);
    expect(normalizeNumber("69.1万元")).toBe(69.1);
    expect(normalizeNumber("-3")).toBe(-3);
    expect(normalizeNumber("十二")).toBeNull();
    expect(normalizeNumber("")).toBeNull();
  });

  it("布尔：是/否、Y/N、1/0", () => {
    expect(normalizeBoolean("是")).toBe(true);
    expect(normalizeBoolean("N")).toBe(false);
    expect(normalizeBoolean(1)).toBe(true);
    expect(normalizeBoolean("也许")).toBeNull();
  });
});

describe("parse · CSV", () => {
  it("引号、转义引号、引号内换行，行号与源文件一致", () => {
    const rows = parseCsvText('渠道,期间,收入\n"美团,大众",2025-09,460\n"说""明""\n换行",2025-09,1\n\n抖音,2025-09,20\n');
    expect(rows.map((row) => row.rowNumber)).toEqual([1, 2, 3, 6]);
    expect(rows[1].cells[0]).toBe("美团,大众");
    expect(rows[2].cells[0]).toBe('说"明"\n换行');
  });
});

describe("detect · 模板识别与表头映射", () => {
  it("标准模板表头：识别出模板，完全匹配", () => {
    for (const template of TEMPLATES) {
      const plan = detectSheet(sheetOf(template.type, []));
      expect(plan.type).toBe(template.type);
      expect(plan.confidence).toBe("full");
      expect(plan.missingRequired).toEqual([]);
    }
  });

  it("别名表头：营业额 → 收入，标记为别名匹配", () => {
    const plan = detectSheet(
      sheetOf("channel_revenue", [["抖音", "2025-09", 20]], ["支付方式", "月份", "营业额"]),
    );
    expect(plan.type).toBe("channel_revenue");
    expect(plan.confidence).toBe("partial");
    expect(plan.matches.find((match) => match.fieldKey === "revenue")).toMatchObject({ column: 2, kind: "alias" });
  });

  it("表头不在第一行：跳过标题行找到表头", () => {
    const sheet: RawSheet = {
      name: "Sheet1",
      rows: [
        { rowNumber: 1, cells: ["9 月渠道收入表"] },
        { rowNumber: 3, cells: ["渠道", "期间", "收入（万元）"] },
        { rowNumber: 4, cells: ["抖音", "2025-09", 20] },
      ],
    };
    const plan = detectSheet(sheet);
    expect(plan.headerRow).toBe(3);
    expect(plan.type).toBe("channel_revenue");
  });

  it("必填字段缺失：列出缺失字段，置信度为 none", () => {
    const plan = detectSheet(sheetOf("store_revenue", [], ["门店编号", "门店名称", "期间", "收入"]));
    expect(plan.type).toBe("store_revenue");
    expect(plan.confidence).toBe("none");
    expect(plan.missingRequired).toEqual(["区域", "是否新店"]);
  });

  it("手工改映射：kind 为 manual，缺失字段随之更新", () => {
    const sheet = sheetOf("channel_revenue", [["抖音", "2025-09", 20]], ["渠道", "期间", "合计"]);
    expect(detectSheet(sheet).missingRequired).toEqual(["收入"]);
    const plan = planFor(sheet, "channel_revenue", 1, { revenue: 2 });
    expect(plan.missingRequired).toEqual([]);
    expect(plan.matches.find((match) => match.fieldKey === "revenue")?.kind).toBe("manual");
  });
});

describe("validate · 行内校验", () => {
  const extract = (sheet: RawSheet) => extractSheet(sheet, detectSheet(sheet), { batchId: "B1", file: "t.xlsx" });

  it("类型与期间格式错误：给出工作表、行号、字段", () => {
    const { rows, issues } = extract(
      sheetOf("channel_revenue", [
        ["抖音", "2025-09", "很多"],
        ["美团", "9月", 10],
        ["京东", "2025-09", 5],
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(issues.filter((issue) => issue.level === "error")).toEqual([
      expect.objectContaining({ sheet: "渠道收入", row: 2, field: "收入" }),
      expect.objectContaining({ sheet: "渠道收入", row: 3, field: "期间" }),
    ]);
  });

  it("重复行：同一门店同一期间出现两行，指出首次出现的行号", () => {
    const { rows, issues } = extract(
      sheetOf("store_revenue", [
        ["S01", "门店1", "区域一", "否", "2025-09", 69.1],
        ["S01", "门店1", "区域一", "否", "2025/9", 70],
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(issues).toEqual([expect.objectContaining({ level: "error", row: 3, message: expect.stringContaining("第 2 行") })]);
  });

  it("示例行被跳过并给出警告", () => {
    const { rows, skippedExamples } = extract(sheetOf("channel_revenue", [exampleRow(getTemplate("channel_revenue"))]));
    expect(rows).toHaveLength(0);
    expect(skippedExamples).toBe(1);
  });

  it("数量级警告：单店月收入 69 万填成 690000", () => {
    const { rows, issues } = extract(sheetOf("store_revenue", [["S01", "门店1", "区域一", "否", "2025-09", 690000]]));
    expect(rows).toHaveLength(1);
    expect(issues).toEqual([expect.objectContaining({ level: "warning", message: expect.stringContaining("元") })]);
  });

  it("漏斗未逐级递减给出警告", () => {
    const { issues } = extract(sheetOf("online_funnel", [["S01", "2025-09", 100, 200, 10, 5]]));
    expect(issues).toEqual([expect.objectContaining({ level: "warning", message: expect.stringContaining("逐级递减") })]);
  });
});

describe("validate · 跨表勾稽", () => {
  it("门店收入与客流 × 客单价差异超过 1%：警告并给出两个数值", () => {
    const { rows } = runPipeline([
      sheetOf("store_revenue", [["S01", "门店1", "区域一", "否", "2025-09", 70]]),
      // 5000 × 120 / 10000 = 60 万，差异 14.29%
      sheetOf("store_traffic", [["S01", "2025-09", 5000, 120]]),
    ]);
    const issues = crossCheck(rows);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("60.00");
    expect(issues[0].message).toContain("70.00");
    expect(issues[0].message).toContain("14.29%");
  });

  it("利润表科目不全：警告缺失科目", () => {
    const { rows } = runPipeline([sheetOf("pnl", [["营业收入", "2025-09", 1000]])]);
    expect(crossCheck(rows)[0].message).toContain("食材成本");
  });
});

describe("端到端 · 用演示数据反向生成模板再导入", () => {
  const { rows, issues } = runPipeline(seedSheets());
  const files = buildDatasetFiles(mergeRows([{ id: "B1", rows }]), "2026-11-07") as Record<string, any>;

  it("唯一的错误来自 S02 漏斗缺数（源表本身为空）", () => {
    const errors = issues.filter((issue) => issue.level === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((issue) => issue.sheet === "线上漏斗" && issue.row === 3)).toBe(true);
  });

  it("门店、客流、渠道、利润表逐项与演示数据一致", () => {
    const strip = (items: any[]) => items.map(({ derived: _derived, ...rest }) => rest);
    expect(files["stores.json"].items).toEqual(seed("stores.json").items);
    expect(files["traffic.json"].items).toEqual(seed("traffic.json").items);
    expect(files["channels.json"].items).toEqual(seed("channels.json").items);
    expect(strip(files["pnl.json"].items)).toEqual(strip(seed("pnl.json").items));
  });

  it("产品系列：销量、收入、单价、成本一致", () => {
    const pick = (item: any) => ({ name: item.name, qty: item.qty, unit_price: item.unit_price, revenue: item.revenue, cost: item.cost });
    expect(files["categories.json"].items.map(pick)).toEqual(seed("categories.json").items.map(pick));
  });

  it("期间与来源：两期，lineage 指向批次 / 文件 / 行号", () => {
    expect(files["meta.json"].periods).toEqual(seed("meta.json").periods);
    expect(files["lineage.json"]["stores.json|S01|2025-09"]).toEqual({
      batchId: "B1",
      file: "seed.xlsx",
      sheet: "门店收入",
      row: 3,
    });
  });

  it("幂等：同一批次导入两次，合并结果不变", () => {
    const twice = buildDatasetFiles(
      mergeRows([
        { id: "B1", rows },
        { id: "B1", rows },
      ]),
      "2026-11-07",
    );
    expect(twice).toEqual(files);
  });

  it("后到覆盖先到：第二个批次改 S01 收入后以新值为准", () => {
    const patch = runPipeline([sheetOf("store_revenue", [["S01", "门店1", "区域一", "否", "2025-09", 80]])]).rows;
    const merged = buildDatasetFiles(mergeRows([{ id: "B1", rows }, { id: "B2", rows: patch }]), "2026-11-07") as Record<string, any>;
    expect(merged["stores.json"].items[0].revenue).toEqual({ "2024-09": 58, "2025-09": 80 });
  });
});

describe("template-xlsx · 模板文件", () => {
  it("下载的模板可被引擎识别为完全匹配，示例行被跳过", async () => {
    for (const template of TEMPLATES) {
      const bytes = await buildTemplateWorkbook(template.type);
      const sheets = await parseUpload("xlsx", bytes, `${template.type}.xlsx`);
      expect(sheets.map((sheet) => sheet.name)).toEqual([template.name, "字段说明"]);
      const [data, guide] = sheets.map(detectSheet);
      expect(data.type).toBe(template.type);
      expect(data.confidence).toBe("full");
      expect(guide.type).toBeNull();
      const result = extractSheet(sheets[0], data, { batchId: "T", file: "t.xlsx" });
      expect(result.rows).toHaveLength(0);
      expect(result.skippedExamples).toBe(1);
    }
  });
});
