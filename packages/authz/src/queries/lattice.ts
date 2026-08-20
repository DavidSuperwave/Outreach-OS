import type { Principal } from "identity/principal";
import type { AccessLevel } from "../levels.js";
import { LEVEL_RANK } from "../levels.js";
import type { AccessState } from "../access-state.js";
import type { AccessStore } from "../access-store.js";

export interface PolicyContext {
  store: AccessStore;
  actor: Principal;
}

export type PolicyFn = (state: AccessState, actorId: string, ctx: PolicyContext) => AccessLevel | null;

export function maxLevel(...levels: Array<AccessLevel | null | undefined>): AccessLevel | null {
  let best: AccessLevel | null = null;
  for (const level of levels) {
    if (!level) continue;
    if (!best || LEVEL_RANK[level] > LEVEL_RANK[best]) best = level;
  }
  return best;
}

/** Owner, explicit shares, then membership view. Shared lattice for share-based types. */
export function highestGrant(state: AccessState, actorId: string, _ctx?: PolicyContext): AccessLevel | null {
  if (state.ownerId === actorId) return "owner";
  let best: AccessLevel | null = null;
  for (const grant of state.shares) {
    if (grant.actorId !== actorId) continue;
    if (!best || LEVEL_RANK[grant.level] > LEVEL_RANK[best]) best = grant.level;
  }
  if (!best && state.memberIds.includes(actorId)) {
    best = "view";
  }
  return best;
}

export const BOT_TOKEN_RE = /^mbot_[0-9a-f]{12}_[0-9a-f]{64}$/;

export function isBotToken(value: string): boolean {
  return BOT_TOKEN_RE.test(value);
}
