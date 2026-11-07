import ExcelJS from "exceljs";

import { VALIDATION_THRESHOLDS } from "./validate.js";
import type { CellValue } from "./values.js";

/** 解析后的一张工作表：保留原始行号（1 起，与 Excel 一致） */
export interface RawSheet {
  readonly name: string;
  readonly rows: readonly RawRow[];
}

export interface RawRow {
  readonly rowNumber: number;
  readonly cells: readonly CellValue[];
}

export type UploadKind = "xlsx" | "csv";

export class ParseError extends Error {}

/** 由扩展名推断文件类型；不在白名单内返回 null */
export function uploadKindOf(fileName: string): UploadKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    return "xlsx";
  }
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  return null;
}

/** 魔数检查：xlsx 是 zip（PK\x03\x04）；csv 不得含 NUL 字节 */
export function checkMagic(kind: UploadKind, bytes: Uint8Array): boolean {
  if (kind === "xlsx") {
    return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  }
  const head = bytes.subarray(0, 4096);
  return !head.includes(0);
}

function primitiveOf(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "object") {
    if ("result" in value) {
      return primitiveOf((value as { result?: ExcelJS.CellValue }).result ?? null);
    }
    if ("richText" in value) {
      return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join("");
    }
    if ("text" in value) {
      return String((value as { text: unknown }).text);
    }
    if ("error" in value) {
      return null;
    }
  }
  return null;
}

function trimRows(rows: RawRow[]): RawRow[] {
  return rows.filter((row) => row.cells.some((cell) => cell !== null && !(typeof cell === "string" && cell.trim() === "")));
}

function assertRowLimit(total: number): void {
  if (total > VALIDATION_THRESHOLDS.maxRows) {
    throw new ParseError(`行数超过上限 ${VALIDATION_THRESHOLDS.maxRows}，请拆分文件后上传`);
  }
}

async function parseXlsx(bytes: Uint8Array): Promise<RawSheet[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw new ParseError("无法读取 xlsx 文件，请确认文件未损坏且不是加密文件");
  }
  const sheets: RawSheet[] = [];
  let total = 0;
  workbook.eachSheet((worksheet) => {
    const rows: RawRow[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: CellValue[] = [];
      const width = row.cellCount;
      for (let column = 1; column <= width; column += 1) {
        cells.push(primitiveOf(row.getCell(column).value));
      }
      rows.push({ rowNumber, cells });
    });
    total += rows.length;
    assertRowLimit(total);
    sheets.push({ name: worksheet.name, rows: trimRows(rows) });
  });
  return sheets;
}

/** RFC 4180 风格的 CSV 解析：支持引号、转义引号、引号内换行；自动识别 UTF-8 BOM 与 GBK */
export function parseCsvText(text: string): RawRow[] {
  const rows: RawRow[] = [];
  let cells: CellValue[] = [];
  let field = "";
  let quoted = false;
  let rowNumber = 1;
  let startRow = 1;

  const pushField = () => {
    cells.push(field === "" ? null : field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push({ rowNumber: startRow, cells });
    cells = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (char === "\n") {
          rowNumber += 1;
        }
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      pushRow();
      rowNumber += 1;
      startRow = rowNumber;
    } else {
      field += char;
    }
  }
  if (field !== "" || cells.length > 0) {
    pushRow();
  }
  return trimRows(rows);
}

function decodeCsv(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!utf8.includes("�")) {
    return utf8.replace(/^﻿/, "");
  }
  // Excel 中文版默认把 CSV 存成 GBK
  return new TextDecoder("gbk").decode(bytes);
}

/** 解析上传文件为工作表列表；CSV 视为单张工作表，名称取文件名 */
export async function parseUpload(kind: UploadKind, bytes: Uint8Array, fileName: string): Promise<RawSheet[]> {
  if (kind === "xlsx") {
    return parseXlsx(bytes);
  }
  const rows = parseCsvText(decodeCsv(bytes));
  assertRowLimit(rows.length);
  return [{ name: fileName.replace(/\.csv$/i, ""), rows }];
}
