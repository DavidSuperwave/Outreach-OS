import { highestGrant, type PolicyFn } from "./lattice.js";

/** chat_access — owner + explicit shares (DM/agent chat lattice). */
export const chatAccess: PolicyFn = (state, actorId, ctx) => highestGrant(state, actorId, ctx);
