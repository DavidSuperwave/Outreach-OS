import type { Principal } from "identity/principal";
import type { AccessLevel } from "../levels.js";
import { AuthzError, type Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

/**
 * bot extractor — compile-time obligation that the actor is a bot principal
 * holding a channel receipt bound to that principal (mbot token bound at mint).
 */
export function extractBot<L extends AccessLevel>(
  receipt: Receipt,
  actor: Principal,
  need: L,
  entityId: string,
): Receipt<L, "channel"> {
  if (actor.kind !== "bot") {
    throw new AuthzError("denied", "bot extractor requires a bot principal");
  }
  return extractTyped("channel", receipt, need, entityId, actor.id);
}
