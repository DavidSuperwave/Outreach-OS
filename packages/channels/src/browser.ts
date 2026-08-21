// Browser-safe exports for UI fixtures
export {
  ChannelComposePopover,
  ChannelList,
  MessageLog,
  PresenceStrip,
  ChannelFindBar,
  ChannelWorkspace,
} from "./ui.js";
export {
  CHANNEL_COMMAND_IDS,
  CHANNEL_COMMAND_FREEZE_COUNT,
  N9_PARITY_COMMAND_IDS,
} from "./commands.js";
export type { ChannelCommandId, N9ParityCommandId } from "./commands.js";
export type {
  ChannelRecord,
  ChannelMessage,
  ChannelFlavor,
  SenderKind,
  BotRecord,
  RealtimeEvent,
  RealtimeListener,
  PostMessageInput,
} from "./types.js";
export type { PresenceSnapshot, PresenceSession, PresenceAction } from "./presence.js";
