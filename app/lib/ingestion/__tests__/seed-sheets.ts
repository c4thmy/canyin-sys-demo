import { readFileSync } from "node:fs";
import path from "node:path";

import { fieldHeader, getTemplate, type RawSheet, type TemplateType } from "../index.js";

/** 测试夹具：把 data/seed 反向展开成 6 张模板工作表，用来验证「导入后与演示数据一致」 */
const SEED_DIR = path.join(process.cwd(), "data", "seed");
export const seed = (name: string) => JSON.parse(readFileSync(path.join(SEED_DIR, name), "utf8"));

type Cell = string | number | boolean | null;

export function sheetOf(type: TemplateType, rows: readonly Cell[][], headers?: readonly string[]): RawSheet {
  const template = getTemplate(type);
  return {
    name: template.name,
    rows: [headers ?? template.fields.map(fieldHeader), ...rows].map((cells, index) => ({
      rowNumber: index + 1,
      cells,
    })),
  };
}

/** 把 data/seed 反向展开成 6 张模板工作表（每期一行） */
export function seedSheets(): RawSheet[] {
  const meta = seed("meta.json");
  const periods: string[] = meta.periods.map((period: { id: string }) => period.id);
  const stores = seed("stores.json").items;
  const traffic = seed("traffic.json").items;
  const channels = seed("channels.json").items;
  const categories = seed("categories.json").items;
  const pnl = seed("pnl.json").items;
  const funnel = seed("funnel.json").items;

  return [
    sheetOf(
      "store_revenue",
      stores.flatMap((store: any) =>
        periods.map((period) => [store.id, store.name, store.region, store.is_new ? "是" : "否", period, store.revenue[period] ?? 0]),
      ),
    ),
    sheetOf(
      "store_traffic",
      traffic.flatMap((record: any) =>
        periods.map((period) => [record.store_id, period, record.traffic[period] ?? 0, record.ticket[period] ?? 0]),
      ),
    ),
    sheetOf(
      "channel_revenue",
      channels.flatMap((channel: any) => periods.map((period) => [channel.name, period, channel.revenue[period] ?? 0])),
    ),
    sheetOf(
      "product_sales",
      categories.flatMap((category: any) =>
        periods.map((period) => [
          category.name,
          period,
          category.qty[period] ?? 0,
          category.unit_price[period] ?? null,
          category.revenue[period] ?? 0,
          category.cost?.[period] ?? null,
        ]),
      ),
    ),
    sheetOf("pnl", pnl.flatMap((item: any) => periods.map((period) => [item.item, period, item.values[period]]))),
    sheetOf(
      "online_funnel",
      funnel.map((record: any) => [record.store_id, record.month, record.exposure, record.visits, record.payments, record.consumers]),
    ),
  ];
}

