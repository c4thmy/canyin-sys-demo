# Proposal

## Why

用户是非技术背景的餐饮经营者，已用 Excel 搭出完整的经营分析体系，想把其中「收入分析」模块产品化为可商用的 Web 系统。同时需要一套「一个人指挥多个 Agent」的生产方式，让需求、开发、验收全程可追溯、可回滚。

## What Changes

- 建立远程仓库 `c4thmy/canyin-sys-demo`，代码与规格同仓
- 初始化 OpenSpec，规定所有修改必须经 change 记录
- 定义六层系统架构（入口 / 指挥 / 角色 / 隔离 / 记录 / 存储）
- 定义七个角色及分派规则
- 从现有 Excel 与 PPT 提炼收入分析领域模型
- 制定 7 天冲刺计划与 15 分钟演示动线

## Capabilities

### New Capabilities

- `agent-workflow`: 一人通过单一入口指挥多角色 Agent 的工作流程，含角色分工、规格驱动、任务隔离、验收闸门与远程存档。

### Modified Capabilities

（无）

## Impact

- 新增目录：`openspec/`、`docs/`、`.dsh/skills/`
- 外部依赖：OpenSpec 1.16、`dsh-worktree-space`、`agent-team-profile`、`auto-review`、`dsh-im`
- 不影响任何已有生产系统
