/**
 * 6 套标准导入模板：唯一定义来源。
 *
 * 模板 xlsx 下载、表头映射、校验、标准化、完整度检查都从这里读取字段，
 * 避免口径在多处漂移。字段单位与 data/dictionary.md、领域模型保持一致：
 * 收入 / 成本 / 金额为万元，客流与漏斗人数为人次 / 人，客单价与单价为元。
 */

export type TemplateType =
  | "store_revenue"
  | "store_traffic"
  | "channel_revenue"
  | "product_sales"
  | "pnl"
  | "online_funnel";

export type FieldType = "string" | "number" | "boolean" | "period";

export interface TemplateField {
  readonly key: string;
  readonly label: string;
  readonly unit?: string;
  readonly type: FieldType;
  readonly required: boolean;
  /** 常见别名表头，用于自动映射（精确匹配） */
  readonly aliases: readonly string[];
  readonly example: string | number;
  readonly description: string;
  /** 数值字段是否允许负数（仅利润表金额） */
  readonly allowNegative?: boolean;
}

export interface ImportTemplate {
  readonly type: TemplateType;
  readonly name: string;
  readonly description: string;
  /** 标准化后写入的数据文件（与 data/seed 同名） */
  readonly target: string;
  /** 主键字段：同一批次内主键重复视为错误，跨批次后到覆盖先到 */
  readonly primaryKey: readonly string[];
  readonly fields: readonly TemplateField[];
  readonly notes: readonly string[];
}

const STORE_ID: TemplateField = {
  key: "store_id",
  label: "门店编号",
  type: "string",
  required: true,
  aliases: ["门店ID", "门店id", "店铺编号", "门店代码", "店号", "门店编码"],
  example: "S01",
  description: "门店唯一编号，各模板之间用它关联同一家门店",
};

const PERIOD: TemplateField = {
  key: "period",
  label: "期间",
  type: "period",
  required: true,
  aliases: ["月份", "年月", "统计月份", "日期", "统计期间", "月度"],
  example: "2025-09",
  description: "按月填写，格式 YYYY-MM；也接受 2025/09、2025年9月、202509",
};

