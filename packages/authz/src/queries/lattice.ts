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

/** Owner + explicit shares only. No membership fallback. */
export function shareLattice(state: AccessState, actorId: string, _ctx?: PolicyContext): AccessLevel | null {
  if (state.ownerId === actorId) return "owner";
  let best: AccessLevel | null = null;
  for (const grant of state.shares) {
    if (grant.actorId !== actorId) continue;
    if (!best || LEVEL_RANK[grant.level] > LEVEL_RANK[best]) best = grant.level;
  }
  return best;
}

/** Owner, explicit shares, then membership view. Used where membership is an access path. */
export function highestGrant(state: AccessState, actorId: string, _ctx?: PolicyContext): AccessLevel | null {
  const shared = shareLattice(state, actorId);
  if (shared) return shared;
  if (state.memberIds.includes(actorId)) return "view";
  return null;
}

export const BOT_TOKEN_RE = /^mbot_[0-9a-f]{12}_[0-9a-f]{64}$/;

export function isBotToken(value: string): boolean {
  return BOT_TOKEN_RE.test(value);
}
