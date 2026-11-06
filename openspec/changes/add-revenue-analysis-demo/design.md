# Design

## Context

演示数据来自用户现有 Excel（16 个工作表）与 PPT（80 页）。业务口径已在 `docs/domain/revenue-analysis-model.md` 固化。本次只做收入分析模块，但骨架需为后续毛利、费用、顾客模块留接口。

## Goals / Non-Goals

**Goals:**

- 7 天内可演示，数字与 Excel 对得上
- 指标引擎与页面解耦，换页面不换算法
- 商用骨架：多租户字段、数据导入抽象、权限预留

**Non-Goals:**

- 不做用户登录与权限控制
- 不做真实数据接入（只做样例数据）
- 不做报告导出（留接口）

## Decisions

### 决策一：Next.js 15 + SQLite

App Router 做页面，Docker 部署，SQLite 零运维。替代方案：纯静态站点，放弃原因是无法承载数据导入与后续模块。

### 决策二：指标计算放在独立模块

`app/lib/metrics/` 只接收结构化数据，返回计算结果，不依赖 React、不依赖数据库。替代方案：写在 API 路由里，放弃原因是无法单测。

### 决策三：连环替代法统一实现

同店异动、产品下钻、渠道归因共用同一组函数，保证口径一致。

```
客流影响 = 客流差 × 上期客单价
客单价影响 = 本期客流 × 客单价差
```

### 决策四：样例数据用 JSON 种子直读，暂不引入 SQLite

`data/seed/*.json` 是唯一事实来源，应用构建时直接读取；每个文件带 `provenance` 字段记录来源工作表与单元格范围。SQLite 推迟到接入真实客户数据时再引入——演示阶段 13 家门店的数据量用 JSON 足够，且少一层依赖（better-sqlite3 需本地编译）。

## 数据模型

演示数据以 `data/seed/<name>.json` 组织，字段等价于下表：

| 表 | 关键字段 |
|---|---|
| `brand` | id, name |
| `store` | id, brand_id, name, region, area, seats, opened_at, is_same_store |
| `channel` | id, name, type（堂食/外卖/线上/会员） |
| `product` | id, category, name, list_price, std_cost |
| `revenue_daily` | date, store_id, channel_id, orders, guests, revenue, discount |
| `revenue_product_daily` | date, store_id, product_id, qty, revenue, discount |
| `channel_funnel` | month, store_id, channel_id, exposure, visits, payments, consumers |
| `pnl_monthly` | month, store_id, item, amount |
| `model_params` | key, value |

## API

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/overview?month=` | 总览指标 + 利润桥 |
| GET | `/api/revenue/structure?month=&groupBy=` | 维度聚合 |
| GET | `/api/revenue/same-store?month=` | 同店异动 |
| GET | `/api/revenue/channel/:id?month=` | 渠道漏斗 |
| GET | `/api/revenue/product?month=&category=` | 产品下钻 |
| GET | `/api/insights?month=` | 结论生成 |

## 页面

| 路由 | 页面 |
|---|---|
| `/` | 经营总览 |
| `/revenue/structure` | 收入结构 |
| `/revenue/same-store` | 同店异动 |
| `/revenue/channel` | 渠道漏斗 |
| `/revenue/product` | 产品下钻 |
| `/insights` | 结论与计划 |

## Risks / Trade-offs

- **7 天做不完** → 砍到 4 页：总览、结构、渠道、结论
- **数据口径争议** → 先按 Excel 固化，页面标注口径，争议进 backlog
- **图表过多** → 全站只用三种图：瀑布图、漏斗图、柱线组合
- **演示断网** → 全部本地 Docker，不依赖外部服务
