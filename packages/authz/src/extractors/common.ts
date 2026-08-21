import type { EntityType } from "registry";
import type { AccessLevel } from "../levels.js";
import { AuthzError, type Receipt } from "../receipt.js";
import { requireReceipt } from "../engine.js";

/**
 * Handler obligation: receipt must name this entity type, satisfy `need`,
 * bind this entity id, and belong to the acting principal.
 */
export function extractTyped<T extends EntityType, L extends AccessLevel>(
  entityType: T,
  receipt: Receipt,
  need: L,
  entityId: string,
  actorId: string,
): Receipt<L, T> {
  if (receipt.entityType !== entityType) {
    throw new AuthzError("denied", `${entityType} extractor received ${receipt.entityType}`);
  }
  if (receipt.actorId !== actorId) {
    throw new AuthzError("forged", "receipt actor mismatch");
  }
  requireReceipt(receipt as Receipt<L, T>, need, entityId);
  return receipt as Receipt<L, T>;
}

export function bindActor(receipt: Receipt, actorId: string): void {
  if (receipt.actorId !== actorId) {
    throw new AuthzError("forged", "receipt actor mismatch");
  }
}
