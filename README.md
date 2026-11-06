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

## 快速开始

```bash
# 需求与进度
openspec list
openspec view

# 产品（开发中）
pnpm install
pnpm dev
```

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
