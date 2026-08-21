/**
 * Closed 19-type catalog (SUP-565 / ADR-009 / D1+D5). Type ids are frozen.
 * 22 metadata structs = 19 type payloads + 3 shared envelopes.
 */

export const GITHUB_NOTIFICATION_TYPES = [
  "github_pr_opened",
  "github_pr_merged",
  "github_pr_closed",
  "github_pr_comment",
  "github_review_requested",
  "github_review_submitted",
  "github_mention",
] as const;

export const PRODUCT_NOTIFICATION_TYPES = [
  "channel_mention",
  "channel_reply",
  "channel_send",
  "email_received",
  "call_started",
  "reminder_due",
  "document_shared",
  "comment_added",
  "task_assigned",
  "agent_completed",
  "automation_ran",
  "digest_ready",
] as const;

export const NOTIFICATION_TYPES = [...GITHUB_NOTIFICATION_TYPES, ...PRODUCT_NOTIFICATION_TYPES] as const;

export type GitHubNotificationType = (typeof GITHUB_NOTIFICATION_TYPES)[number];
export type ProductNotificationType = (typeof PRODUCT_NOTIFICATION_TYPES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_COUNT = NOTIFICATION_TYPES.length;
export const GITHUB_NOTIFICATION_TYPE_COUNT = GITHUB_NOTIFICATION_TYPES.length;

/** Harvested `format_title` copy. `{title}` interpolates `meta.title`. */
export const TITLE_COPY = {
  github_pr_opened: "PR opened: {title}",
  github_pr_merged: "PR merged: {title}",
  github_pr_closed: "PR closed: {title}",
  github_pr_comment: "PR comment: {title}",
  github_review_requested: "Review requested: {title}",
  github_review_submitted: "Review submitted: {title}",
  github_mention: "Mentioned on GitHub: {title}",
  channel_mention: "Mentioned: {title}",
  channel_reply: "Reply: {title}",
  channel_send: "New message: {title}",
  email_received: "Email: {title}",
  call_started: "Call started: {title}",
  reminder_due: "Reminder: {title}",
  document_shared: "Document shared: {title}",
  comment_added: "Comment: {title}",
  task_assigned: "Task assigned: {title}",
  agent_completed: "Agent completed: {title}",
  automation_ran: "Automation ran: {title}",
  digest_ready: "Digest ready: {title}",
} as const satisfies Record<NotificationType, string>;

export interface NotificationMeta {
  title: string;
  channel?: string;
  url?: string;
  number?: number;
  repo?: string;
}

export function format_title(type: NotificationType, meta: NotificationMeta): string {
  return TITLE_COPY[type].replaceAll("{title}", meta.title);
}

export const formatTitle = format_title;

/** 19 type payloads (harvested from metadata.rs TYPE_NAME structs). */
export interface GithubPrOpened {
  title: string;
  number?: number;
  url?: string;
  repo?: string;
}
export interface GithubPrMerged {
  title: string;
  number?: number;
  url?: string;
  repo?: string;
}
export interface GithubPrClosed {
  title: string;
  number?: number;
  url?: string;
  repo?: string;
}
export interface GithubPrComment {
  title: string;
  url?: string;
  repo?: string;
}
export interface GithubReviewRequested {
  title: string;
  url?: string;
  repo?: string;
}
export interface GithubReviewSubmitted {
  title: string;
  url?: string;
  repo?: string;
}
export interface GithubMention {
  title: string;
  url?: string;
  repo?: string;
}
export interface ChannelMention {
  title: string;
  channel?: string;
}
export interface ChannelReply {
  title: string;
  channel?: string;
}
export interface ChannelSend {
  title: string;
  channel?: string;
}
export interface EmailReceived {
  title: string;
}
export interface CallStarted {
  title: string;
}
export interface ReminderDue {
  title: string;
}
export interface DocumentShared {
  title: string;
}
export interface CommentAdded {
  title: string;
}
export interface TaskAssigned {
  title: string;
}
export interface AgentCompleted {
  title: string;
}
export interface AutomationRan {
  title: string;
}
export interface DigestReady {
  title: string;
}

/** Shared envelopes (3 of 22). */
export interface NotificationIntent {
  eventId: string;
  recipientId: string;
  type: NotificationType;
  entityId: string;
  meta: NotificationMeta;
}

export interface DigestWindow {
  userId: string;
  start: number;
  end: number;
}

export interface MuteKey {
  recipientId: string;
  entityId: string;
  type?: NotificationType | "*";
}

export const METADATA_STRUCTS = [
  "GithubPrOpened",
  "GithubPrMerged",
  "GithubPrClosed",
  "GithubPrComment",
  "GithubReviewRequested",
  "GithubReviewSubmitted",
  "GithubMention",
  "ChannelMention",
  "ChannelReply",
  "ChannelSend",
  "EmailReceived",
  "CallStarted",
  "ReminderDue",
  "DocumentShared",
  "CommentAdded",
  "TaskAssigned",
  "AgentCompleted",
  "AutomationRan",
  "DigestReady",
  "NotificationIntent",
  "DigestWindow",
  "MuteKey",
] as const;

export type MetadataStructName = (typeof METADATA_STRUCTS)[number];

/** 19 type payloads + 3 shared envelopes. */
export const METADATA_STRUCT_COUNT = 22 as const;

export const EGRESS_CHANNELS = ["in_app", "email", "push"] as const;
export type EgressChannel = (typeof EGRESS_CHANNELS)[number];

/** Device-registration tables' semantics are parked (OD-3 / ADR-009). */
export const DEVICE_REGISTRATION = {
  status: "parked",
  implemented: false,
  note: "Device registration parked: no device tables in pass 1. Push deferred until a native client exists.",
} as const;
