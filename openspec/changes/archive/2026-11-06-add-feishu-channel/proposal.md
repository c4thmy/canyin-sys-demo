# Proposal

## Why

用户需要在营销课上投屏演示，并在群里让多个参与者看到 Agent 的工作过程。微信通道只适合一对一私聊，无法满足投屏与群协作场景。

## What Changes

- 在 DSH 中接入飞书渠道（`@xmanrui/dsh-im` 的飞书通道）
- 飞书机器人绑定到同一项目工作区
- 设定访问策略：仅本人可下达指令，群内被 @ 时响应

## Capabilities

### New Capabilities

- `im-channel`: 通过 IM 渠道（飞书/微信）向 Agent 团队下达需求并接收汇报的能力。

### Modified Capabilities

（无）

## Impact

- 依赖 `@xmanrui/dsh-im` 5.10.0（已安装）
- 新增一份飞书应用凭据，存储在本机，不进入仓库
- 不改动产品代码
