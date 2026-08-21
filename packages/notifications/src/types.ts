import type { EgressChannel, NotificationIntent, NotificationMeta, NotificationType } from "./catalog.js";

export type {
  AgentCompleted,
  AutomationRan,
  CallStarted,
  ChannelMention,
  ChannelReply,
  ChannelSend,
  CommentAdded,
  DigestReady,
  DigestWindow,
  DocumentShared,
  EgressChannel,
  EmailReceived,
  GithubMention,
  GithubPrClosed,
  GithubPrComment,
  GithubPrMerged,
  GithubPrOpened,
  GithubReviewRequested,
  GithubReviewSubmitted,
  MuteKey,
  NotificationIntent,
  NotificationMeta,
  NotificationType,
  ReminderDue,
  TaskAssigned,
} from "./catalog.js";

export interface NotificationRecord {
  id: string;
  eventId: string;
  recipientId: string;
  type: NotificationType;
  entityId: string;
  meta: NotificationMeta;
  title: string;
  seen: boolean;
  done: boolean;
  deleted: boolean;
  createdAt: number;
}

export interface DeliveryReceipt {
  notificationId: string;
  recipientId: string;
  channel: EgressChannel;
  at: number;
  unsubscribeCode?: string;
}

export interface IngestResult {
  notification: NotificationRecord;
  created: boolean;
}

export interface RouteResult {
  notification: NotificationRecord;
  created: boolean;
  delivered: DeliveryReceipt[];
  skippedPush: boolean;
  suppressed: boolean;
}

export interface DigestEmail {
  recipientId: string;
  channel: "email";
  notificationIds: string[];
  titles: string[];
  unsubscribeCode: string;
  window: { start: number; end: number } | null;
}

export type PreferenceMap = Record<NotificationType, boolean>;

export function intentKey(intent: Pick<NotificationIntent, "eventId" | "recipientId">): string {
  return `${intent.eventId}\0${intent.recipientId}`;
}
