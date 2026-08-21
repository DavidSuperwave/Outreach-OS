/**
 * N18 has 0 direct command rows (05-GRAPH §N18). Inbox chrome lives on N5
 * (`go-to.inbox`) and mailbox N11 — this package does not steal `/inbox`.
 * Mark-seen is a UI `data-command` only.
 */
export const NOTIFICATION_COMMAND_IDS = [] as const;
export type NotificationCommandId = (typeof NOTIFICATION_COMMAND_IDS)[number];

export const N18_PARITY_COMMAND_IDS = [] as const;
export type N18ParityCommandId = (typeof N18_PARITY_COMMAND_IDS)[number];

/** Fixture `data-command` values. Not harvested CMD-L rows. */
export const N18_UI_DATA_COMMANDS = ["notifications.mark-seen"] as const;
export type N18UiDataCommand = (typeof N18_UI_DATA_COMMANDS)[number];
