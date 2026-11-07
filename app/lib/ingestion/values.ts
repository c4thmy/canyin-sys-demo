/**
 * 单元格取值的归一化：期间、数值、布尔。
 * 全部为纯函数，解析失败返回 null，由调用方决定报错文案。
 */

export type CellValue = string | number | boolean | Date | null;

const MONTH_NAMES = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function pad(month: number): string {
  return String(month).padStart(2, "0");
}

function fromYearMonth(year: number, month: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return null;
  }
  return `${year}-${pad(month)}`;
}

/** Excel 日期序列号（1900 系统）转 UTC 日期 */
function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

/**
 * 期间归一化为 YYYY-MM。
 * 接受：2025-09、2025/9、2025.09、2025年9月、202509、2025-09-01、Date、Excel 日期序列号。
 */
export function normalizePeriod(value: CellValue): string | null {
  if (value === null || typeof value === "boolean") {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return fromYearMonth(value.getUTCFullYear(), value.getUTCMonth() + 1);
  }
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 200001 && value <= 210012) {
      return fromYearMonth(Math.floor(value / 100), value % 100);
    }
    if (value > 20000 && value < 80000) {
      const date = excelSerialToDate(value);
      return fromYearMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
    }
    return null;
  }

  const text = value.trim();
  const compact = /^(\d{4})(\d{2})$/.exec(text);
  if (compact) {
    return fromYearMonth(Number(compact[1]), Number(compact[2]));
  }
  const separated = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*(?:月)?(?:\s*[-/.]\s*\d{1,2}\s*日?)?$/.exec(text);
  if (separated && MONTH_NAMES.includes(String(Number(separated[2])))) {
    return fromYearMonth(Number(separated[1]), Number(separated[2]));
  }
  return null;
}

/** 期间展示名：2025-09 → 2025年9月 */
export function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${year}年${Number(month)}月`;
}

/** 数值归一化：去掉千分位、货币符号与常见单位后缀 */
export function normalizeNumber(value: CellValue): number | null {
  if (value === null || typeof value === "boolean" || value instanceof Date) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = value
    .trim()
    .replace(/[,，\s]/g, "")
    .replace(/^[¥￥]/, "")
    .replace(/(万元|元|人次|人|份)$/, "");
  if (text === "" || !/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(text)) {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

const TRUE_WORDS = new Set(["是", "y", "yes", "true", "1", "新店", "新"]);
const FALSE_WORDS = new Set(["否", "n", "no", "false", "0", "老店", "同店", "老"]);

export function normalizeBoolean(value: CellValue): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1 ? true : value === 0 ? false : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().toLowerCase();
  if (TRUE_WORDS.has(text)) {
    return true;
  }
  if (FALSE_WORDS.has(text)) {
    return false;
  }
  return null;
}

/** 文本归一化：数字转字符串，去首尾空白；空串视为缺失 */
export function normalizeText(value: CellValue): string | null {
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function isBlank(value: CellValue): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}
