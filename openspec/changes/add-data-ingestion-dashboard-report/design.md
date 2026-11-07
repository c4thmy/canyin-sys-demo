# Design

## Context

当前数据流是单向四层：`data/seed/*.json` → `loadSeed()` → `metrics/` 纯函数 → `*-view.ts` → 页面。没有数据库、没有写接口。参考站 Profit Pilot V2 的导入链路为「上传 → 解析（analyze）→ 确认映射（confirm-mapping）→ 执行（execute）→ 可回滚（rollback）」，以批次为单位；报告中心分「报告列表 / 报告模板」，模板按受众分级（老板 / 运营）。本设计按这条链路做，规模缩到 Demo 够用。

## Goals / Non-Goals

**Goals**
- 指标引擎 `metrics/` 零改动：导入数据最终标准化为现有 `SeedData` 结构
- 用户只靠浏览器完成「下载模板 → 上传 → 映射 → 校验 → 生效 → 看板 → 报告」
- 每个导入数字可追溯到批次 + 文件 + 工作表 + 行号

**Non-Goals**
- 登录 / 多租户 / 权限；数据库；外部系统直连；AI 生成

## Decisions

### 决策一：存储继续用文件，不引入 SQLite

延续归档 change 的决策四。目录结构：

```
data/
  seed/                     # 演示数据集（只读，入库）
  uploads/                  # 运行时，.gitignore
    files/<batchId>.<ext>   # 原始文件
    batches/<batchId>.json  # 批次元数据 + 映射 + 校验报告 + 标准化结果
    dataset/                # 已导入数据集（结构同 seed/，由批次合并生成）
    reports/<reportId>.json # 报告快照
    active.json             # { "dataset": "demo" | "imported" }
```

写入用「写临时文件 + rename」保证原子性。数据集由「所有已生效批次按生效顺序合并」重算，回滚 = 把批次标记为已回滚后重算，天然幂等。
替代方案：SQLite（better-sqlite3）。等出现并发写或多租户需求再换，接口层 `DatasetStore` 已抽象。

### 决策二：模板定义为单一 TS 常量

`app/lib/ingestion/templates.ts` 定义 6 套模板：

| type | 名称 | 主键 | 必填字段 | 映射到 |
|---|---|---|---|---|
| `store_revenue` | 门店收入 | 门店编号+期间 | 门店编号、门店名、区域、是否新店、期间、收入（万元） | `stores` |
| `store_traffic` | 门店客流 | 门店编号+期间 | 门店编号、期间、客流（人次）、客单价（元） | `traffic` |
| `channel_revenue` | 渠道收入 | 渠道+期间 | 渠道、期间、收入（万元） | `channels` |
| `product_sales` | 产品销售 | 系列+期间 | 系列、期间、销量、单价、收入；选填成本 | `categories` |
| `pnl` | 利润表 | 科目+期间 | 科目、期间、金额（万元） | `pnl` |
| `online_funnel` | 线上漏斗 | 门店编号+月份 | 门店编号、月份、曝光、访问、支付、消费 | `funnel` |

每个字段含 `key / label / aliases / type / unit / required / example`。模板 xlsx 下载、表头映射、校验、数据字典页都从这一处生成，避免口径漂移。时段客流、获客、套餐三类数据本期不开放导入，导入数据集缺少时相应区块走「数据不完整」降级。

### 决策三：处理引擎 = 纯函数流水线

```
parse(file)        -> RawSheet[]            exceljs / CSV 解析，保留行号
detect(sheets)     -> { type, mapping, confidence }   精确 > 别名 > 归一化后包含匹配
validate(rows)     -> { errors[], warnings[] }        类型、期间格式、必填、主键重复、勾稽
normalize(rows)    -> Partial<SeedData> + provenance  单位换算（元→万元等由模板声明）
merge(batches)     -> SeedData                        同主键后到覆盖先到
```

全部位于 `app/lib/ingestion/`，无 I/O，单测覆盖。I/O 只在 `app/api/ingestion/*` 路由处理器和 `DatasetStore` 中。勾稽规则（收入 ≈ 客流×客单价、渠道合计 ≈ 门店合计、利润表营业利润闭合）阈值常量 `VALIDATION_THRESHOLDS` 放在 `validate.ts`，默认 1%。

### 决策四：`loadSeed()` 改为按激活数据集加载

