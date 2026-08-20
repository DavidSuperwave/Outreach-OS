import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

export type ChannelComment = Receipt<"comment", "channel">;
export type ChannelEdit = Receipt<"edit", "channel">;
export type ChannelOwner = Receipt<"owner", "channel">;

export function extractChannel<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
): Receipt<L, "channel"> {
  return extractTyped("channel", receipt, need, entityId);
}
