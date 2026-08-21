import { shareLattice, maxLevel, type PolicyFn } from "./lattice.js";

/**
 * document_access — owner + explicit shares; assignees receive edit.
 * Team membership alone does not grant document view (harvested).
 * Task-facet documents mint Document receipts (OD-7).
 */
export const documentAccess: PolicyFn = (state, actorId) => {
  const base = shareLattice(state, actorId);
  if (state.assigneeIds.includes(actorId)) return maxLevel(base, "edit");
  return base;
};
