import { handle, json } from "../../../lib/api.js";
import { listBatches } from "../../../lib/ingestion/store.js";

export function GET(): Promise<Response> {
  return handle(() => json(listBatches()));
}
