import { highestGrant, type PolicyFn } from "./lattice.js";

/** foreign_entity_access — share lattice; entity exists only in the registry. */
export const foreignEntityAccess: PolicyFn = (state, actorId, ctx) => highestGrant(state, actorId, ctx);
