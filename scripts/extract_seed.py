#!/usr/bin/env python3
"""从高维学堂 Excel 抽取收入分析样例数据。

用法：
    python3 scripts/extract_seed.py <源Excel路径> [输出目录]

输出 data/seed/*.json，每块数据带 provenance（来源工作表 + 单元格范围）。
真实值原样保留；推算值标 derived=true 并写明公式。

依赖：openpyxl
"""
import json
import os
import sys
from datetime import date

P_OLD = "2024-09"
P_NEW = "2025-09"


def load(path):
    import openpyxl
    return openpyxl.load_workbook(path, data_only=True)


def cell(ws, ref):
    v = ws[ref].value
    if isinstance(v, (int, float)):
        return round(float(v), 4)
    return v


def num(ws, ref):
    """只取数值；空值、'--'、错误值返回 None。"""
    v = ws[ref].value
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 4)
    return None


def parse_channels(ws):
    rows = []
    for r in range(4, 14):
        name = ws[f"B{r}"].value
        if not name:
            continue
        rows.append({
            "name": str(name).strip(),
            "revenue": {P_OLD: cell(ws, f"C{r}"), P_NEW: cell(ws, f"E{r}")},
        })
    return {
        "provenance": {"sheet": ws.title, "range": "B3:F13", "note": "单位：万元"},
        "items": rows,
    }


def parse_stores(ws):
    regions = {"区域一": (18, 22), "区域二": (23, 27), "区域三": (28, 32)}
    stores = []
    idx = 0
    for region, (start, end) in regions.items():
        for r in range(start, end + 1):
            name = ws[f"D{r}"].value
            if not name:
                continue
            idx += 1
            nm = str(name).strip()
            stores.append({
                "id": f"S{idx:02d}",
                "name": nm,
                "region": region,
                "is_new": nm.startswith("新店"),
                "revenue": {P_OLD: cell(ws, f"E{r}"), P_NEW: cell(ws, f"F{r}")},
            })
    return {
        "provenance": {"sheet": ws.title, "range": "B17:F32", "note": "单位：万元；新店 2024 年为 0"},
        "items": stores,
    }


def _norm(name):
    return str(name).strip().rstrip("类")


def parse_categories(wb):
    ws = wb["第二步-收入异动分析"]
    # 左块 B28:H36：B=名称, C=2025销量, F=2024销量
    left = {}
    for r in range(29, 37):
        name = ws[f"B{r}"].value
        if not name:
            continue
        left[_norm(name)] = {"qty_old": cell(ws, f"F{r}"), "qty_new": cell(ws, f"C{r}")}
    rows = []
    for i, r in enumerate(range(27, 35), start=1):
        name = ws[f"Z{r}"].value
        if not name:
            continue
        key = _norm(name)
        q = left.get(key, {})
        qty_new = q.get("qty_new") or cell(ws, f"AA{r}")
        qty_old = q.get("qty_old")
        price_new = cell(ws, f"AE{r}")
        rev_new = cell(ws, f"AC{r}")  # 万元
        cost_new = cell(ws, f"AF{r}")  # 万元
        # 2024 收入 Excel 未存值，按 2024 销量 × 2025 平均单价推算
        rev_old = round(qty_old * price_new / 10000, 4) if qty_old and price_new else None
        rows.append({
            "id": f"K{i:02d}",
            "name": str(name).strip(),
            "qty": {P_OLD: qty_old, P_NEW: qty_new},
            "unit_price": {P_NEW: price_new},
            "revenue": {P_OLD: rev_old, P_NEW: rev_new},
            "cost": {P_NEW: cost_new},
            "derived": {"revenue_2024": "销量2024 × 单价2025（Excel 未存值）"},
        })
    # 让推算的 2024 合计等于门店口径的真实合计，避免演示时对不上
    target = 759.95
    derived_sum = sum(r["revenue"][P_OLD] or 0 for r in rows)
    if derived_sum:
        scale = target / derived_sum
        for r in rows:
            if r["revenue"][P_OLD]:
                r["revenue"][P_OLD] = round(r["revenue"][P_OLD] * scale, 4)
                r["derived"]["revenue_2024"] = "销量2024 × 单价2025，再按门店口径同店合计 759.95 等比缩放"
    return {
        "provenance": {
            "sheet": ws.title,
            "range": "B27:H36 + Z26:AG34",
            "note": "收入与成本单位：万元；单价单位：元/份",
        },
        "items": rows,
    }


