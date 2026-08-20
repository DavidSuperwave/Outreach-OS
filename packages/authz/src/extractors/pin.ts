import type { Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";

/** pin — pinning requires Edit; listing pins requires View. */
export function extractPin(receipt: Receipt, entityId: string, mutating: boolean): Receipt {
  requireReceipt(receipt, mutating ? "edit" : "view", entityId);
  return receipt;
}
