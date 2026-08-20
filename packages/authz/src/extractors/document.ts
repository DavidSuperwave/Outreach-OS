import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

export type DocumentView = Receipt<"view", "document">;
export type DocumentComment = Receipt<"comment", "document">;
export type DocumentEdit = Receipt<"edit", "document">;
export type DocumentOwner = Receipt<"owner", "document">;

export function extractDocument<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
): Receipt<L, "document"> {
  return extractTyped("document", receipt, need, entityId);
}
