import { json } from "../../lib/api.js";
import { TEMPLATES } from "../../lib/ingestion/templates.js";

/** 模板列表：名称、说明、字段数 */
export function GET(): Response {
  return json(
    TEMPLATES.map((template) => ({
      type: template.type,
      name: template.name,
      description: template.description,
      fieldCount: template.fields.length,
      requiredCount: template.fields.filter((field) => field.required).length,
    })),
  );
}
