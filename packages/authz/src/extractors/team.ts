import type { AccessLevel } from "../levels.js";
import type { Receipt } from "../receipt.js";
import { extractTyped } from "./common.js";

export type TeamOwner = Receipt<"owner", "team">;
export type TeamEdit = Receipt<"edit", "team">;
export type TeamView = Receipt<"view", "team">;

export function extractTeam<L extends AccessLevel>(
  receipt: Receipt,
  need: L,
  entityId: string,
  actorId: string,
): Receipt<L, "team"> {
  return extractTyped("team", receipt, need, entityId, actorId);
}
