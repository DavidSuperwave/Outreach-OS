import { highestGrant, type PolicyFn } from "./lattice.js";

/** call_access — owner + explicit shares on the call aggregate. */
export const callAccess: PolicyFn = (state, actorId, ctx) => highestGrant(state, actorId, ctx);
