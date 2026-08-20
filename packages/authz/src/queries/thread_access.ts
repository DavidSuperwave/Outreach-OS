import { highestGrant, maxLevel, type PolicyFn } from "./lattice.js";

/**
 * thread_access — owner, explicit shares, or inbox-delegate via email_links.
 * Inbox delegates and email_link users receive edit (mailbox acting surface).
 */
export const threadAccess: PolicyFn = (state, actorId, ctx) => {
  const base = highestGrant(state, actorId, ctx);
  if (state.inboxDelegateIds.includes(actorId) || state.emailLinkUserIds.includes(actorId)) {
    return maxLevel(base, "edit");
  }
  return base;
};
