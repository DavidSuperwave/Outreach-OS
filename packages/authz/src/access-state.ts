import type { TeamRole } from "identity/principal";
import type { AccessLevel } from "./levels.js";

/** Per-entity share grant stored on the owning DO (ADR-004). */
export interface ShareGrant {
  actorId: string;
  level: AccessLevel;
}

/** Channel roles harvested from channel_role. */
export type ChannelRole = "owner" | "admin" | "member";

/**
 * Authoritative ACL snapshot for one entity. In N2 this is the in-process stand-in
 * for owning-DO share rows; N3/N4 persist it. Policies read this, never ad-hoc SQL.
 */
export interface AccessState {
  ownerId: string;
  tenantId: string;
  shares: ShareGrant[];
  /** Channel/team membership ids when policy needs them. */
  memberIds: string[];
  /** Per-actor team membership roles (team_access, CRM killswitch). */
  teamRoles: Record<string, TeamRole>;
  /** Per-actor channel roles (channel_role). */
  channelRoles: Record<string, ChannelRole>;
  /** Parent entity for folder/message/file inheritance. */
  parentId: string | null;
  /** Inbox delegates (thread_access). */
  inboxDelegateIds: string[];
  /** Users linked via email_links (thread_access). */
  emailLinkUserIds: string[];
  /** Channel that hosts this call (call_channel). */
  callChannelId: string | null;
  /** CRM sync killswitch — mutations require team admin. */
  crmKillswitch: boolean;
  /** Document assignees gain edit (OD-7 harvested). */
  assigneeIds: string[];
  /** Channel-bound bot token (`mbot_<12hex>_<64hex>`). */
  botToken: string | null;
  /** Visible channel members (channel_users). */
  channelUserIds: string[];
}

export function emptyAccess(ownerId: string, tenantId: string): AccessState {
  return {
    ownerId,
    tenantId,
    shares: [],
    memberIds: [ownerId],
    teamRoles: { [ownerId]: "owner" },
    channelRoles: {},
    parentId: null,
    inboxDelegateIds: [],
    emailLinkUserIds: [],
    callChannelId: null,
    crmKillswitch: false,
    assigneeIds: [],
    botToken: null,
    channelUserIds: [ownerId],
  };
}

export function grantShare(state: AccessState, actorId: string, level: AccessLevel): AccessState {
  const shares = state.shares.filter((grant) => grant.actorId !== actorId);
  shares.push({ actorId, level });
  return { ...state, shares };
}

export function revokeShare(state: AccessState, actorId: string): AccessState {
  return { ...state, shares: state.shares.filter((grant) => grant.actorId !== actorId) };
}

export function withMembers(state: AccessState, memberIds: string[]): AccessState {
  return { ...state, memberIds, channelUserIds: memberIds };
}

export function withTeamRole(state: AccessState, actorId: string, role: TeamRole): AccessState {
  return { ...state, teamRoles: { ...state.teamRoles, [actorId]: role } };
}

export function withChannelRole(state: AccessState, actorId: string, role: ChannelRole): AccessState {
  return { ...state, channelRoles: { ...state.channelRoles, [actorId]: role } };
}
