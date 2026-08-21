import type { AccessState } from "../access-state.js";
import { channelMembership } from "./channel_membership.js";
import type { PolicyContext } from "./lattice.js";

/**
 * channel_users — members (and the owner) may list other members.
 * Outsiders get nothing: no leakage of who is in the channel.
 */
export function listChannelUsers(state: AccessState, actorId: string, ctx: PolicyContext): string[] | null {
  if (!channelMembership(state, actorId, ctx)) return null;
  return state.channelUserIds.length > 0 ? state.channelUserIds : state.memberIds;
}

export function channelUsersVisible(state: AccessState, actorId: string, ctx: PolicyContext): boolean {
  return listChannelUsers(state, actorId, ctx) !== null;
}
