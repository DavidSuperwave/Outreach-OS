import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

export type ProjectEdit = Receipt<"edit", "project">;
export type ProjectView = Receipt<"view", "project">;

export function extractProject<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
  actorId: string,
): Receipt<L, "project"> {
  return extractTyped("project", receipt, need, entityId, actorId);
}
