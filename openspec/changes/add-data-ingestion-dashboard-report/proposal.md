# Proposal

## Why

现有 Demo 只能展示从固定 Excel 抽出的 `data/seed/*.json`，换一家客户就要开发者手工跑 `extract_seed.py`。要验证「6 万元/套」的商用形态，客户必须能**自己下载模板 → 填数 → 上传 → 看到看板与报告**。参考 Profit Pilot V2（ppv2.broadmind.cn）的「数据中心 → 数据看板 → 报告中心」链路，补齐这一闭环。

## What Changes

- **数据模板**：提供 6 套标准导入模板（门店收入、门店客流、渠道收入、产品销售、利润表、线上漏斗），可下载 `.xlsx`，每套模板带字段说明与示例行。
- **数据处理引擎**：上传 `.xlsx/.csv` → 解析 → 表头自动映射（支持别名，用户可手工改）→ 校验（必填、类型、期间格式、勾稽关系）→ 标准化为现有 `SeedData` 结构 → 生效；按「批次」管理，支持回滚与重置。
- **数据集切换**：系统可在「演示数据」与「已导入数据」之间切换，现有 7 个分析页面不改算法、自动用当前数据集。
- **数据看板**：新增 `/dashboard`，多期 KPI 趋势（收入、客流、客单价、营业利润）、门店排行、数据完整度与质量提示。
- **分析报告**：新增 `/reports`，基于报告模板（老板版 / 运营版）把指标引擎与结论引擎的结果组装成章节化报告，可在线预览、打印为 PDF、导出 HTML。

## Capabilities

### New Capabilities

- `data-ingestion`: 导入模板、上传解析、字段映射、校验、标准化、批次与数据集管理。
- `analysis-report`: 报告模板、报告生成、预览与导出。

### Modified Capabilities

- `revenue-analysis`: 新增「数据看板」需求，并要求所有分析页基于当前激活的数据集计算（以 ADDED 形式追加，不改动已有需求）。

## Out of Scope

- 登录、多租户、权限（Demo 继续单用户，见 design 风险一节）
- 收银系统 / 外卖平台 API 直连、AI 自动生成模板与 Copilot 对话
- 菜单诊断、BCG、九宫格等参考站其他模块

## Impact

- 新增 `app/api/ingestion/*`、`app/api/templates/*`、`app/api/reports/*` 路由处理器（首次引入服务端写接口）
- 新增 `app/lib/ingestion/`（解析、映射、校验、标准化）与 `app/lib/report/`
- `app/lib/seed.ts` 改为「按激活数据集加载」，接口签名保持兼容
- 新增运行时目录 `data/uploads/`（加入 `.gitignore`）
- 新增依赖：`exceljs`（读写 xlsx，锁定精确版本）
- 领域模型 `docs/domain/revenue-analysis-model.md` 追加：数据完整度、环比、报告章节口径
