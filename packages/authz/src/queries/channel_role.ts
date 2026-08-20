import { maxLevel, type PolicyFn } from "./lattice.js";
import { channelMembership } from "./channel_membership.js";

/**
 * channel_role — membership role raises the lattice:
 * owner→owner, admin→edit, member→comment.
 */
export const channelRole: PolicyFn = (state, actorId, ctx) => {
  const membership = channelMembership(state, actorId, ctx);
  const role = state.channelRoles[actorId];
  let fromRole: ReturnType<PolicyFn> = null;
  if (role === "owner") fromRole = "owner";
  else if (role === "admin") fromRole = "edit";
  else if (role === "member") fromRole = "comment";
  return maxLevel(membership, fromRole);
};
