import { fixtureId } from "registry";

/**
 * OD-1 Branch A migration fixture: identity-mapping dry run for 7 `comms_*` tables.
 * Never writes authorities. Postgres numeric rows map onto typed ids.
 */
export const COMMS_TABLES = [
  "comms_channels",
  "comms_channel_members",
  "comms_messages",
  "comms_threads",
  "comms_reactions",
  "comms_bots",
  "comms_bot_tokens",
] as const;

export type LegacyChannelTable = (typeof COMMS_TABLES)[number];

export interface LegacyChannelRef {
  table: LegacyChannelTable;
  pgId: number;
}

export interface IdentityMappingResult {
  legacy: LegacyChannelRef;
  mappedId: string;
  entityType: "channel" | "channel_message";
  role: "channel" | "member" | "message" | "thread" | "reaction" | "bot" | "bot_token";
  wrote: false;
}

export function mapLegacyChannelId(ref: LegacyChannelRef): IdentityMappingResult {
  if (ref.table === "comms_channels") {
    return {
      legacy: ref,
      mappedId: fixtureId("channel", ref.pgId),
      entityType: "channel",
      role: "channel",
      wrote: false,
    };
  }
  if (ref.table === "comms_channel_members") {
    return {
      legacy: ref,
      mappedId: fixtureId("channel", ref.pgId),
      entityType: "channel",
      role: "member",
      wrote: false,
    };
  }
  if (ref.table === "comms_messages") {
    return {
      legacy: ref,
      mappedId: fixtureId("channel_message", ref.pgId),
      entityType: "channel_message",
      role: "message",
      wrote: false,
    };
  }
  if (ref.table === "comms_threads") {
    return {
      legacy: ref,
      mappedId: fixtureId("channel_message", ref.pgId),
      entityType: "channel_message",
      role: "thread",
      wrote: false,
    };
  }
  if (ref.table === "comms_reactions") {
    return {
      legacy: ref,
      mappedId: fixtureId("channel_message", ref.pgId),
      entityType: "channel_message",
      role: "reaction",
      wrote: false,
    };
  }
  if (ref.table === "comms_bots") {
    return {
      legacy: ref,
      mappedId: fixtureId("channel", ref.pgId),
      entityType: "channel",
      role: "bot",
      wrote: false,
    };
  }
  return {
    legacy: ref,
    mappedId: fixtureId("channel", ref.pgId),
    entityType: "channel",
    role: "bot_token",
    wrote: false,
  };
}

export function dryRunIdentityMapping(refs: readonly LegacyChannelRef[]): IdentityMappingResult[] {
  return refs.map(mapLegacyChannelId);
}
