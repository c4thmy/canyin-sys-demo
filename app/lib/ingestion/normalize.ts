import { PNL_ITEMS } from "../metrics/profit-bridge.js";
import type { TemplateType } from "./templates.js";
import type { NormalizedRow, SourceRef } from "./validate.js";
import { periodLabel } from "./values.js";

/**
 * 标准化：把多个批次的标准化行合并成与 data/seed/*.json 完全相同的文件结构，
 * 让 loadSeed() 不区分「演示数据」与「导入数据」。
 *
 * 合并规则：按批次生效顺序叠加，同一「模板 + 主键 + 期间」后到覆盖先到，因此
 * 同一文件重复导入结果不变（幂等），回滚 = 去掉该批次后重新合并。
 */

export interface DatasetFiles {
  readonly "meta.json": unknown;
  readonly "pnl.json": unknown;
  readonly "stores.json": unknown;
  readonly "channels.json": unknown;
  readonly "categories.json": unknown;
  readonly "traffic.json": unknown;
  readonly "time_slots.json": unknown;
  readonly "acquisition.json": unknown;
  readonly "bundles.json": unknown;
  readonly "funnel.json": unknown;
  /** 每个数字的来源：`<文件>|<主键>|<期间>` → 批次 / 文件 / 工作表 / 行号 */
  readonly "lineage.json": unknown;
}

export interface MergeBatch {
  readonly id: string;
  readonly rows: readonly NormalizedRow[];
}

/** 合并后的行，已去重 */
export function mergeRows(batches: readonly MergeBatch[]): NormalizedRow[] {
  const merged = new Map<string, NormalizedRow>();
  for (const batch of batches) {
    for (const row of batch.rows) {
      merged.set(`${row.template}|${row.key}|${row.period}`, row);
    }
  }
  return [...merged.values()];
}

function provenance(template: TemplateType, rows: readonly NormalizedRow[], note: string) {
  const batches = [...new Set(rows.map((row) => row.source.batchId))];
  return {
    sheet: `导入数据 · ${template}`,
    range: batches.length > 0 ? `批次 ${batches.join("、")}` : "（未导入）",
    note,
  };
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

function byPeriod(rows: readonly NormalizedRow[], field: string): Record<string, number> {
  const values: Record<string, number> = {};
  for (const row of [...rows].sort((a, b) => a.period.localeCompare(b.period))) {
    const value = row.values[field];
    if (typeof value === "number") {
      values[row.period] = value;
    }
  }
  return values;
}

const collator = new Intl.Collator("zh-Hans-CN", { numeric: true });

/** 由合并后的行生成数据集文件；`importedAt` 用作 meta.extracted_at */
export function buildDatasetFiles(rows: readonly NormalizedRow[], importedAt: string): DatasetFiles {
  const of = (type: TemplateType) => rows.filter((row) => row.template === type);
  const lineage: Record<string, SourceRef> = {};
  const trace = (file: string, row: NormalizedRow) => {
    lineage[`${file}|${row.key}|${row.period}`] = row.source;
  };

  // 门店：属性以最新期间为准
  const storeRows = of("store_revenue");
  const stores = [...groupBy(storeRows, (row) => row.key)].map(([id, list]) => {
    const latest = [...list].sort((a, b) => b.period.localeCompare(a.period))[0];
    list.forEach((row) => trace("stores.json", row));
    return {
      id,
      name: String(latest.values.store_name),
      region: String(latest.values.region),
      is_new: latest.values.is_new === true,
      revenue: byPeriod(list, "revenue"),
    };
  });
  stores.sort((a, b) => collator.compare(a.id, b.id));
  const storeNames = new Map(stores.map((store) => [store.id, store.name]));

  const traffic = [...groupBy(of("store_traffic"), (row) => row.key)].map(([storeId, list]) => {
    list.forEach((row) => trace("traffic.json", row));
    return {
      store_id: storeId,
      name: storeNames.get(storeId) ?? storeId,
      traffic: byPeriod(list, "traffic"),
      ticket: byPeriod(list, "ticket"),
    };
  });
  traffic.sort((a, b) => collator.compare(a.store_id, b.store_id));

  const channels = [...groupBy(of("channel_revenue"), (row) => row.key)].map(([name, list]) => {
    list.forEach((row) => trace("channels.json", row));
    return { name, revenue: byPeriod(list, "revenue") };
  });

  const categories = [...groupBy(of("product_sales"), (row) => row.key)].map(([name, list], index) => {
    list.forEach((row) => trace("categories.json", row));
    const cost = byPeriod(list, "cost");
    return {
      id: `K${String(index + 1).padStart(2, "0")}`,
      name,
      qty: byPeriod(list, "qty"),
      unit_price: byPeriod(list, "unit_price"),
      revenue: byPeriod(list, "revenue"),
      ...(Object.keys(cost).length > 0 ? { cost } : {}),
    };
  });

  const pnlGroups = groupBy(of("pnl"), (row) => row.key);
  const pnl = PNL_ITEMS.filter((item) => pnlGroups.has(item)).map((item) => {
    const list = pnlGroups.get(item) ?? [];
    list.forEach((row) => trace("pnl.json", row));
    return { item, values: byPeriod(list, "amount"), derived: null };
  });

  const funnel = of("online_funnel")
    .map((row) => {
      trace("funnel.json", row);
      return {
        store_id: row.key,
        month: row.period,
        exposure: row.values.exposure as number,
        visits: row.values.visits as number,
        payments: row.values.payments as number,
        consumers: row.values.consumers as number,
      };
    })
    .sort((a, b) => collator.compare(a.store_id, b.store_id) || a.month.localeCompare(b.month));

  const periods = [...new Set(rows.map((row) => row.period))]
    .sort()
    .map((id) => ({ id, label: periodLabel(id) }));

  return {
    "meta.json": {
      source_file: "用户导入数据",
      extracted_at: importedAt,
      periods,
      currency_unit: "万元",
    },
    "stores.json": { provenance: provenance("store_revenue", storeRows, "单位：万元"), items: stores },
    "traffic.json": {
      provenance: provenance("store_traffic", of("store_traffic"), "客流单位：人次；客单价单位：元"),
      items: traffic,
    },
    "channels.json": {
      provenance: provenance("channel_revenue", of("channel_revenue"), "单位：万元"),
      items: channels,
    },
    "categories.json": {
      provenance: provenance("product_sales", of("product_sales"), "收入与成本单位：万元；单价单位：元/份"),
      items: categories,
    },
    "pnl.json": { provenance: provenance("pnl", of("pnl"), "单位：万元"), items: pnl },
    "funnel.json": { provenance: provenance("online_funnel", of("online_funnel"), "单位：人"), items: funnel },
    // 以下三类本期不开放导入：保留空结构，页面按「数据不完整」降级
    "time_slots.json": { provenance: { sheet: "（未导入）", range: "" }, items: [] },
    "acquisition.json": { provenance: { sheet: "（未导入）", range: "" }, items: [] },
    "bundles.json": { provenance: { sheet: "（未导入）", range: "" }, items: [] },
    "lineage.json": lineage,
  };
}
