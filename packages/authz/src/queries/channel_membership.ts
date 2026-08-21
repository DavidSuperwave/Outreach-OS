import { highestGrant, isBotToken, type PolicyFn } from "./lattice.js";

/**
 * channel_membership — members of the channel receive comment.
 * Bound bot tokens (`mbot_`) are a documented auth exception: comment, not owner.
 */
export const channelMembership: PolicyFn = (state, actorId, ctx) => {
  if (state.ownerId === actorId) return "owner";
  if (ctx.actor.kind === "bot" && state.botToken && ctx.actor.id === state.botToken && isBotToken(state.botToken)) {
    return "comment";
  }
  if (state.memberIds.includes(actorId)) return "comment";
  return highestGrant(state, actorId, ctx);
};
