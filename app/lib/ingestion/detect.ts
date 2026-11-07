import type { RawRow, RawSheet } from "./parse.js";
import {
  FIELD_GUIDE_SHEET,
  TEMPLATES,
  fieldHeader,
  getTemplate,
  type ImportTemplate,
  type TemplateType,
} from "./templates.js";
import { normalizeText } from "./values.js";

/** 单列映射的匹配方式：精确（模板表头 / 字段名）> 别名 > 归一化（去单位、空格、大小写后相等） */
export type MatchKind = "exact" | "alias" | "normalized" | "manual";

export interface FieldMatch {
  readonly fieldKey: string;
  /** 0 起的列序号；未映射为 null */
  readonly column: number | null;
  readonly header: string | null;
  readonly kind: MatchKind | null;
}

export type Confidence = "full" | "partial" | "none";

/** 一张工作表的导入计划：识别出的模板、表头行与列映射，用户可手工修改后再校验 */
export interface SheetPlan {
  readonly sheet: string;
  /** null 表示不导入该工作表（未识别或用户选择跳过） */
  readonly type: TemplateType | null;
  /** 表头所在行号（1 起） */
  readonly headerRow: number;
  readonly headers: readonly string[];
  readonly matches: readonly FieldMatch[];
  readonly confidence: Confidence;
  /** 必填字段中尚未映射的字段名 */
  readonly missingRequired: readonly string[];
}

/** 只在前 N 行里找表头，避免把数据行当成表头 */
const HEADER_SCAN_ROWS = 10;

/** 去掉括号单位、空白、全角符号与大小写差异 */
export function normalizeHeader(text: string): string {
  return text
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[\s_\-:：*＊]/g, "")
    .toLowerCase();
}

function matchColumn(
  header: string,
  template: ImportTemplate,
): { fieldKey: string; kind: Exclude<MatchKind, "manual"> } | null {
  const trimmed = header.trim();
  for (const field of template.fields) {
    if (trimmed === fieldHeader(field) || trimmed === field.label || trimmed === field.key) {
      return { fieldKey: field.key, kind: "exact" };
    }
  }
  for (const field of template.fields) {
    if (field.aliases.includes(trimmed)) {
      return { fieldKey: field.key, kind: "alias" };
    }
  }
  const normalized = normalizeHeader(trimmed);
  if (normalized === "") {
    return null;
  }
  for (const field of template.fields) {
    const candidates = [field.label, field.key, ...field.aliases].map(normalizeHeader);
    if (candidates.includes(normalized)) {
      return { fieldKey: field.key, kind: "normalized" };
    }
  }
  return null;
}

function headersOf(row: RawRow | undefined): string[] {
  return (row?.cells ?? []).map((cell) => normalizeText(cell) ?? "");
}

/** 用给定模板与表头构造映射；每个字段取第一次匹配的列，每列只用一次 */
export function buildMatches(template: ImportTemplate, headers: readonly string[]): FieldMatch[] {
  const used = new Set<number>();
  const found = new Map<string, FieldMatch>();
  const rank: Record<Exclude<MatchKind, "manual">, number> = { exact: 0, alias: 1, normalized: 2 };

  // 先按匹配强度排序，保证精确匹配优先占列
  const candidates = headers
    .map((header, column) => ({ header, column, match: header ? matchColumn(header, template) : null }))
    .filter((entry) => entry.match !== null)
    .sort((a, b) => rank[a.match!.kind] - rank[b.match!.kind] || a.column - b.column);

  for (const { header, column, match } of candidates) {
    if (!match || found.has(match.fieldKey) || used.has(column)) {
      continue;
    }
    used.add(column);
    found.set(match.fieldKey, { fieldKey: match.fieldKey, column, header, kind: match.kind });
  }

  return template.fields.map(
    (field) => found.get(field.key) ?? { fieldKey: field.key, column: null, header: null, kind: null },
  );
}

function summarize(
  template: ImportTemplate,
  matches: readonly FieldMatch[],
): { confidence: Confidence; missingRequired: string[] } {
  const byKey = new Map(matches.map((match) => [match.fieldKey, match]));
  const missingRequired = template.fields
    .filter((field) => field.required && byKey.get(field.key)?.column === null)
    .map((field) => field.label);
  const allExact = template.fields.every((field) => {
    const match = byKey.get(field.key);
    return match?.column === null ? !field.required : match?.kind === "exact";
  });
  const confidence: Confidence =
    missingRequired.length > 0 ? "none" : allExact ? "full" : "partial";
  return { confidence, missingRequired };
}

/** 用指定模板与表头行重算计划（用户在映射页切换模板时使用） */
export function planFor(
  sheet: RawSheet,
  type: TemplateType | null,
  headerRow: number,
  overrides?: Readonly<Record<string, number | null>>,
): SheetPlan {
  const headers = headersOf(sheet.rows.find((row) => row.rowNumber === headerRow));
  if (type === null) {
    return { sheet: sheet.name, type: null, headerRow, headers, matches: [], confidence: "none", missingRequired: [] };
  }
  const template = getTemplate(type);
  let matches = buildMatches(template, headers);
  if (overrides) {
    matches = matches.map((match) => {
      if (!(match.fieldKey in overrides)) {
        return match;
      }
      const column = overrides[match.fieldKey];
      if (column === null || column === undefined || column < 0 || column >= headers.length) {
        return { fieldKey: match.fieldKey, column: null, header: null, kind: null };
      }
      if (column === match.column) {
        return match;
      }
      return { fieldKey: match.fieldKey, column, header: headers[column] || null, kind: "manual" };
    });
  }
  return { sheet: sheet.name, type, headerRow, headers, matches, ...summarize(template, matches) };
}

interface Candidate {
  readonly type: TemplateType;
  readonly headerRow: number;
  readonly matched: number;
  readonly requiredMatched: number;
  readonly requiredTotal: number;
}

function score(candidate: Candidate): number {
  // 必填覆盖率优先，其次匹配字段数
  return (candidate.requiredMatched / candidate.requiredTotal) * 100 + candidate.matched;
}

/**
 * 识别工作表对应的模板与表头行。
 * 在前 10 行里逐行尝试 6 套模板，取「必填字段覆盖率 + 匹配字段数」最高的组合；
 * 一个字段都没匹配上则视为未识别（type = null）。
 */
export function detectSheet(sheet: RawSheet): SheetPlan {
  const firstRow = sheet.rows[0]?.rowNumber ?? 1;
  if (sheet.name === FIELD_GUIDE_SHEET) {
    return planFor(sheet, null, firstRow);
  }

  let best: Candidate | null = null;
  for (const row of sheet.rows.slice(0, HEADER_SCAN_ROWS)) {
    const headers = headersOf(row);
    for (const template of TEMPLATES) {
      const matches = buildMatches(template, headers);
      const required = template.fields.filter((field) => field.required);
      const mapped = new Set(matches.filter((match) => match.column !== null).map((match) => match.fieldKey));
      const candidate: Candidate = {
        type: template.type,
        headerRow: row.rowNumber,
        matched: mapped.size,
        requiredMatched: required.filter((field) => mapped.has(field.key)).length,
        requiredTotal: required.length,
      };
      if (candidate.matched > 0 && (best === null || score(candidate) > score(best))) {
        best = candidate;
      }
    }
  }

  if (best === null) {
    return planFor(sheet, null, firstRow);
  }
  return planFor(sheet, best.type, best.headerRow);
}

export function detectSheets(sheets: readonly RawSheet[]): SheetPlan[] {
  return sheets.map(detectSheet);
}
