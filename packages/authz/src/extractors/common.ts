import type { EntityType } from "registry";
import type { AccessLevel } from "../levels.js";
import { AuthzError, type Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";

export function extractTyped<T extends EntityType, L extends AccessLevel>(
  entityType: T,
  receipt: Receipt,
  need: L,
  entityId: string,
): Receipt<L, T> {
  if (receipt.entityType !== entityType) {
    throw new AuthzError("denied", `${entityType} extractor received ${receipt.entityType}`);
  }
  requireReceipt(receipt as Receipt<L, T>, need, entityId);
  return receipt as Receipt<L, T>;
}
