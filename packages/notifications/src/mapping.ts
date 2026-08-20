import { fixtureId } from "registry";

/**
 * OD-1 Branch A: 11 notification tables (D3) map onto per-user DO fields.
 * Device registration is parked. Never writes authorities.
 */
export const NOTIFICATION_TABLES = [
  "channel_notification_email_sent",
  "notification",
  "notification_email_sent",
  "notification_email_unsubscribe",
  "notification_email_unsubscribe_code",
  "notification_message_receipt",
  "notification_user_device_registration",
  "user_mute_notification",
  "user_notification",
  "user_notification_item_unsubscribe",
  "user_notification_type_preference",
] as const;

export type LegacyNotificationTable = (typeof NOTIFICATION_TABLES)[number];

export interface LegacyNotificationRef {
  table: LegacyNotificationTable;
  pgId: number;
}

export type NotificationMappingRole =
  | "log"
  | "receipt"
  | "digest_sent"
  | "unsubscribe"
  | "unsubscribe_code"
  | "mute"
  | "preference"
  | "parked_device";

export interface IdentityMappingResult {
  legacy: LegacyNotificationRef;
  mappedId: string;
  role: NotificationMappingRole;
  wrote: false;
}

const ROLE_BY_TABLE: Record<LegacyNotificationTable, NotificationMappingRole> = {
  channel_notification_email_sent: "digest_sent",
  notification: "log",
  notification_email_sent: "digest_sent",
  notification_email_unsubscribe: "unsubscribe",
  notification_email_unsubscribe_code: "unsubscribe_code",
  notification_message_receipt: "receipt",
  notification_user_device_registration: "parked_device",
  user_mute_notification: "mute",
  user_notification: "log",
  user_notification_item_unsubscribe: "unsubscribe",
  user_notification_type_preference: "preference",
};

export function mapLegacyNotificationId(ref: LegacyNotificationRef): IdentityMappingResult {
  return {
    legacy: ref,
    mappedId: fixtureId("user", ref.pgId),
    role: ROLE_BY_TABLE[ref.table],
    wrote: false,
  };
}

export function dryRunIdentityMapping(refs: readonly LegacyNotificationRef[]): IdentityMappingResult[] {
  return refs.map(mapLegacyNotificationId);
}
