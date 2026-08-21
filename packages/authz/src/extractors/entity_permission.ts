import type { Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";
import { bindActor } from "./common.js";

/** entity_permission — changing ACL rows requires Owner on this actor's receipt. */
export function extractEntityPermission(receipt: Receipt, entityId: string, actorId: string): Receipt<"owner"> {
  bindActor(receipt, actorId);
  requireReceipt(receipt as Receipt<"owner">, "owner", entityId);
  return receipt as Receipt<"owner">;
}
