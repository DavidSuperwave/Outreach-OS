export { NotificationsSlice } from "./slice.js";
export type { NotificationsApi } from "./slice.js";
export { NotificationAuthority } from "./authority.js";
export { NotificationEgress, InAppEgress, DigestEgress, PushEgress, shouldPush } from "./egress.js";
export { fromGitHubEvent, GITHUB_EVENT_TYPE_MAP, N10_GITHUB_INGRESS_EVENTS, normalizeGitHubIngressName } from "./github.js";
export type { N10GitHubIngressEvent } from "./github.js";
export { notificationId, unsubscribeCode, uuidv5, NOTIFICATION_NAMESPACE } from "./ids.js";
export { dryRunIdentityMapping, mapLegacyNotificationId, NOTIFICATION_TABLES } from "./mapping.js";
export type { LegacyNotificationRef, LegacyNotificationTable, IdentityMappingResult } from "./mapping.js";
export { NOTIFICATION_COMMAND_IDS, N18_PARITY_COMMAND_IDS, N18_UI_DATA_COMMANDS } from "./commands.js";
export type { NotificationCommandId, N18ParityCommandId, N18UiDataCommand } from "./commands.js";
export { NotificationsError } from "./errors.js";
export {
  NOTIFICATION_TYPES,
  GITHUB_NOTIFICATION_TYPES,
  PRODUCT_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_COUNT,
  GITHUB_NOTIFICATION_TYPE_COUNT,
  METADATA_STRUCTS,
  METADATA_STRUCT_COUNT,
  TITLE_COPY,
  format_title,
  formatTitle,
  DEVICE_REGISTRATION,
  EGRESS_CHANNELS,
} from "./catalog.js";
export type {
  NotificationType,
  GitHubNotificationType,
  ProductNotificationType,
  NotificationMeta,
  NotificationIntent,
  DigestWindow,
  MuteKey,
  GithubPrOpened,
  GithubPrMerged,
  GithubPrClosed,
  GithubPrComment,
  GithubReviewRequested,
  GithubReviewSubmitted,
  GithubMention,
  ChannelMention,
  ChannelReply,
  ChannelSend,
  EmailReceived,
  CallStarted,
  ReminderDue,
  DocumentShared,
  CommentAdded,
  TaskAssigned,
  AgentCompleted,
  AutomationRan,
  DigestReady,
} from "./catalog.js";
export type {
  NotificationRecord,
  DeliveryReceipt,
  IngestResult,
  RouteResult,
  DigestEmail,
  PreferenceMap,
} from "./types.js";
export { NotificationList, UnreadBadge, NotificationWorkspace } from "./ui.js";
