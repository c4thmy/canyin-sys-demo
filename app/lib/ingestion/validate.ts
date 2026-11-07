import type { SheetPlan } from "./detect.js";
import type { RawSheet } from "./parse.js";
import { EXAMPLE_PREFIX, getTemplate, type TemplateField, type TemplateType } from "./templates.js";
import { PNL_ITEMS } from "../metrics/profit-bridge.js";
import {
  isBlank,
  normalizeBoolean,
  normalizeNumber,
  normalizePeriod,
  normalizeText,
  type CellValue,
} from "./values.js";

/** 校验阈值；口径见 docs/domain/revenue-analysis-model.md 第 11 节 */
export const VALIDATION_THRESHOLDS = {
  /** 勾稽差异率超过 1% 给出警告 */
  reconcileRate: 0.01,
  /** 单店月收入（万元）超过该值，疑似把「元」填成「万元」 */
  storeRevenueMax: 10_000,
  /** 单店月收入（万元）低于该值（且不为 0），疑似把「万元」填成「元」后又除了 1 万 */
  storeRevenueMin: 0.01,
  /** 单文件最大行数 */
  maxRows: 50_000,
  /** 单文件最大字节数（10 MB） */
  maxBytes: 10 * 1024 * 1024,
  /** 校验报告最多保留的问题条数 */
  maxIssues: 500,
} as const;

export type IssueLevel = "error" | "warning";

export interface Issue {
  readonly level: IssueLevel;
  readonly sheet: string | null;
  readonly row: number | null;
  readonly field: string | null;
  readonly message: string;
}

export interface SourceRef {
  readonly batchId: string;
  readonly file: string;
  readonly sheet: string;
  readonly row: number;
}

export type FieldValue = string | number | boolean | null;

/** 标准化后的一行：模板 + 主键 + 字段值 + 来源 */
export interface NormalizedRow {
  readonly template: TemplateType;
  /** 主键（不含期间），如门店编号 / 渠道名 / 科目 */
  readonly key: string;
  readonly period: string;
  readonly values: Readonly<Record<string, FieldValue>>;
  readonly source: SourceRef;
}

export interface ExtractContext {
  readonly batchId: string;
  readonly file: string;
}

export interface ExtractResult {
  readonly rows: readonly NormalizedRow[];
  readonly issues: readonly Issue[];
  /** 被跳过的示例行数 */
  readonly skippedExamples: number;
}

function parseField(field: TemplateField, raw: CellValue): { value: FieldValue; error: string | null } {
  if (isBlank(raw)) {
    return { value: null, error: field.required ? "必填字段为空" : null };
  }
  switch (field.type) {
    case "period": {
      const period = normalizePeriod(raw);
      return period
        ? { value: period, error: null }
        : { value: null, error: `期间「${String(raw)}」无法识别，应为 YYYY-MM（如 2025-09）` };
    }
    case "number": {
      const number = normalizeNumber(raw);
      if (number === null) {
        return { value: null, error: `「${String(raw)}」不是数字` };
      }
      if (number < 0 && !field.allowNegative) {
        return { value: null, error: `不能为负数（${number}）` };
      }
      return { value: number, error: null };
    }
    case "boolean": {
      const flag = normalizeBoolean(raw);
      return flag === null
        ? { value: null, error: `「${String(raw)}」应填「是」或「否」` }
        : { value: flag, error: null };
    }
    default:
      return { value: normalizeText(raw), error: null };
  }
}

function isExampleRow(values: Record<string, FieldValue>): boolean {
  return Object.values(values).some(
    (value) => typeof value === "string" && value.startsWith(EXAMPLE_PREFIX),
  );
}

/**
 * 按导入计划抽取一张工作表：逐行解析字段、做行内校验，产出标准化行与问题列表。
 * 行内校验：必填、类型、期间格式、负数、数量级、主键重复、漏斗逐级递减、未知科目。
 */
