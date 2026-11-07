import { fail, handle, json } from "../../../lib/api.js";
import { checkMagic, uploadKindOf } from "../../../lib/ingestion/parse.js";
import { analyzeBatch, createBatch } from "../../../lib/ingestion/store.js";
import { VALIDATION_THRESHOLDS } from "../../../lib/ingestion/validate.js";

/**
 * 上传 xlsx / csv：扩展名白名单 + 魔数 + 10 MB 上限。
 * 上传成功后立即解析与识别，返回带映射计划和校验报告的批次。
 */
export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > VALIDATION_THRESHOLDS.maxBytes + 64 * 1024) {
      return fail("文件超过 10 MB", 413);
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("请用 multipart/form-data 上传，字段名 file");
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return fail("缺少文件字段 file");
    }
    const kind = uploadKindOf(file.name);
    if (!kind) {
      return fail("只支持 .xlsx 与 .csv 文件", 415);
    }
    if (file.size === 0) {
      return fail("文件为空");
    }
    if (file.size > VALIDATION_THRESHOLDS.maxBytes) {
      return fail("文件超过 10 MB", 413);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!checkMagic(kind, bytes)) {
      return fail(kind === "xlsx" ? "文件内容不是有效的 xlsx" : "文件内容不是文本 CSV", 415);
    }
    const batch = await createBatch({ fileName: file.name, kind, bytes });
    return json(await analyzeBatch(batch.id), 201);
  });
}
