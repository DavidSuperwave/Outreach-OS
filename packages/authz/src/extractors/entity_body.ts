import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";

/** entity_body — read/write the payload of whatever entity the receipt names. */
export function extractEntityBody<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
): Receipt<L> {
  requireReceipt(receipt as Receipt<L>, need, entityId);
  return receipt as Receipt<L>;
}
