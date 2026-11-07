import { fail, handle, json, readJsonBody } from "../../../lib/api.js";
import { hasImportedDataset, readActive, setActiveDataset } from "../../../lib/ingestion/store.js";

export function GET(): Promise<Response> {
  return handle(() => json({ ...readActive(), hasImported: hasImportedDataset() }));
}

/** 切换数据集：{ dataset: "demo" | "imported" } */
export function PUT(request: Request): Promise<Response> {
  return handle(async () => {
    const { dataset } = await readJsonBody<{ dataset?: unknown }>(request);
    if (dataset !== "demo" && dataset !== "imported") {
      return fail("dataset 只能是 demo 或 imported");
    }
    return json(await setActiveDataset(dataset));
  });
}
