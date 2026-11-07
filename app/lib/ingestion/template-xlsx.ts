import ExcelJS from "exceljs";

import { EXAMPLE_PREFIX, FIELD_GUIDE_SHEET, exampleRow, fieldHeader, getTemplate, type TemplateType } from "./templates.js";

/**
 * 生成模板 xlsx：
 * - 第 1 张表「<模板名>」：表头 + 1 行示例（首个文本字段带「示例-」前缀，导入时跳过）
 * - 第 2 张表「字段说明」：字段、是否必填、单位、说明、示例，以及填写须知
 */
export async function buildTemplateWorkbook(type: TemplateType): Promise<Uint8Array> {
  const template = getTemplate(type);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "canyin-ops";

  const data = workbook.addWorksheet(template.name);
  data.addRow(template.fields.map(fieldHeader));
  data.addRow(exampleRow(template));
  data.getRow(1).font = { bold: true };
  data.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  template.fields.forEach((field, index) => {
    const column = data.getColumn(index + 1);
    column.width = Math.max(12, fieldHeader(field).length * 2 + 4);
    if (field.type === "period") {
      // 期间按文本存储，避免 Excel 自动转成日期
      column.numFmt = "@";
    }
    if (field.required) {
      data.getCell(1, index + 1).note = "必填";
    }
  });
  data.views = [{ state: "frozen", ySplit: 1 }];

  const guide = workbook.addWorksheet(FIELD_GUIDE_SHEET);
  guide.addRow(["字段", "是否必填", "单位", "说明", "示例"]);
  guide.getRow(1).font = { bold: true };
  for (const field of template.fields) {
    guide.addRow([fieldHeader(field), field.required ? "必填" : "选填", field.unit ?? "", field.description, field.example]);
  }
  guide.addRow([]);
  guide.addRow(["填写须知"]).font = { bold: true };
  for (const note of [
    `第 2 行为示例（以「${EXAMPLE_PREFIX}」开头），可直接覆盖；保留不删也不会被导入`,
    "表头可以改成常见叫法（如「营业额」），系统会自动识别，导入前也可手工调整",
    ...template.notes,
  ]) {
    guide.addRow([`· ${note}`]);
  }
  [16, 10, 10, 60, 16].forEach((width, index) => {
    guide.getColumn(index + 1).width = width;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
