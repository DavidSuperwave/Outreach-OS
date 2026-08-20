import type { Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";

/** history — viewing activity/history requires View. */
export function extractHistory(receipt: Receipt, entityId: string): Receipt<"view"> {
  requireReceipt(receipt as Receipt<"view">, "view", entityId);
  return receipt as Receipt<"view">;
}
