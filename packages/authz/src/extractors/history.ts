import type { Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";
import { bindActor } from "./common.js";

/** history — viewing activity/history requires View. */
export function extractHistory(receipt: Receipt, entityId: string, actorId: string): Receipt<"view"> {
  bindActor(receipt, actorId);
  requireReceipt(receipt as Receipt<"view">, "view", entityId);
  return receipt as Receipt<"view">;
}
