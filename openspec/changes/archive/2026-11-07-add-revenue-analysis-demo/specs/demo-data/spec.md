# Spec Delta

## Purpose

定义演示数据的来源、清洗、脱敏与入库流程，保证系统里每个数字都能回溯到原始 Excel 的某张表、某一行。

## ADDED Requirements

### Requirement: 数据可追溯

每条演示数据 SHALL 记录其来源工作表与行号。

#### Scenario: 追溯单个数字

- **WHEN** 用户要求核对某个门店的某月收入
- **THEN** 数据字典能给出对应的 Excel 工作表名与单元格范围

### Requirement: 脱敏

演示数据 SHALL 移除真实品牌名、真实门店地址与可识别个人的信息。

#### Scenario: 品牌匿名化

- **WHEN** 导出演示数据
- **THEN** 品牌名替换为通用名称，门店名保留序号

### Requirement: 可重复导入

导入脚本 SHALL 幂等，重复执行不产生重复记录。

#### Scenario: 重跑导入

- **WHEN** 用户第二次执行导入脚本
- **THEN** 数据库内容与第一次执行后一致

### Requirement: 数据字典

系统 SHALL 提供数据字典，说明每张表、每个字段的含义、单位与来源。

#### Scenario: 查阅字段

- **WHEN** 开发者打开数据字典
- **THEN** 能看到字段名、含义、单位、示例值与来源工作表