export function extractSheet(sheet: RawSheet, plan: SheetPlan, context: ExtractContext): ExtractResult {
  if (plan.type === null) {
    return { rows: [], issues: [], skippedExamples: 0 };
  }
  const template = getTemplate(plan.type);
  const issues: Issue[] = [];
  if (plan.missingRequired.length > 0) {
    issues.push({
      level: "error",
      sheet: sheet.name,
      row: plan.headerRow,
      field: null,
      message: `缺少必填字段：${plan.missingRequired.join("、")}`,
    });
    return { rows: [], issues, skippedExamples: 0 };
  }

  const columnOf = new Map(plan.matches.map((match) => [match.fieldKey, match.column]));
  const rows: NormalizedRow[] = [];
  const seen = new Map<string, number>();
  let skippedExamples = 0;

  for (const raw of sheet.rows) {
    if (raw.rowNumber <= plan.headerRow) {
      continue;
    }
    const cellsOf = (key: string): CellValue => {
      const column = columnOf.get(key);
      return column === null || column === undefined ? null : (raw.cells[column] ?? null);
    };
    if (template.fields.every((field) => isBlank(cellsOf(field.key)))) {
      continue;
    }

    const values: Record<string, FieldValue> = {};
    let rowHasError = false;
    for (const field of template.fields) {
      const { value, error } = parseField(field, cellsOf(field.key));
      values[field.key] = value;
      if (error) {
        rowHasError = true;
        issues.push({ level: "error", sheet: sheet.name, row: raw.rowNumber, field: field.label, message: error });
      }
    }
    if (rowHasError) {
      continue;
    }
    if (isExampleRow(values)) {
      skippedExamples += 1;
      issues.push({
        level: "warning",
        sheet: sheet.name,
        row: raw.rowNumber,
        field: null,
        message: `模板示例行（以「${EXAMPLE_PREFIX}」开头），已跳过`,
      });
      continue;
    }

    const key = template.primaryKey
      .filter((fieldKey) => fieldKey !== "period")
      .map((fieldKey) => String(values[fieldKey]))
      .join("|");
    const period = String(values.period);
    const dedupeKey = `${key}|${period}`;
    const firstRow = seen.get(dedupeKey);
    if (firstRow !== undefined) {
      issues.push({
        level: "error",
        sheet: sheet.name,
        row: raw.rowNumber,
        field: null,
        message: `主键重复：与第 ${firstRow} 行的「${key.replace(/\|/g, " / ")} · ${period}」相同`,
      });
      continue;
    }
    seen.set(dedupeKey, raw.rowNumber);

    rowIssues(plan.type, values).forEach((message) =>
      issues.push({ level: "warning", sheet: sheet.name, row: raw.rowNumber, field: null, message }),
    );
    if (plan.type === "pnl" && !PNL_ITEMS.includes(String(values.item))) {
      continue;
    }

    rows.push({
      template: plan.type,
      key,
      period,
      values,
      source: { batchId: context.batchId, file: context.file, sheet: sheet.name, row: raw.rowNumber },
    });
  }

  return { rows, issues, skippedExamples };
}

/** 行内警告：数量级、漏斗递减、未知科目 */
function rowIssues(type: TemplateType, values: Readonly<Record<string, FieldValue>>): string[] {
  const messages: string[] = [];
  if (type === "store_revenue") {
    const revenue = Number(values.revenue);
    if (revenue > VALIDATION_THRESHOLDS.storeRevenueMax) {
      messages.push(`单店月收入 ${revenue} 万元，疑似把「元」填成了「万元」`);
    } else if (revenue > 0 && revenue < VALIDATION_THRESHOLDS.storeRevenueMin) {
      messages.push(`单店月收入 ${revenue} 万元，数量级偏小，请确认单位`);
    }
  }
  if (type === "online_funnel") {
    const steps = ["exposure", "visits", "payments", "consumers"].map((key) => Number(values[key]));
    if (steps.some((value, index) => index > 0 && value > steps[index - 1])) {
      messages.push("漏斗人数未逐级递减（曝光 ≥ 访问 ≥ 支付 ≥ 消费）");
    }
  }
  if (type === "pnl" && !PNL_ITEMS.includes(String(values.item))) {
    messages.push(`未知科目「${values.item}」，已忽略；利润桥只用 ${PNL_ITEMS.length} 个标准科目`);
  }
  return messages;
}

function rate(a: number, b: number): number {
  return b === 0 ? (a === 0 ? 0 : Number.POSITIVE_INFINITY) : Math.abs(a - b) / Math.abs(b);
}

function percent(value: number): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "—";
}

