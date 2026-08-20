import { shareLattice, maxLevel, type PolicyFn } from "./lattice.js";

/**
 * call_access — owner + explicit shares; on-call participants receive view.
 * Channel-hosted calls also pick up call_channel. Transcripts inherit this level.
 */
export const callAccess: PolicyFn = (state, actorId, ctx) => {
  const base = shareLattice(state, actorId, ctx);
  if (state.participantIds.includes(actorId)) return maxLevel(base, "view");
  return base;
};

export function transcriptInheritsCall(callLevel: ReturnType<PolicyFn>): ReturnType<PolicyFn> {
  return callLevel;
}
