import { shareLattice, maxLevel, type PolicyFn } from "./lattice.js";

/**
 * chat_access — owner, explicit shares, or chat participants (DM/agent thread).
 * Team membership is not an access path.
 */
export const chatAccess: PolicyFn = (state, actorId, ctx) => {
  const base = shareLattice(state, actorId, ctx);
  if (state.participantIds.includes(actorId)) return maxLevel(base, "edit");
  return base;
};
