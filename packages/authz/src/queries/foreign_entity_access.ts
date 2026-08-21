import { shareLattice, type PolicyFn } from "./lattice.js";

/**
 * foreign_entity_access — registry-only entity; owner + explicit shares.
 * Membership never grants visibility (who tracks a foreign id must not leak).
 */
export const foreignEntityAccess: PolicyFn = (state, actorId, ctx) => shareLattice(state, actorId, ctx);
