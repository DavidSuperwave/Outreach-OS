import { shareLattice, maxLevel, type PolicyFn } from "./lattice.js";

/**
 * project_access — share lattice plus folder access inheritance along parentId.
 * A grant on an ancestor folder is inherited by descendants.
 */
export const projectAccess: PolicyFn = (state, actorId, ctx) => {
  let best = shareLattice(state, actorId, ctx);
  const seen = new Set<string>();
  let parentId = state.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = ctx.store.get(parentId);
    if (!parent) break;
    best = maxLevel(best, shareLattice(parent, actorId, ctx));
    parentId = parent.parentId;
  }
  return best;
};
