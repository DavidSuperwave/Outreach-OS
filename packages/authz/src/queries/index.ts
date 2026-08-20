import type { EntityType } from "registry";
import type { PolicyFn } from "./lattice.js";
import { shareLattice, maxLevel } from "./lattice.js";
import { callAccess } from "./call_access.js";
import { callChannel } from "./call_channel.js";
import { channelMembership } from "./channel_membership.js";
import { channelRole } from "./channel_role.js";
import { chatAccess } from "./chat_access.js";
import { crmCompanyAccess } from "./crm_company_access.js";
import { crmContactAccess } from "./crm_contact_access.js";
import { documentAccess } from "./document_access.js";
import { foreignEntityAccess } from "./foreign_entity_access.js";
import { projectAccess } from "./project_access.js";
import { teamAccess } from "./team_access.js";
import { threadAccess } from "./thread_access.js";

/** B3 names — 13 per-entity-type access-query modules. */
export const QUERY_MODULES = [
  "call_access",
  "call_channel",
  "channel_membership",
  "channel_role",
  "channel_users",
  "chat_access",
  "crm_company_access",
  "crm_contact_access",
  "document_access",
  "foreign_entity_access",
  "project_access",
  "team_access",
  "thread_access",
] as const;

export type QueryModuleName = (typeof QUERY_MODULES)[number];

const channelPolicy: PolicyFn = (state, actorId, ctx) =>
  maxLevel(channelRole(state, actorId, ctx), channelMembership(state, actorId, ctx));

const callPolicy: PolicyFn = (state, actorId, ctx) =>
  maxLevel(callAccess(state, actorId, ctx), callChannel(state, actorId, ctx));

const channelMessagePolicy: PolicyFn = (state, actorId, ctx) => {
  if (state.parentId) {
    const parent = ctx.store.get(state.parentId);
    if (parent) return channelPolicy(parent, actorId, ctx);
  }
  return channelPolicy(state, actorId, ctx);
};

const staticFilePolicy: PolicyFn = (state, actorId, ctx) => {
  const own = documentAccess(state, actorId, ctx);
  if (state.parentId) {
    const parent = ctx.store.get(state.parentId);
    if (parent) return maxLevel(own, documentAccess(parent, actorId, ctx));
  }
  return own;
};

const userPolicy: PolicyFn = (state, actorId) => (state.ownerId === actorId ? "owner" : null);

export const POLICIES: Record<EntityType, PolicyFn> = {
  user: userPolicy,
  chat: chatAccess,
  channel: channelPolicy,
  channel_message: channelMessagePolicy,
  document: documentAccess,
  project: projectAccess,
  email_thread: threadAccess,
  calendar_event: shareLattice,
  team: teamAccess,
  call: callPolicy,
  foreign_entity: foreignEntityAccess,
  static_file: staticFilePolicy,
  crm_company: crmCompanyAccess,
  crm_contact: crmContactAccess,
  reminder: shareLattice,
  skill: documentAccess,
};

export { callAccess, transcriptInheritsCall } from "./call_access.js";
export { callChannel } from "./call_channel.js";
export { channelMembership } from "./channel_membership.js";
export { channelRole } from "./channel_role.js";
export { channelUsersVisible, listChannelUsers } from "./channel_users.js";
export { chatAccess } from "./chat_access.js";
export { crmCompanyAccess, canToggleCrmKillswitch, directoryTracksDomain } from "./crm_company_access.js";
export { crmContactAccess } from "./crm_contact_access.js";
export { documentAccess } from "./document_access.js";
export { foreignEntityAccess } from "./foreign_entity_access.js";
export { projectAccess } from "./project_access.js";
export { teamAccess } from "./team_access.js";
export { threadAccess } from "./thread_access.js";
export { highestGrant, shareLattice, maxLevel } from "./lattice.js";
export type { PolicyFn, PolicyContext } from "./lattice.js";
