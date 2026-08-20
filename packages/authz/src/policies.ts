import type { EntityType } from "registry";
import type { AccessLevel } from "./levels.js";
import { LEVEL_RANK } from "./levels.js";
import type { AccessState } from "./access-state.js";

export function highestGrant(state: AccessState, actorId: string): AccessLevel | null {
  if (state.ownerId === actorId) return "owner";
  let best: AccessLevel | null = null;
  for (const grant of state.shares) {
    if (grant.actorId !== actorId) continue;
    if (!best || LEVEL_RANK[grant.level] > LEVEL_RANK[best]) best = grant.level;
  }
  if (!best && state.memberIds.includes(actorId)) {
    // Team/channel members get view on the aggregate by membership (per-type policies may raise).
    best = "view";
  }
  return best;
}

/** Document (and therefore task facet) policy: owner, explicit shares, team members view. */
export function documentLevel(state: AccessState, actorId: string): AccessLevel | null {
  return highestGrant(state, actorId);
}

/** Team policy: owner/admin/member from membership; mutations need owner/admin at N1. Receipts: member → view, admin → edit, owner → owner. */
export function teamLevel(
  state: AccessState,
  actorId: string,
  teamRole: "owner" | "admin" | "member" | null,
): AccessLevel | null {
  if (teamRole === "owner") return "owner";
  if (teamRole === "admin") return "edit";
  if (teamRole === "member") return "view";
  return highestGrant(state, actorId);
}

export function channelLevel(state: AccessState, actorId: string): AccessLevel | null {
  if (state.ownerId === actorId) return "owner";
  if (state.memberIds.includes(actorId)) return "comment";
  return highestGrant(state, actorId);
}

export function defaultDeny(_state: AccessState, _actorId: string): AccessLevel | null {
  return null;
}

export type PolicyFn = (state: AccessState, actorId: string) => AccessLevel | null;

export const POLICIES: Record<EntityType, PolicyFn> = {
  user: (state, actorId) => (state.ownerId === actorId ? "owner" : null),
  chat: highestGrant,
  channel: channelLevel,
  channel_message: channelLevel,
  document: documentLevel,
  project: documentLevel,
  email_thread: documentLevel,
  calendar_event: highestGrant,
  team: (state, actorId) => highestGrant(state, actorId),
  call: highestGrant,
  foreign_entity: highestGrant,
  static_file: documentLevel,
  crm_company: documentLevel,
  crm_contact: documentLevel,
  reminder: highestGrant,
  skill: documentLevel,
};
