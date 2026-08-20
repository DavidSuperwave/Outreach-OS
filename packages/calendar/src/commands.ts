/**
 * N13 command freeze is 7 rows: `calendar.*` 6 (view keys ×3 loop + period nav)
 * plus `reminder-composer` 1 (05-GRAPH §N13; CMD-L).
 */
export const CALENDAR_COMMAND_FREEZE_COUNT = 7;

/** Harvested from CMD-L `calendar.*` (view loop + previous/next/today). */
export const CALENDAR_COMMAND_IDS = [
  "calendar.view.day",
  "calendar.view.week",
  "calendar.view.month",
  "calendar.previous-period",
  "calendar.next-period",
  "calendar.today",
] as const;

export type CalendarCommandId = (typeof CALENDAR_COMMAND_IDS)[number];

/** Reminder composer escape (CMD-L `reminder-composer.escape`). */
export const REMINDER_COMPOSER_COMMAND_IDS = ["reminder-composer.escape"] as const;

export type ReminderComposerCommandId = (typeof REMINDER_COMPOSER_COMMAND_IDS)[number];

export const N13_COMMAND_IDS = [...CALENDAR_COMMAND_IDS, ...REMINDER_COMPOSER_COMMAND_IDS] as const;

export type N13CommandId = (typeof N13_COMMAND_IDS)[number];

/**
 * Surface identities exercised end-to-end by N13 (05-MAP row 9 + chrome).
 * `calendar.*` / reminder-composer live here; go-to chrome lives on N5.
 */
export const N13_PARITY_COMMAND_IDS = [
  "go-to.calendar",
  "go-to.calls",
  "go-to.reminders",
  "calendar.view.week",
  "reminder-composer.escape",
] as const;

export type N13ParityCommandId = (typeof N13_PARITY_COMMAND_IDS)[number];
