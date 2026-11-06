# Proposal

## Why

用户要在营销课上用一个真实可点的系统，讲清「这家 13 店火锅品牌 9 月收入为什么涨了 240 万」，并以此验证 6 万元级产品的市场接受度。现有能力只存在于 Excel：无法投屏交互、无法逐层下钻、无法自动生成结论。

## What Changes

- 新增 6 个页面：经营总览、收入结构、同店异动、渠道漏斗、产品下钻、结论与计划
- 新增指标引擎：收入拆解、同店/新店拆分、连环替代法三因素分解、渠道漏斗转化
- 新增样例数据：从现有 Excel 抽取并脱敏，可重复导入
- 新增 Docker 部署与冒烟验收脚本

## Capabilities

### New Capabilities

- `revenue-analysis`: 收入分析模块的指标计算、下钻交互与结论生成，是本次 Demo 的产品主体。
- `demo-data`: 样例数据的抽取、脱敏、入库与数据字典，保证演示数字可追溯。

### Modified Capabilities

（无）

## Impact

- 新增 `app/`（Next.js 应用）、`data/`（样例数据）、`scripts/`（导入与部署）
- 依赖：Next.js 15、TypeScript、Tailwind、ECharts、better-sqlite3
- 不影响已有文档与规格
