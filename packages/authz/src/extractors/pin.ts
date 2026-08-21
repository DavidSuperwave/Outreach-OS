import type { Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";
import { bindActor } from "./common.js";

/** pin — pinning requires Edit; listing pins requires View. */
export function extractPin(receipt: Receipt, entityId: string, actorId: string, mutating: boolean): Receipt {
  bindActor(receipt, actorId);
  requireReceipt(receipt, mutating ? "edit" : "view", entityId);
  return receipt;
}
