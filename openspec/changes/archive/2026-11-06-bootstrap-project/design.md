# Design

## Context

用户不会写代码，所有交互通过一个对话框完成。Agent 之间需要并行、需要互不干扰、需要可回溯。现有工具已具备：IM 入口（dsh-im）、多角色团队（agent-team-profile）、任务隔离（worktree-space）、自动评审（auto-review）、规格管理（OpenSpec）。

## Goals / Non-Goals

**Goals:**

- 用户只说人话，系统自动转成规格与任务
- 多个 Agent 能并行而不冲突
- 任何修改可追溯到一条需求
- 代码与规格同仓，远程可查

**Non-Goals:**

- 不做多租户权限系统（Demo 阶段）
- 不做实时协作编辑
- 不做自动化部署流水线（先用 Docker 冒烟）

## Decisions

### 决策一：以 OpenSpec change 作为唯一工作单元

每个功能一个 change，含 proposal / specs / design / tasks。完成即归档，归档内容成为长期规格。

替代方案：用 GitHub Issue 管需求。放弃原因：Issue 与代码分离，验收标准无法直接约束实现。

### 决策二：七角色，而不是「一个万能的 Agent」

角色边界即上下文边界。每个 Agent 只拿任务书、相关规格、相关代码路径。

替代方案：单 Agent 串行。放弃原因：上下文随任务膨胀，越到后期越容易自相矛盾。

### 决策三：隔离用 Worktree Space

一任务一分支一目录。合并前必须冒烟通过。

替代方案：同一工作区并行。放弃原因：文件冲突无法自动发现。

### 决策四：技术栈 Next.js + SQLite + ECharts

商用可延续，图表能力覆盖瀑布图、漏斗图、下钻。

替代方案：纯静态页面。放弃原因：无法承载数据导入与后续模块扩展。

## Risks / Trade-offs

- **7 天时间紧** → 先做 4 个核心页面，其余进 backlog
- **数据口径有争议** → 先按 Excel 固化，页面标注口径
- **角色间上下文漂移** → 结论必须回指挥官，不横向私聊
- **用户看不到进度** → 每日一句话汇报 + `openspec view` 仪表盘