def parse_traffic(wb, stores):
    """表6：同店收入是客流原因还是客单价原因。真实客流与客单价，两期都有。"""
    ws = wb["第二步-收入异动分析"]
    by_name = {s["name"]: s["id"] for s in stores}
    rows = []
    for r in list(range(83, 96)) + [97, 98]:
        name = ws[f"B{r}"].value
        if not name:
            continue
        nm = str(name).strip()
        rows.append({
            "store_id": by_name.get(nm, nm),
            "name": nm,
            "traffic": {P_OLD: num(ws, f"F{r}"), P_NEW: num(ws, f"C{r}")},
            "ticket": {P_OLD: num(ws, f"G{r}"), P_NEW: num(ws, f"D{r}")},
        })
    return {
        "provenance": {
            "sheet": ws.title,
            "range": "B80:N98",
            "note": "客流单位：人次/月；客单价单位：元/人次；收入(万元)=客流×客单价/10000",
        },
        "items": rows,
    }


def parse_bundles(wb):
    """收入异动分析表4：同店线上套餐的销量与销售额（2025 与 2024 两张并列表）。

    源表存在双重转义的引号（同名套餐写法不同），且同名套餐可能出现多次。
    这里按「逐行保留 + 名称解码 + 按名称顺序配对两期」处理，不合并、不丢行。
    """
    import html
    from collections import deque
    ws = wb["第二步-收入异动分析"]

    def clean(v):
        if v is None:
            return None
        t = str(v)
        for _ in range(3):
            new = html.unescape(t)
            if new == t:
                break
            t = new
        return t.strip() or None

    def grab(name_col, qty_col, amt_col, disc_col, r0, r1):
        out = []
        for r in range(r0, r1 + 1):
            nm = clean(ws[f"{name_col}{r}"].value)
            if not nm or nm in ("合计",):
                continue
            out.append({
                "name": nm,
                "qty": num(ws, f"{qty_col}{r}"),
                "amount": num(ws, f"{amt_col}{r}"),
                "discount": num(ws, f"{disc_col}{r}"),
            })
        return out

    new_rows = grab("AJ", "AM", "AO", "AS", 2, 34)
    old_rows = grab("AV", "AY", "BA", "BE", 2, 34)

    old_by_name = {}
    for r in old_rows:
        old_by_name.setdefault(r["name"], deque()).append(r)

    rows = []
    for i, n in enumerate(new_rows, start=1):
        o = None
        bucket = old_by_name.get(n["name"])
        if bucket:
            o = bucket.popleft()
        rows.append({
            "id": f"B{i:02d}",
            "name": n["name"],
            "qty": {P_NEW: n["qty"], P_OLD: o["qty"] if o else None},
            "amount": {P_NEW: n["amount"], P_OLD: o["amount"] if o else None},
            "discount": {P_NEW: n["discount"], P_OLD: o["discount"] if o else None},
        })
    # 只在 2024 出现、没有配对的套餐
    extra = [r for bucket in old_by_name.values() for r in bucket]
    for o in extra:
        rows.append({
            "id": f"B{len(rows) + 1:02d}",
            "name": o["name"],
            "qty": {P_NEW: None, P_OLD: o["qty"]},
            "amount": {P_NEW: None, P_OLD: o["amount"]},
            "discount": {P_NEW: None, P_OLD: o["discount"]},
        })
    return {
        "provenance": {
            "sheet": ws.title,
            "range": "AJ1:AT34（2025）+ AV1:BF34（2024）",
            "note": "套餐维度；金额单位元（原表单位），数量单位份；名称已解码 HTML 实体",
        },
        "items": rows,
    }


def parse_acquisition(wb):
    """表8：增收提价的预算与目标。新客获取成本、产投比、目标 ROI。"""
    ws = wb["第二步-收入异动分析"]
    rows = []
    for r in (119, 120):
        name = ws[f"B{r}"].value
        if not name:
            continue
        new_customers = num(ws, f"C{r}")
        convert = num(ws, f"D{r}")
        ticket = num(ws, f"E{r}")
        margin = num(ws, f"G{r}")
        cost = num(ws, f"I{r}")
        target_roi = num(ws, f"M{r}")
        # Excel 未存值，按表内公式推算
        revenue = round(new_customers * ticket / 10000, 4) if new_customers and ticket else None
        gross = round(revenue * margin, 4) if revenue and margin else None
        spend = round(new_customers * cost / 10000, 4) if new_customers and cost else None
        output_ratio = round(gross / spend, 4) if gross and spend else None
        actual_roi = round(revenue / spend, 4) if revenue and spend else None
        rows.append({
            "channel": str(name).strip(),
            "new_customers": new_customers,
            "exposure_conversion": convert,
            "ticket": ticket,
            "gross_margin_rate": margin,
            "new_customer_cost": cost,
            "target_roi": target_roi,
            "revenue": revenue,
            "gross_profit": gross,
            "spend": spend,
            "output_ratio": output_ratio,
            "actual_roi": actual_roi,
            "meets_target": (output_ratio >= target_roi) if (output_ratio is not None and target_roi) else None,
            "derived": "收入=新客量×客单价；毛利额=收入×毛利率；投入=新客量×新客成本；产投比=毛利额÷投入；实际ROI=收入÷投入",
        })
    return {
        "provenance": {
            "sheet": ws.title,
            "range": "B117:M121",
            "note": "C/D/E/G/I/M 为 Excel 原值（预算与目标），其余按表内公式推算；金额单位万元",
        },
        "items": rows,
    }


