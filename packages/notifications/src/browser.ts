// Browser-safe exports for UI fixtures. UI-only: no authority, egress, or crypto.
export { NotificationList, UnreadBadge, NotificationWorkspace } from "./ui.js";
export { NOTIFICATION_COMMAND_IDS, N18_PARITY_COMMAND_IDS, N18_UI_DATA_COMMANDS } from "./commands.js";
export type { NotificationCommandId, N18ParityCommandId, N18UiDataCommand } from "./commands.js";
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
} from "./catalog.js";
export type { NotificationRecord } from "./types.js";
