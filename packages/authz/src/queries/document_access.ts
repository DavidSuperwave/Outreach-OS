import { highestGrant, type PolicyFn } from "./lattice.js";
import { LEVEL_RANK } from "../levels.js";
import type { AccessLevel } from "../levels.js";

/**
 * document_access — owner + explicit shares; assignees receive edit.
 * Task-facet documents mint Document receipts (OD-7).
 */
export const documentAccess: PolicyFn = (state, actorId) => {
  const base = highestGrant(state, actorId);
  if (state.assigneeIds.includes(actorId)) {
    return maxEdit(base, "edit");
  }
  return base;
};

function maxEdit(base: AccessLevel | null, extra: AccessLevel): AccessLevel {
  if (!base) return extra;
  return LEVEL_RANK[extra] > LEVEL_RANK[base] ? extra : base;
}