export const TEMPLATES: readonly ImportTemplate[] = [
  {
    type: "store_revenue",
    name: "门店收入",
    description: "每家门店每月营业收入，是所有分析页的基础数据",
    target: "stores.json",
    primaryKey: ["store_id", "period"],
    fields: [
      STORE_ID,
      {
        key: "store_name",
        label: "门店名称",
        type: "string",
        required: true,
        aliases: ["门店名", "门店", "店铺名称", "店名", "店铺"],
        example: "门店1",
        description: "门店展示名",
      },
      {
        key: "region",
        label: "区域",
        type: "string",
        required: true,
        aliases: ["所属区域", "大区", "片区", "区域名称"],
        example: "区域一",
        description: "用于收入结构页的区域聚合",
      },
      {
        key: "is_new",
        label: "是否新店",
        type: "boolean",
        required: true,
        aliases: ["新店", "新店标记", "是否新开"],
        example: "否",
        description: "填「是 / 否」。新店没有上年同期，不参与同店对比",
      },
      PERIOD,
      {
        key: "revenue",
        label: "收入",
        unit: "万元",
        type: "number",
        required: true,
        aliases: ["营业收入", "营业额", "销售额", "实收", "收入金额", "门店收入"],
        example: 69.1,
        description: "当月营业收入，单位万元（不是元）",
      },
    ],
    notes: ["新店上年同期不用填，系统按 0 处理", "同一门店同一月份只能有一行"],
  },
  {
    type: "store_traffic",
    name: "门店客流",
    description: "每家门店每月客流与客单价，用于同店异动的客流 × 客单价拆解",
    target: "traffic.json",
    primaryKey: ["store_id", "period"],
    fields: [
      STORE_ID,
      PERIOD,
      {
        key: "traffic",
        label: "客流",
        unit: "人次",
        type: "number",
        required: true,
        aliases: ["客流量", "来客数", "消费人次", "人次", "到店人次"],
        example: 5618,
        description: "当月消费人次",
      },
      {
        key: "ticket",
        label: "客单价",
        unit: "元",
        type: "number",
        required: true,
        aliases: ["人均消费", "人均", "客单", "人均客单价"],
        example: 123,
        description: "当月客单价，单位元/人次",
      },
    ],
    notes: ["收入 ≈ 客流 × 客单价 ÷ 10000，差异超过 1% 会给出警告", "门店编号需与门店收入模板一致"],
  },
  {
    type: "channel_revenue",
    name: "渠道收入",
    description: "按收款渠道拆分的月度收入，用于收入结构与渠道下钻",
    target: "channels.json",
    primaryKey: ["channel", "period"],
    fields: [
      {
        key: "channel",
        label: "渠道",
        type: "string",
        required: true,
        aliases: ["渠道名称", "支付方式", "收款渠道", "收入渠道"],
        example: "美团大众",
        description: "渠道名称，如美团大众、扫码支付、抖音",
      },
      PERIOD,
      {
        key: "revenue",
        label: "收入",
        unit: "万元",
        type: "number",
        required: true,
        aliases: ["营业收入", "营业额", "销售额", "实收", "收入金额", "渠道收入"],
        example: 460,
        description: "当月该渠道收入，单位万元",
      },
    ],
    notes: ["各渠道合计与门店收入合计差异超过 1% 会给出警告"],
  },
  {
    type: "product_sales",
    name: "产品销售",
    description: "按产品系列的月度销量与收入，用于产品下钻",
    target: "categories.json",
    primaryKey: ["category", "period"],
    fields: [
      {
        key: "category",
        label: "系列",
        type: "string",
        required: true,
        aliases: ["品类", "产品系列", "菜品分类", "类别", "菜品类别"],
        example: "肉类",
        description: "产品系列名称",
      },
      PERIOD,
      {
        key: "qty",
        label: "销量",
        unit: "份",
        type: "number",
        required: true,
        aliases: ["数量", "销售数量", "份数", "销售份数"],
        example: 152127,
        description: "当月销量",
      },
      {
        key: "unit_price",
        label: "单价",
        unit: "元/份",
        type: "number",
        required: false,
        aliases: ["平均单价", "售价", "均价"],
        example: 35.9,
        description: "当月平均单价，可不填",
      },
      {
        key: "revenue",
        label: "收入",
        unit: "万元",
        type: "number",
        required: true,
        aliases: ["销售额", "营业额", "金额", "销售收入"],
        example: 546,
        description: "当月该系列收入，单位万元",
      },
      {
        key: "cost",
        label: "成本",
        unit: "万元",
        type: "number",
        required: false,
        aliases: ["食材成本", "成本金额"],
        example: 152.88,
        description: "当月该系列食材成本，可不填",
      },
    ],
    notes: ["单价、成本可留空"],
  },
  {
    type: "pnl",
    name: "利润表",
    description: "月度利润表 9 个科目，用于经营总览的利润桥",
    target: "pnl.json",
    primaryKey: ["item", "period"],
    fields: [
      {
        key: "item",
        label: "科目",
        type: "string",
        required: true,
        aliases: ["项目", "费用项目", "损益项目", "科目名称"],
        example: "营业收入",
        description:
          "营业收入、食材成本、优惠及手续费、水电气低值、宣传费用、工资奖金、宿舍房租、店铺房租、其它费用",
      },
      PERIOD,
      {
        key: "amount",
        label: "金额",
        unit: "万元",
        type: "number",
        required: true,
        aliases: ["数值", "本期金额", "发生额"],
        example: 1000,
        description: "单位万元，成本费用填正数",
        allowNegative: true,
      },
    ],
    notes: ["利润桥需要 9 个科目齐全，缺任一科目经营总览会提示数据不完整"],
  },
  {
    type: "online_funnel",
    name: "线上漏斗",
    description: "点评等线上渠道的曝光 → 访问 → 支付 → 消费人数",
    target: "funnel.json",
    primaryKey: ["store_id", "period"],
    fields: [
      STORE_ID,
      { ...PERIOD, label: "月份", aliases: ["期间", "年月", "统计月份", "日期"] },
      {
        key: "exposure",
        label: "曝光人数",
        unit: "人",
        type: "number",
        required: true,
        aliases: ["曝光", "曝光量", "曝光人次"],
        example: 133461,
        description: "当月曝光人数",
      },
      {
        key: "visits",
        label: "访问人数",
        unit: "人",
        type: "number",
        required: true,
        aliases: ["访问", "访问量", "浏览人数", "访问人次"],
        example: 15975,
        description: "当月访问人数",
      },
      {
        key: "payments",
        label: "支付人数",
        unit: "人",
        type: "number",
        required: true,
        aliases: ["支付", "下单人数", "购买人数"],
        example: 2045,
        description: "当月支付人数",
      },
      {
        key: "consumers",
        label: "消费人数",
        unit: "人",
        type: "number",
        required: true,
        aliases: ["消费", "核销人数", "到店人数"],
        example: 1882,
        description: "当月到店消费人数",
      },
    ],
    notes: ["四级人数应逐级递减，不满足会给出警告"],
  },
];

const BY_TYPE = new Map(TEMPLATES.map((template) => [template.type, template]));

export function isTemplateType(value: unknown): value is TemplateType {
  return typeof value === "string" && BY_TYPE.has(value as TemplateType);
}

export function getTemplate(type: TemplateType): ImportTemplate {
  const template = BY_TYPE.get(type);
  if (!template) {
    throw new Error(`未知模板：${type}`);
  }
  return template;
}

/** 模板表头文字：带单位的字段写成「收入（万元）」 */
export function fieldHeader(field: TemplateField): string {
  return field.unit ? `${field.label}（${field.unit}）` : field.label;
}

/** 模板示例行的标记：示例行首个文本字段以此开头，导入时整行跳过 */
export const EXAMPLE_PREFIX = "示例-";

/** 模板第 2 行（示例行）的取值：首个文本字段加上「示例-」前缀，避免与真实数据撞值 */
export function exampleRow(template: ImportTemplate): (string | number)[] {
  const firstText = template.fields.findIndex((field) => field.type === "string");
  return template.fields.map((field, index) =>
    index === firstText ? `${EXAMPLE_PREFIX}${field.example}` : field.example,
  );
}

/** 模板说明页的工作表名；识别时跳过 */
export const FIELD_GUIDE_SHEET = "字段说明";
