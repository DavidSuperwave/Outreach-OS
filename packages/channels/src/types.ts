/** Closed realtime event union (ADR-009). Unknown types are a test failure. */
export const REALTIME_EVENT_TYPES = [
  "message",
  "message_edited",
  "message_deleted",
  "presence",
  "ready",
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

export type ChannelFlavor = "channel" | "dm";

export type SenderKind = "user" | "bot" | "agent";

export interface ChannelRecord {
  id: string;
  tenantId: string;
  title: string;
  flavor: ChannelFlavor;
  deleted: boolean;
  version: number;
  lastSeq: number;
  memberIds: string[];
  createdAt: number;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  seq: number;
  senderId: string;
  senderKind: SenderKind;
  body: string;
  parentId: string | null;
  deleted: boolean;
  edited: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface BotRecord {
  token: string;
  name: string;
  owner: { kind: "user"; userId: string } | { kind: "team"; teamId: string };
  channelIds: string[];
  lastUsedAt: number | null;
  revoked: boolean;
}

export type RealtimeEvent =
  | { type: "message"; seq: number; message: ChannelMessage }
  | { type: "message_edited"; seq: number; message: ChannelMessage }
  | { type: "message_deleted"; seq: number; messageId: string; message: ChannelMessage }
  | { type: "presence"; seq: number; entityType: string; entityId: string }
  | { type: "ready"; seq: number };

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface PostMessageInput {
  channelId: string;
  body: string;
  parentId?: string | null;
  headers?: Record<string, string | undefined>;
  /** Mention-triggered agent session (kernel, not a new runtime). */
  agent?: boolean;
}
