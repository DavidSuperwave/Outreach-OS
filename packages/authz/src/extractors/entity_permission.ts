import type { Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";

/** entity_permission — changing ACL rows requires Owner. */
export function extractEntityPermission(receipt: Receipt, entityId: string): Receipt<"owner"> {
  requireReceipt(receipt as Receipt<"owner">, "owner", entityId);
  return receipt as Receipt<"owner">;
}
