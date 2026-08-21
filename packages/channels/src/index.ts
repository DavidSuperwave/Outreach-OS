export { ChannelsSlice, actorContext, botActor, requestContext } from "./slice.js";
export type {
  ChannelsApi,
  ChannelView,
  MessageView,
  CreateChannelInput,
  CreateBotInput,
} from "./slice.js";
export { ChannelMessageLog } from "./log.js";
export { PresenceStore, trackPath, N9_KERNEL_RPC } from "./presence.js";
export type { PresenceSnapshot, PresenceSession, PresenceAction, N9KernelRpc } from "./presence.js";
export {
  BOT_TOKEN_HEADER,
  BOT_SCOPE_HEADER,
  BOT_TOKEN_RE,
  FIXTURE_BOT_TOKEN,
  FIXTURE_BOT_TOKEN_B,
  isBotToken,
  parseBotToken,
  resolvePosterXor,
  assertBotOwnerXor,
  webhookPath,
  ChannelsError,
} from "./bot.js";
export type { BotOwner, BotOwnerKind, PosterAuth, HeaderMap } from "./bot.js";
export { dryRunIdentityMapping, mapLegacyChannelId, COMMS_TABLES } from "./mapping.js";
export type { LegacyChannelRef, LegacyChannelTable, IdentityMappingResult } from "./mapping.js";
export {
  CHANNEL_COMMAND_IDS,
  CHANNEL_COMMAND_FREEZE_COUNT,
  N9_PARITY_COMMAND_IDS,
} from "./commands.js";
export type { ChannelCommandId, N9ParityCommandId } from "./commands.js";
export { REALTIME_EVENT_TYPES } from "./types.js";
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
export {
  ChannelComposePopover,
  ChannelList,
  MessageLog,
  PresenceStrip,
  ChannelFindBar,
  ChannelWorkspace,
} from "./ui.js";
