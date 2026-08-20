import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

export type ChatView = Receipt<"view", "chat">;
export type ChatEdit = Receipt<"edit", "chat">;

export function extractChat<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
): Receipt<L, "chat"> {
  return extractTyped("chat", receipt, need, entityId);
}
