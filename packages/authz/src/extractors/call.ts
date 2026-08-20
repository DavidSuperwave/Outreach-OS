import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

export type CallView = Receipt<"view", "call">;

export function extractCall<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
): Receipt<L, "call"> {
  return extractTyped("call", receipt, need, entityId);
}
