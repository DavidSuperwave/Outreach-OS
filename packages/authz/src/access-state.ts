import type { AccessLevel } from "./levels.js";
import type { EntityType } from "registry";

/** Per-entity share grant stored on the owning DO (ADR-004). */
export interface ShareGrant {
  actorId: string;
  level: AccessLevel;
}

export interface AccessState {
  ownerId: string;
  tenantId: string;
  shares: ShareGrant[];
  /** Channel/team membership role when policy needs it. */
  memberIds: string[];
}

export function emptyAccess(ownerId: string, tenantId: string): AccessState {
  return { ownerId, tenantId, shares: [], memberIds: [ownerId] };
}

export function grantShare(state: AccessState, actorId: string, level: AccessLevel): AccessState {
  const shares = state.shares.filter((grant) => grant.actorId !== actorId);
  shares.push({ actorId, level });
  return { ...state, shares };
}

export function revokeShare(state: AccessState, actorId: string): AccessState {
  return { ...state, shares: state.shares.filter((grant) => grant.actorId !== actorId) };
}