`loadSeed()` 签名不变，内部读取 `active.json` 决定目录；缓存键改为「数据集 + 版本号」，导入/回滚/切换后版本号自增，缓存失效。页面加 `export const dynamic = "force-dynamic"`，避免构建期静态化固化演示数据。期间列表从数据集中的 `meta.periods` 读取，`resolvePeriodPair` 对缺失上年同期返回 `null`，view 层显示「—」。

### 决策五：API 路由

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/templates` | 模板列表 |
| GET | `/api/templates/[type]/download` | 生成并下载 xlsx |
| POST | `/api/ingestion/upload` | multipart 上传，返回 batchId |
| POST | `/api/ingestion/batches/[id]/analyze` | 解析 + 识别 + 预校验 |
| POST | `/api/ingestion/batches/[id]/confirm-mapping` | 提交人工映射，重跑校验 |
| POST | `/api/ingestion/batches/[id]/execute` | 生效 |
| POST | `/api/ingestion/batches/[id]/rollback` | 回滚 |
| GET/DELETE | `/api/ingestion/batches[/id]` | 列表 / 详情 / 删除 |
| PUT | `/api/dataset/active` | 切换数据集 |
| POST/GET/DELETE | `/api/reports[/id]` | 生成 / 列表 / 详情 / 删除 |
| GET | `/api/reports/[id]/export/html` | 导出 HTML |

上传校验：扩展名白名单（xlsx/csv）+ 魔数检查 + 10 MB 上限 + 行数上限 5 万；文件名不参与落盘路径（只用 batchId），防路径穿越。

### 决策六：页面

| 路由 | 内容 |
|---|---|
| `/data` | 数据中心：数据集切换、完整度矩阵、批次列表 |
| `/data/templates` | 6 张模板卡片 + 下载 |
| `/data/import` | 四步向导：上传 → 映射确认 → 校验报告 → 生效 |
| `/dashboard` | KPI 卡（本期/同比/环比）、多期趋势、门店排行、完整度 |
| `/reports` | 报告列表 + 生成对话框（期间、模板） |
| `/reports/templates` | 两套模板章节目录 |
| `/reports/[id]` | 报告预览（打印样式）+ 导出 |

顶部加全局「当前数据集」标识。新组件复用 `theme.ts`，图表复用现有 ECharts 封装。

### 决策七：报告 = 模板 × 结论引擎 × 快照

报告模板为 TS 常量，章节引用 view builder 的输出（如 `buildOverview`、`buildInsightsView`），叙述句用模板字符串填数，不调用大模型。生成时把章节渲染所需数据整体写入 `reports/<id>.json` 快照，保证历史报告不随数据变化。PDF 走浏览器打印 + `@media print` 样式，不引入 headless 浏览器。

**修订（实现时）**：图表不走「客户端 `getDataURL()` 回传 PNG」，改为服务端 ECharts SSR（`renderer: "svg", ssr: true`）生成 SVG 字符串，随快照一起保存。理由：不依赖浏览器回传，图与数在生成时一起冻结，导出的 HTML 天然离线可看；渲染与导出前统一清洗 SVG（去 `<script>`、事件属性、`javascript:`），导出响应附带严格 CSP。

## Risks / Trade-offs

- **无鉴权的写接口**：上传、回滚、删除接口对任何能访问端口的人开放。Demo 只在本地 / 内网演示；部署到公网前必须加鉴权（至少 Basic Auth 中间件），已在 tasks 中列为上线前检查项。
- **文件存储并发**：两个请求同时生效批次可能互相覆盖。用进程内互斥锁 + 原子 rename，单实例足够；多实例需迁移数据库。
- **Docker 持久化**：`data/uploads/` 需挂载卷，否则容器重建后导入数据丢失。
- **口径风险**：用户数据单位填错（元填成万元）会让数字差 1 万倍。模板显式标注单位，校验增加数量级警告（单店月收入 > 1 万万元或 < 0.01 万元）。
- **新依赖** `exceljs` 体积较大，仅在服务端路由使用，不进客户端包。

## Migration Plan

演示数据集保持默认激活，未导入任何数据时系统行为与当前完全一致；冒烟脚本新增 `/dashboard`、`/data`、`/reports` 三条路由断言。

## Open Questions

1. 期间粒度是否只支持月度（`YYYY-MM`）？本设计默认是。
2. 报告是否需要 PPT 导出？本设计默认不做，留接口。
