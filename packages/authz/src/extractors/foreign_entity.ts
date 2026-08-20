import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

export type ForeignEntityView = Receipt<"view", "foreign_entity">;

export function extractForeignEntity<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
): Receipt<L, "foreign_entity"> {
  return extractTyped("foreign_entity", receipt, need, entityId);
}
