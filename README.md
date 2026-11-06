# 餐饮经营分析系统 · 收入分析模块 Demo

> 一个人指挥一支 Agent 团队，7 天做出可用于营销课演示的「餐饮经营分析系统 · 收入分析模块」。

## 这是什么

两件事，一套流程：

1. **产品**：把高维学堂的 Excel 经营分析体系（利润桥、收入结构、收入异动下钻）做成可交互的 Web 系统。
2. **生产方式**：用户通过微信/飞书下达需求 → Agent 团队分角色开发 → OpenSpec 记录全过程 → GitHub 存档。

产品是这套生产方式的第一个作品，也是它的展示品。

## 目录

```
docs/                设计与业务文档
  architecture.md    一人指挥多 Agent 的系统设计
  agents/roles.md    角色定义与分派规则
  domain/            业务领域模型（从 Excel 提炼）
  sprint-7d.md       7 天冲刺计划
openspec/            需求与变更的唯一真相（proposal → specs → archive）
app/                 产品代码
data/                样例数据与数据字典
scripts/             数据导入、构建、部署脚本
.github/workflows/   CI
```

## 远程仓库

https://github.com/c4thmy/canyin-sys-demo

## 规格驱动：所有修改必须留痕

本项目用 OpenSpec 管理每一次修改。规则写在 [AGENTS.md](AGENTS.md)。

```bash
openspec list              # 当前进行中的 change
openspec view              # 仪表盘
openspec validate --all    # 校验
openspec archive <name>    # 完成并归档
```

已归档：`bootstrap-project`（项目初始化）。
进行中：`add-feishu-channel`（飞书接入）、`add-revenue-analysis-demo`（收入分析 Demo）。

## 快速开始

```bash
# 需求与进度
openspec list
openspec view

# 本地运行
npm install
npm run dev          # http://localhost:3000

# 冒烟（构建 + 起服务 + 断言 7 条路由）
bash scripts/smoke.sh

# 容器化（需 Docker Desktop 运行中）
bash scripts/smoke.sh --docker
```

## 页面

| 路由 | 内容 |
|---|---|
| `/` | 经营总览：指标卡 + 利润桥瀑布图 |
| `/revenue/structure` | 收入结构：同店/新店 · 渠道 · 区域 · 门店 |
| `/revenue/same-store` | 同店异动：客流 × 客单价分解 + 13 店明细 + 时段客流 |
| `/revenue/store/[id]` | 门店详情：三项对比 + 同店横向比较 |
| `/revenue/channel` | 渠道下钻：收入同比 + 新客成本/产投比 + 点评漏斗 |
| `/revenue/product` | 产品下钻：系列销量结构 + 套餐量价分解 |
| `/insights` | 结论与计划：自动结论 + 行动建议 |

演示材料在 `docs/demo/`，含 15 分钟脚本与答疑清单。

## 角色

指挥官（Lead）· 产品经理 · 架构师 · 数据工程师 · 前端工程师 · 评审官 · 文档/营销

详见 [docs/agents/roles.md](docs/agents/roles.md)。

## 工作方式

1. 用户在微信里说需求。
2. 指挥官判断：是新功能还是修 bug。新功能先开 OpenSpec change。
3. 产品经理写 proposal + specs，用户确认。
4. 架构师定方案，拆任务。
5. 数据/前端工程师在各自 Worktree Space 里并行开发。
6. 评审官验收，指挥官合并，推送 GitHub。
7. 进度回微信，用户随时可问「现在到哪了」。
