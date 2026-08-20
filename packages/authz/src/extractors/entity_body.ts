import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";
import { bindActor } from "./common.js";

/** entity_body — read/write the payload of whatever entity the receipt names. */
export function extractEntityBody<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
  actorId: string,
): Receipt<L> {
  bindActor(receipt, actorId);
  requireReceipt(receipt as Receipt<L>, need, entityId);
  return receipt as Receipt<L>;
}
