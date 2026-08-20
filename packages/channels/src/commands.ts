/**
 * N9 command freeze is 16 `channel.*` rows (05-GRAPH §N9; CMD-L including
 * find-in-channel two-scope loop). Email `thread.*` 9 stay on N11.
 */
export const CHANNEL_COMMAND_FREEZE_COUNT = 16;

/** Full 16-row freeze, harvested from CMD-L `channel.*`. */
export const CHANNEL_COMMAND_IDS = [
  "channel.create-bot",
  "channel.invite-bot",
  "channel.copy-webhook-url",
  "channel.previous-message",
  "channel.next-message",
  "channel.go-to-latest",
  "channel.reply",
  "channel.edit-message",
  "channel.delete-message",
  "channel.clear-selection",
  "channel.input-arrowup-select-last",
  "channel.find",
  "channel.find-input",
  "channel.discard-edit",
  "channel.input-escape-guard",
  "channel.task-composer.create",
] as const;

export type ChannelCommandId = (typeof CHANNEL_COMMAND_IDS)[number];

/**
 * Surface identities exercised end-to-end by N9 (05-MAP row 7 + chrome).
 * `channel.*` rows live here; create-menu / go-to / launcher chrome lives on N5.
 */
export const N9_PARITY_COMMAND_IDS = [
  "create-menu.channel",
  "create-menu.channel-message",
  "go-to.channels",
  "launcher.channel",
  "command-menu.open-category.channels",
  "channel.reply",
  "channel.find",
  "channel.find-input",
  "channel.edit-message",
  "channel.delete-message",
] as const;

export type N9ParityCommandId = (typeof N9_PARITY_COMMAND_IDS)[number];
