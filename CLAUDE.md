# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

中文回答；

## 项目

餐饮经营分析系统 Demo · 收入分析模块。把高维学堂 Excel 经营分析体系（利润桥、收入结构、收入异动下钻）做成 Next.js Web 页面。远程仓库：https://github.com/c4thmy/canyin-sys-demo

## 常用命令

```bash
npm run dev                 # next dev --webpack，http://localhost:3000
npm run build               # next build --webpack
npm test                    # vitest run（只收 app/**/__tests__/**/*.test.ts）
npx vitest run app/lib/metrics/__tests__/traffic.test.ts   # 单个测试文件
npx vitest run -t "用例名"  # 按用例名过滤
npm run typecheck           # tsc --noEmit
bash scripts/smoke.sh       # 构建 + next start -p 3100 + 断言 7 条路由 200 与关键文案
bash scripts/smoke.sh --docker   # docker compose 版本（端口 3000）

openspec list / openspec view / openspec validate --all / openspec archive <name>
python3 scripts/extract_seed.py <源Excel> [输出目录]   # 从 Excel 重新抽取 data/seed/*.json（需 openpyxl）
```

dev/build 必须带 `--webpack`（脚本已写好，别去掉）。

## 硬性约定（详见 AGENTS.md，优先级最高）

- 所有修改必须落在 `openspec/changes/<change-id>/`：新功能先 `openspec new change`，写 proposal → specs → design → tasks，用户确认后再写代码；小改在进行中 change 的 `tasks.md` 追加并勾选；完成后 `openspec archive`。OpenSpec 产物用中文，结构标题与 SHALL/MUST 保持英文。
- 指标口径以 `docs/domain/revenue-analysis-model.md` 为准。新增指标先写进领域模型再写代码，每个指标要有单测 + 手算对照。
- 合并闸门：`openspec validate --all`、构建、测试全部通过。
- 提交信息中文，`type: 说明`（feat/fix/docs/chore/test/refactor），一个逻辑改动一个提交。仓库可能有其他 Agent 并发写文件，提交前看 `git status`，只 add 自己改的文件，不要 `git add -A`。
- AGENTS.md 里按角色划分了可写目录（metrics/api/scripts/data 归数据工程师，`app/components/` 与页面归前端），按任务角色控制改动范围。

## 架构

数据流是单向的四层，没有数据库和 API 调用：

1. `data/seed/*.json`：由 `scripts/extract_seed.py` 从 Excel 抽出的静态样例数据。每个文件带 `provenance`（来源工作表 + 单元格范围），数值按期间 id（如 `"2025-09"`）存在 `Record<string, number>` 里；推算值标 `derived`。字段说明见 `data/dictionary.md`。
2. `app/lib/seed.ts`：`loadSeed()` 用 `node:fs` 同步读取全部 seed 并做模块级缓存，把原始结构转成 `metrics/types.ts` 中的类型。只能在服务端用。
3. `app/lib/metrics/`：纯函数指标引擎（聚合、同店/新店拆分、客流×客单价连环替代、利润桥、渠道 ROI、漏斗、产品结构、结论引擎 `generateInsights` 等），统一从 `metrics/index.ts` 导出。期间用 `resolvePeriodPair("2025-09")` 自动得出上年同期；缺失期间按 0 处理（新店上年无收入）。阈值常量（`ROI_THRESHOLDS`、`INSIGHT_THRESHOLDS` 等）放在对应模块里。
4. `app/lib/*-view.ts`：每个页面一个 view builder（如 `buildChannelView()`），调用 `loadSeed` + metrics，产出已排序、已格式化（`format.ts`）的页面数据。页面逻辑尽量放这里，便于单测。
5. 页面 `app/**/page.tsx` 是服务端组件，调用 view builder 后交给 `app/components/` 渲染。只有交互组件（ECharts 图表、可点击行、Tab 切换）标 `"use client"`。

路由：`/` 总览、`/revenue/structure`、`/revenue/same-store`、`/revenue/store/[id]`、`/revenue/channel`、`/revenue/product`、`/insights`。

其他要点：

- `app/lib/theme.ts` 是唯一设计常量来源（数据色上升绿/下降红/总计蓝、版式、字号阶梯、指标口径说明），Tailwind 配置、组件、ECharts 和单测共用。组件里不要硬编码颜色或 `text-[13px]` 这类值。
- 本地导入写 `.js` 后缀（ESM + `moduleResolution: bundler`），如 `import { loadSeed } from "./seed.js"`。
- 演示材料在 `docs/demo/`（演示脚本、答疑清单、各页截图）；多 Agent 协作设计见 `docs/architecture.md` 与 `docs/agents/roles.md`。
