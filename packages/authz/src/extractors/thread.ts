import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

export type EmailThreadView = Receipt<"view", "email_thread">;
export type EmailThreadEdit = Receipt<"edit", "email_thread">;

export function extractThread<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
  actorId: string,
): Receipt<L, "email_thread"> {
  return extractTyped("email_thread", receipt, need, entityId, actorId);
}