/**
 * 跨表勾稽（全部为警告，不阻断导入），在合并后的数据上执行：
 * 1. 门店收入 ≈ 客流 × 客单价 ÷ 10000
 * 2. 渠道收入合计 ≈ 门店收入合计
 * 3. 利润表某期间出现了任一科目，则 9 个科目应齐全
 * 4. 同一门店在不同期间的「是否新店 / 区域」不一致
 */
export function crossCheck(rows: readonly NormalizedRow[]): Issue[] {
  const issues: Issue[] = [];
  const threshold = VALIDATION_THRESHOLDS.reconcileRate;
  const of = (type: TemplateType) => rows.filter((row) => row.template === type);

  const revenueByStore = new Map(of("store_revenue").map((row) => [`${row.key}|${row.period}`, row]));
  for (const traffic of of("store_traffic")) {
    const store = revenueByStore.get(`${traffic.key}|${traffic.period}`);
    if (!store) {
      continue;
    }
    const revenue = Number(store.values.revenue);
    const computed = (Number(traffic.values.traffic) * Number(traffic.values.ticket)) / 10_000;
    const gap = rate(computed, revenue);
    if (gap > threshold) {
      issues.push({
        level: "warning",
        sheet: traffic.source.sheet,
        row: traffic.source.row,
        field: null,
        message: `门店 ${traffic.key} · ${traffic.period}：客流 × 客单价 = ${computed.toFixed(2)} 万元，门店收入 ${revenue.toFixed(2)} 万元，差异 ${percent(gap)}`,
      });
    }
  }

  const sumBy = (type: TemplateType) => {
    const sums = new Map<string, number>();
    for (const row of of(type)) {
      sums.set(row.period, (sums.get(row.period) ?? 0) + Number(row.values.revenue));
    }
    return sums;
  };
  const storeSums = sumBy("store_revenue");
  for (const [period, channelSum] of sumBy("channel_revenue")) {
    const storeSum = storeSums.get(period);
    if (storeSum === undefined) {
      continue;
    }
    const gap = rate(channelSum, storeSum);
    if (gap > threshold) {
      issues.push({
        level: "warning",
        sheet: null,
        row: null,
        field: null,
        message: `${period}：渠道收入合计 ${channelSum.toFixed(2)} 万元，门店收入合计 ${storeSum.toFixed(2)} 万元，差异 ${percent(gap)}`,
      });
    }
  }

  const pnlItemsByPeriod = new Map<string, Set<string>>();
  for (const row of of("pnl")) {
    const items = pnlItemsByPeriod.get(row.period) ?? new Set<string>();
    items.add(row.key);
    pnlItemsByPeriod.set(row.period, items);
  }
  for (const [period, items] of pnlItemsByPeriod) {
    const missing = PNL_ITEMS.filter((item) => !items.has(item));
    if (missing.length > 0) {
      issues.push({
        level: "warning",
        sheet: null,
        row: null,
        field: null,
        message: `${period} 利润表缺少科目：${missing.join("、")}，利润桥将无法计算该期间`,
      });
    }
  }

  const attributes = new Map<string, { isNew: FieldValue; region: FieldValue; period: string }>();
  for (const row of of("store_revenue")) {
    const previous = attributes.get(row.key);
    if (previous && (previous.isNew !== row.values.is_new || previous.region !== row.values.region)) {
      issues.push({
        level: "warning",
        sheet: row.source.sheet,
        row: row.source.row,
        field: null,
        message: `门店 ${row.key} 在 ${previous.period} 与 ${row.period} 的「是否新店 / 区域」不一致，以最新期间为准`,
      });
    }
    attributes.set(row.key, { isNew: row.values.is_new, region: row.values.region, period: row.period });
  }

  return issues;
}

/** 截断过长的问题列表，并在末尾补一条汇总 */
export function capIssues(issues: readonly Issue[]): Issue[] {
  const max = VALIDATION_THRESHOLDS.maxIssues;
  if (issues.length <= max) {
    return [...issues];
  }
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const kept = [...errors, ...warnings].slice(0, max);
  return [
    ...kept,
    {
      level: errors.length > max ? "error" : "warning",
      sheet: null,
      row: null,
      field: null,
      message: `共 ${issues.length} 条问题（错误 ${errors.length}、警告 ${warnings.length}），仅显示前 ${max} 条`,
    },
  ];
}
