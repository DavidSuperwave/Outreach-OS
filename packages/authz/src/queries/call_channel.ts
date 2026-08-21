import { type PolicyFn } from "./lattice.js";
import { channelMembership } from "./channel_membership.js";

/**
 * call_channel — a call hosted in a channel grants view to channel members.
 * Transcripts inherit the call receipt; they are not a separate EntityType.
 */
export const callChannel: PolicyFn = (state, actorId, ctx) => {
  if (!state.callChannelId) return null;
  const channel = ctx.store.get(state.callChannelId);
  if (!channel) return null;
  return channelMembership(channel, actorId, ctx) ? "view" : null;
};
