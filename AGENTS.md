# AGENTS.md

给所有在本仓库工作的 Agent 的硬性约定。优先级高于个人偏好。

## 一、修改必须留痕

**任何**对代码或文档的修改，都必须落在 `openspec/changes/<change-id>/` 里。

- 新功能：先 `openspec new change "<name>"`，补齐 proposal → specs → design → tasks，**用户确认后**才动代码。
- 小修小改：在当日进行中的 change 的 `tasks.md` 追加一条并勾选。
- 做完：`openspec archive <name>`，规格自动进入 `openspec/specs/`。

没有对应 change 的提交，一律不接受。

## 二、开工前先读

1. `docs/architecture.md` — 六层结构
2. `docs/agents/roles.md` — 角色边界
3. `docs/domain/revenue-analysis-model.md` — 业务口径（**数字对不对以这里为准**）
4. 当前 change 的 `proposal.md` 与 `specs/`

## 三、角色与写入范围

| 角色 | 可写范围 |
|---|---|
| 产品经理 | `openspec/changes/*/proposal.md`、`specs/` |
| 架构师 | `openspec/changes/*/design.md`、`tasks.md`、`docs/` |
| 数据工程师 | `app/lib/metrics/`、`app/api/`、`scripts/`、`data/` |
| 前端工程师 | `app/(dashboard)/`、`app/components/` |
| 评审官 | 只读，产出意见 |
| 文档营销 | `docs/demo/`、`README.md` |

**同一文件范围不得由两个 Agent 同时写。**

## 四、验收闸门

合并前必须：

1. `openspec validate --all` 通过
2. 构建与测试通过
3. 评审官按 specs 场景逐条确认

## 五、数字口径

- 收入、客单价、客流等指标一律以 `docs/domain/revenue-analysis-model.md` 为准。
- 新增指标必须先写进领域模型，再写代码。
- 任何指标都要有单测 + 手算对照。

## 六、提交

- 提交信息用中文，格式 `type: 说明`，type ∈ feat / fix / docs / chore / test / refactor。
- 一个逻辑改动一个提交。
- 推送前先拉取，避免覆盖他人。

## 七、分支

- `main` 只接受验收通过的改动。
- 并行任务在 Worktree Space 的独立分支上进行。