def parse_time_slots(wb):
    """表7：客流异动下钻到时段。工作日/节假日的分时段日均客流。"""
    ws = wb["第二步-收入异动分析"]
    slots = [
        ("工作日", "正常段", "9:00-14:00", 106),
        ("工作日", "正常段", "14:00-24:00", 107),
        ("工作日", "夜宵", "24:00-5:00", 108),
        ("节假日", "正常段", "9:00-14:00", 110),
        ("节假日", "正常段", "14:00-24:00", 111),
        ("节假日", "夜宵", "24:00-5:00", 112),
    ]
    rows = [{
        "day_type": d,
        "segment": seg,
        "span": span,
        "traffic": {P_OLD: num(ws, f"E{r}"), P_NEW: num(ws, f"F{r}")},
    } for d, seg, span, r in slots]
    return {
        "provenance": {"sheet": ws.title, "range": "B103:H114", "note": "单位：人次/日（分时段日均）"},
        "items": rows,
    }


def parse_pnl(wb):
    ws = wb["第一步-2509餐饮利润桥"]
    items = [
        ("营业收入", 7, None),
        ("食材成本", 8, 267.0),
        ("优惠及手续费", 9, None),
        ("水电气低值", 10, None),
        ("宣传费用", 11, None),
        ("工资奖金", 12, None),
        ("宿舍房租", 13, None),
        ("店铺房租", 14, None),
        ("其它费用", 15, None),
    ]
    rows = []
    for name, r, override in items:
        old = cell(ws, f"C{r}")
        new = cell(ws, f"E{r}")
        derived = None
        if new is None and override is not None:
            new = override
            derived = "由毛利率 26.7% 推算（Excel 单元格为空）"
        rows.append({"item": name, "values": {P_OLD: old, P_NEW: new}, "derived": derived})
    return {
        "provenance": {"sheet": ws.title, "range": "B6:G15", "note": "单位：万元"},
        "items": rows,
    }


def parse_funnel(wb, stores):
    ws = wb["标杆品牌点评曝光转化数据"]
    rows = []
    for i, s in enumerate(stores[:13], start=2):
        exposure = num(ws, f"B{i}")
        if not exposure:
            continue
        rows.append({
            "store_id": s["id"],
            "month": P_NEW,
            "exposure": exposure,
            "visit_rate": num(ws, f"D{i}"),
            "visits": num(ws, f"G{i}"),
            "pay_rate": num(ws, f"I{i}"),
            "payments": num(ws, f"K{i}"),
            "consume_rate": num(ws, f"M{i}"),
            "consumers": num(ws, f"O{i}"),
            "brand_customers": num(ws, f"Q{i}"),
            "new_customers": num(ws, f"S{i}"),
            "old_customers": num(ws, f"V{i}"),
        })
    return {
        "provenance": {"sheet": ws.title, "range": "A1:W14", "note": "记录数为 13 家门店，按行序映射到 S01–S13"},
        "items": rows,
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "data/seed"
    os.makedirs(out, exist_ok=True)
    wb = load(src)
    ws_struct = wb["第二步-餐饮收入结构分析"]

    stores = parse_stores(ws_struct)
    payload = {
        "meta": {
            "source_file": os.path.basename(src),
            "extracted_at": date.today().isoformat(),
            "periods": [
                {"id": P_OLD, "label": "2024年9月"},
                {"id": P_NEW, "label": "2025年9月"},
            ],
            "currency_unit": "万元",
        },
        "stores": stores,
        "channels": parse_channels(ws_struct),
        "categories": parse_categories(wb),
        "pnl": parse_pnl(wb),
        "funnel": parse_funnel(wb, stores["items"]),
        "traffic": parse_traffic(wb, stores["items"]),
        "time_slots": parse_time_slots(wb),
        "acquisition": parse_acquisition(wb),
        "bundles": parse_bundles(wb),
    }

    for key in ("stores", "channels", "categories", "pnl", "funnel", "traffic", "time_slots", "acquisition", "bundles"):
        path = os.path.join(out, f"{key}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload[key], f, ensure_ascii=False, indent=2)
        n = len(payload[key].get("items", []))
        print(f"wrote {path} ({n} rows)")

    with open(os.path.join(out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(payload["meta"], f, ensure_ascii=False, indent=2)
    print("wrote meta.json")


if __name__ == "__main__":
    main()
