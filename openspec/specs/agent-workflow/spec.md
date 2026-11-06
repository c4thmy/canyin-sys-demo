# agent-workflow Specification

## Purpose
定义「一人指挥多角色 Agent」的工作方式：一个非技术用户通过单一入口下达需求，系统把需求转为可追溯的规格，分派给有明确分工的 Agent，经隔离开发与验收后合并存档。

## Requirements

### Requirement: 修改必须留痕

对项目代码或文档的任何修改 SHALL 记录在 OpenSpec change 中，包含 proposal、specs、tasks 三类产物，完成后归档。

#### Scenario: 新功能开发

- **WHEN** 用户提出一个新功能需求
- **THEN** 指挥官创建 OpenSpec change，产品经理产出 proposal 与 specs，用户确认后才开始实现

#### Scenario: 小修小改

- **WHEN** 修改为文案、样式或缺陷修复
- **THEN** 指挥官在当日 change 的 tasks 中登记该修改，完成后勾选并在归档时写明结果

### Requirement: 角色分工

系统 SHALL 定义七个角色，每个角色有唯一职责与产出物。

#### Scenario: 分派任务

- **WHEN** 一个 change 进入实现阶段
- **THEN** 指挥官按 tasks 把互不重叠的任务分派给对应角色，每个任务只有一个负责人

#### Scenario: 职责冲突

- **WHEN** 两个角色需要修改同一文件范围
- **THEN** 指挥官合并为一个任务或拆出独立文件范围，不得并行写同一处

### Requirement: 任务隔离

并行任务 SHALL 在独立的 Worktree Space 中进行，使用独立分支。

#### Scenario: 两个角色同时开发

- **WHEN** 数据工程师与前端工程师同时工作
- **THEN** 各自在独立工作空间与分支修改，合并前互不影响

### Requirement: 验收闸门

合并前 SHALL 通过三项检查：specs 场景逐条符合、构建与测试通过、评审官无阻塞意见。

#### Scenario: 评审未通过

- **WHEN** 评审官提出阻塞意见
- **THEN** 指挥官不得合并，须由对应角色修复后重新评审

### Requirement: 用户可见

系统 SHALL 用非技术语言向用户汇报进展，不暴露分支、提交、文件路径等术语。

#### Scenario: 每日汇报

- **WHEN** 当日工作结束
- **THEN** 指挥官向用户汇报完成项、阻塞项与次日计划，每项不超过一句话

### Requirement: 远程存档

代码与规格 SHALL 推送至远程 Git 仓库，并保持本地与远程一致。

#### Scenario: 合并后推送

- **WHEN** 一个 change 完成合并
- **THEN** 指挥官推送至 origin，并在汇报中给出一句话说明改了什么
