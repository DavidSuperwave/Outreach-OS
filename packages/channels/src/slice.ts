import { AccessStore, PolicyEngine, emptyAccess, requireReceipt, withMembers, type Receipt } from "authz";
import {
  ActivityLog,
  IdempotencyStore,
  Outbox,
  envelope,
  requestContext,
  runOnce,
  type ActivityAction,
  type EventEnvelope,
  type RequestContext,
} from "control-plane";
import type { ActorContext, Principal } from "identity/principal";
import { EntityRegistry, nextId } from "registry";
import { ProjectionPlane, type SoupItem, type SoupListener } from "soup";
import {
  ChannelsError,
  assertBotOwnerXor,
  isBotToken,
  resolvePosterXor,
  webhookPath,
  type BotOwner,
  type HeaderMap,
} from "./bot.js";
import { ChannelMessageLog } from "./log.js";
import { PresenceStore } from "./presence.js";
import type {
  BotRecord,
  ChannelFlavor,
  ChannelMessage,
  ChannelRecord,
  PostMessageInput,
  RealtimeListener,
  SenderKind,
} from "./types.js";

export interface ChannelView {
  channel: ChannelRecord;
  receipt: Receipt;
}

export interface MessageView {
  message: ChannelMessage;
  receipt: Receipt;
}

export interface CreateChannelInput {
  title: string;
  flavor?: ChannelFlavor;
  memberIds?: readonly string[];
}

export interface CreateBotInput {
  name: string;
  token: string;
  userId?: string | null;
  teamId?: string | null;
  channelId?: string;
}

export interface ChannelsApi {
  createChannel(input: CreateChannelInput, ctx: RequestContext): ChannelView;
  createDm(peerId: string, ctx: RequestContext): ChannelView;
  inviteMember(userId: string, ctx: RequestContext): ChannelRecord;
  removeMember(userId: string, ctx: RequestContext): ChannelRecord;
  joinChannel(ctx: RequestContext): ChannelRecord;
  postMessage(input: PostMessageInput, ctx: RequestContext): MessageView;
  postWebhook(channelId: string, body: string, headers: HeaderMap, parentId?: string | null): MessageView;
  editMessage(messageId: string, body: string, ctx: RequestContext): ChannelMessage;
  deleteMessage(messageId: string, ctx: RequestContext): ChannelMessage;
  listChannels(receipts: readonly Receipt[]): SoupItem[];
  listMessages(channelId: string): ChannelMessage[];
  listThread(channelId: string, parentId: string): ChannelMessage[];
  subscribe(channelId: string, sessionId: string, fromSeq: number, listener: RealtimeListener): () => void;
  trackPresence(sessionId: string, actorId: string, channelId: string, action: "open" | "ping" | "close"): void;
  queryPresence(channelId: string): ReturnType<PresenceStore["query"]>;
  createBot(input: CreateBotInput, ctx: RequestContext): BotRecord;
  inviteBot(token: string, ctx: RequestContext): ChannelRecord;
  webhookUrl(channelId: string): string;
  subscribeLists(listener: SoupListener): () => void;
}

/**
 * Authoritative channel store is one in-process log per channel (DO stand-in).
 * Outbox drain is the async side effect; Soup is the channel-list projection.
 */
export class ChannelsSlice {
  readonly registry = new EntityRegistry();
  readonly access = new AccessStore();
  readonly engine = new PolicyEngine(this.registry, this.access);
  outbox = new Outbox();
  plane = new ProjectionPlane();
  readonly activity = new ActivityLog();
  readonly idempotency = new IdempotencyStore();
  readonly presence = new PresenceStore();
  readonly mentions = new Set<string>();
  #channels = new Map<string, ChannelRecord>();
  #logs = new Map<string, ChannelMessageLog>();
  #bots = new Map<string, BotRecord>();
  #clock = 0;

  openApi(): ChannelsApi {
    return {
      createChannel: (input, ctx) => this.createChannel(input, ctx),
      createDm: (peerId, ctx) => this.createDm(peerId, ctx),
      inviteMember: (userId, ctx) => this.inviteMember(userId, ctx),
      removeMember: (userId, ctx) => this.removeMember(userId, ctx),
      joinChannel: (ctx) => this.joinChannel(ctx),
      postMessage: (input, ctx) => this.postMessage(input, ctx),
      postWebhook: (channelId, body, headers, parentId) => this.postWebhook(channelId, body, headers, parentId),
      editMessage: (messageId, body, ctx) => this.editMessage(messageId, body, ctx),
      deleteMessage: (messageId, ctx) => this.deleteMessage(messageId, ctx),
      listChannels: (receipts) => this.listChannels(receipts),
      listMessages: (channelId) => this.listMessages(channelId),
      listThread: (channelId, parentId) => this.listThread(channelId, parentId),
      subscribe: (channelId, sessionId, fromSeq, listener) => this.subscribe(channelId, sessionId, fromSeq, listener),
      trackPresence: (sessionId, actorId, channelId, action) => this.trackPresence(sessionId, actorId, channelId, action),
      queryPresence: (channelId) => this.queryPresence(channelId),
      createBot: (input, ctx) => this.createBot(input, ctx),
      inviteBot: (token, ctx) => this.inviteBot(token, ctx),
      webhookUrl: (channelId) => webhookPath(channelId),
      subscribeLists: (listener) => this.plane.lists.subscribe(listener),
    };
  }

  createChannel(input: CreateChannelInput, ctx: RequestContext): ChannelView {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new ChannelsError("denied", "createChannel requires a tenant-scoped actor");
    const run = () => {
      const id = nextId("channel");
      const ownerId = ctx.actor.actor.id;
      const memberIds = unique([ownerId, ...(input.memberIds ?? [])]);
      this.registry.register({ type: "channel", id, tenantId, createdAt: this.#now(), facet: null });
      this.access.put(id, withMembers(emptyAccess(ownerId, tenantId), memberIds));
      const createdAt = this.#now();
      const channel: ChannelRecord = {
        id,
        tenantId,
        title: input.title,
        flavor: input.flavor ?? "channel",
        deleted: false,
        version: 1,
        lastSeq: 0,
        memberIds,
        createdAt,
      };
      this.#channels.set(id, channel);
      this.#logs.set(id, new ChannelMessageLog(memberIds));
      this.#publishChannel(channel, ctx, "created");
      const receipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "channel",
        entityId: id,
        need: "owner",
      });
      return { channel, receipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  createDm(peerId: string, ctx: RequestContext): ChannelView {
    return this.createChannel(
      { title: "DM", flavor: "dm", memberIds: [ctx.actor.actor.id, peerId] },
      ctx,
    );
  }

  inviteMember(userId: string, ctx: RequestContext): ChannelRecord {
    return this.#mutateMembership(ctx, (channel, log) => {
      log.addMember(userId);
      const memberIds = unique([...channel.memberIds, userId]);
      this.#putAccess(channel.id, channel.tenantId, channel.memberIds[0]!, memberIds, this.access.require(channel.id).botToken);
      return { ...channel, memberIds, version: channel.version + 1 };
    }, "participant_added");
  }

  removeMember(userId: string, ctx: RequestContext): ChannelRecord {
    return this.#mutateMembership(ctx, (channel, log) => {
      log.removeMember(userId);
      const memberIds = channel.memberIds.filter((id) => id !== userId);
      this.#putAccess(channel.id, channel.tenantId, channel.memberIds[0]!, memberIds, this.access.require(channel.id).botToken);
      return { ...channel, memberIds, version: channel.version + 1 };
    }, "participant_removed");
  }

  joinChannel(ctx: RequestContext): ChannelRecord {
    const receipt = ctx.receipt;
    if (!receipt) throw new ChannelsError("missing_receipt", "join requires a receipt");
    return this.inviteMember(ctx.actor.actor.id, ctx);
  }

  postMessage(input: PostMessageInput, ctx: RequestContext): MessageView {
    const poster = resolvePosterXor({
      actorKind: ctx.actor.actor.kind,
      actorId: ctx.actor.actor.id,
      headers: input.headers,
    });
    const run = () => {
      const channelId = input.channelId;
      const channel = this.#requireChannel(channelId);
      const log = this.#requireLog(channelId);
      if (poster.kind === "bot") this.#touchBot(poster.actorId, channelId);
      if (!log.isMember(poster.actorId)) {
        throw new ChannelsError("not_member", `${poster.actorId} is not a member of ${channelId}`);
      }
      const receipt = this.#receiptForPoster(ctx, poster, channelId);
      requireReceipt(receipt, "comment", channelId);
      if (input.parentId) {
        const parent = log.get(input.parentId);
        if (!parent || parent.channelId !== channelId) throw new ChannelsError("unknown_message", `unknown parent ${input.parentId}`);
      }
      const id = nextId("channel_message");
      const createdAt = this.#now();
      this.registry.register({
        type: "channel_message",
        id,
        tenantId: channel.tenantId,
        createdAt,
        facet: null,
      });
      this.access.put(id, { ...emptyAccess(poster.actorId, channel.tenantId), parentId: channelId });
      const senderKind: SenderKind = poster.kind === "bot" ? (input.agent ? "agent" : "bot") : "user";
      const drafted: ChannelMessage = {
        id,
        channelId,
        seq: 0,
        senderId: poster.actorId,
        senderKind,
        body: input.body,
        parentId: input.parentId ?? null,
        deleted: false,
        edited: false,
        version: 1,
        createdAt,
        updatedAt: createdAt,
      };
      const message = log.append(drafted);
      this.#noteMentions(message);
      const next: ChannelRecord = {
        ...channel,
        version: channel.version + 1,
        lastSeq: log.seq,
        memberIds: [...log.members],
      };
      this.#channels.set(channelId, next);
      this.#publishChannel(next, ctx, "messaged", message.body);
      return { message, receipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  /**
   * Unauthenticated webhook poster (04 §7): token + channel binding only.
   * No human session. Does not send mail.
   */
  postWebhook(channelId: string, body: string, headers: HeaderMap, parentId: string | null = null): MessageView {
    const poster = resolvePosterXor({ actorKind: null, headers });
    const channel = this.#requireChannel(channelId);
    return this.postMessage(
      { channelId, body, parentId, headers },
      requestContext(botActor(poster.actorId, channel.tenantId)),
    );
  }

  editMessage(messageId: string, body: string, ctx: RequestContext): ChannelMessage {
    const receipt = ctx.receipt;
    if (!receipt) throw new ChannelsError("missing_receipt", "edit requires a receipt");
    requireReceipt(receipt, "comment", receipt.entityId);
    const channel = this.#requireChannel(receipt.entityId);
    const log = this.#requireLog(channel.id);
    const current = log.get(messageId);
    if (!current) throw new ChannelsError("unknown_message", `unknown message ${messageId}`);
    const edited = log.edit(messageId, body, this.#now());
    const next = { ...channel, version: channel.version + 1, lastSeq: log.seq };
    this.#channels.set(channel.id, next);
    this.#publishChannel(next, ctx, "edited", edited.body);
    return edited;
  }

  deleteMessage(messageId: string, ctx: RequestContext): ChannelMessage {
    const receipt = ctx.receipt;
    if (!receipt) throw new ChannelsError("missing_receipt", "delete requires a receipt");
    requireReceipt(receipt, "comment", receipt.entityId);
    const channel = this.#requireChannel(receipt.entityId);
    const log = this.#requireLog(channel.id);
    const current = log.get(messageId);
    if (!current) throw new ChannelsError("unknown_message", `unknown message ${messageId}`);
    const deleted = log.delete(messageId, this.#now());
    const next = { ...channel, version: channel.version + 1, lastSeq: log.seq };
    this.#channels.set(channel.id, next);
    this.#publishChannel(next, ctx, "deleted", "");
    return deleted;
  }

  listChannels(receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["channel"] }, receipts).items;
  }

  listMessages(channelId: string): ChannelMessage[] {
    return this.#requireLog(channelId).list();
  }

  listThread(channelId: string, parentId: string): ChannelMessage[] {
    return this.#requireLog(channelId).thread(parentId);
  }

  subscribe(channelId: string, sessionId: string, fromSeq: number, listener: RealtimeListener): () => void {
    return this.#requireLog(channelId).subscribe(sessionId, fromSeq, listener);
  }

  trackPresence(sessionId: string, actorId: string, channelId: string, action: "open" | "ping" | "close"): void {
    this.presence.init(sessionId, actorId);
    if (action === "open") this.presence.add(sessionId, "channel", channelId);
    else if (action === "ping") this.presence.ping(sessionId, "channel", channelId);
    else this.presence.remove(sessionId, "channel", channelId);
  }

  queryPresence(channelId: string) {
    return this.presence.query("channel", channelId);
  }

  createBot(input: CreateBotInput, ctx: RequestContext): BotRecord {
    if (!isBotToken(input.token)) throw new ChannelsError("invalid_bot_token", "malformed mbot token");
    const owner: BotOwner = assertBotOwnerXor({
      userId: input.userId ?? null,
      teamId: input.teamId ?? null,
    });
    if (this.#bots.has(input.token)) throw new ChannelsError("denied", "bot token already issued");
    const bot: BotRecord = {
      token: input.token,
      name: input.name,
      owner,
      channelIds: input.channelId ? [input.channelId] : [],
      lastUsedAt: null,
      revoked: false,
    };
    this.#bots.set(input.token, bot);
    if (input.channelId) this.#bindBot(input.channelId, input.token, ctx);
    return bot;
  }

  inviteBot(token: string, ctx: RequestContext): ChannelRecord {
    if (!isBotToken(token)) throw new ChannelsError("invalid_bot_token", "malformed mbot token");
    const receipt = ctx.receipt;
    if (!receipt) throw new ChannelsError("missing_receipt", "inviteBot requires a receipt");
    this.#bindBot(receipt.entityId, token, ctx);
    return this.#requireChannel(receipt.entityId);
  }

  /**
   * Explicitly not implemented. Channel bots post messages; mailbox send is N11.
   */
  sendMail(): never {
    throw new ChannelsError("send_mail_forbidden", "N9 does not send mail");
  }

  get(id: string): ChannelRecord | undefined {
    return this.#channels.get(id);
  }

  getBot(token: string): BotRecord | undefined {
    return this.#bots.get(token);
  }

  getLog(channelId: string): ChannelMessageLog | undefined {
    return this.#logs.get(channelId);
  }

  rebuildProjection(): void {
    this.plane = new ProjectionPlane();
    this.plane.rebuild(this.outbox);
  }

  drain(publish: (env: EventEnvelope) => void = () => undefined): void {
    this.outbox.drain(publish);
    this.plane.ingest(this.outbox);
  }

  #bindBot(channelId: string, token: string, ctx: RequestContext): void {
    const bot = this.#bots.get(token);
    if (!bot || bot.revoked) throw new ChannelsError("invalid_bot_token", "unknown or revoked bot");
    const log = this.#requireLog(channelId);
    log.addMember(token);
    const channel = this.#requireChannel(channelId);
    const memberIds = unique([...channel.memberIds, token]);
    const ownerId = channel.memberIds[0] ?? ctx.actor.actor.id;
    this.#putAccess(channelId, channel.tenantId, ownerId, memberIds, token);
    if (!bot.channelIds.includes(channelId)) bot.channelIds.push(channelId);
    const next = { ...channel, memberIds, version: channel.version + 1 };
    this.#channels.set(channelId, next);
    this.#publishChannel(next, ctx, "participant_added");
  }

  #touchBot(token: string, channelId: string): void {
    const bot = this.#bots.get(token);
    if (!bot || bot.revoked) throw new ChannelsError("invalid_bot_token", "unknown or revoked bot");
    if (!bot.channelIds.includes(channelId)) throw new ChannelsError("denied", "bot is not bound to channel");
    bot.lastUsedAt = this.#now();
  }

  #receiptForPoster(ctx: RequestContext, poster: { kind: string; actorId: string }, channelId: string): Receipt {
    if (poster.kind === "human" && ctx.receipt && ctx.receipt.entityId === channelId) return ctx.receipt;
    const actor: ActorContext =
      poster.kind === "bot"
        ? botActor(poster.actorId, ctx.actor.actor.tenantId)
        : ctx.actor;
    return this.engine.mint({
      actor,
      entityType: "channel",
      entityId: channelId,
      need: "comment",
    });
  }

  #mutateMembership(
    ctx: RequestContext,
    patch: (channel: ChannelRecord, log: ChannelMessageLog) => ChannelRecord,
    action: Extract<ActivityAction, "participant_added" | "participant_removed">,
  ): ChannelRecord {
    const receipt = ctx.receipt;
    if (!receipt) throw new ChannelsError("missing_receipt", "membership mutation requires a receipt");
    requireReceipt(receipt, "edit", receipt.entityId);
    const channel = this.#requireChannel(receipt.entityId);
    const log = this.#requireLog(channel.id);
    const next = patch(channel, log);
    this.#channels.set(next.id, next);
    this.#publishChannel(next, ctx, action);
    return next;
  }

  #putAccess(channelId: string, tenantId: string, ownerId: string, memberIds: string[], botToken: string | null): void {
    this.access.put(channelId, {
      ...withMembers(emptyAccess(ownerId, tenantId), memberIds.filter((id) => !isBotToken(id))),
      botToken,
      memberIds,
      channelUserIds: memberIds.filter((id) => !isBotToken(id)),
    });
  }

  #noteMentions(message: ChannelMessage): void {
    const matches = message.body.match(/@mbot_[0-9a-f]{12}_[0-9a-f]{64}/g) ?? [];
    for (const raw of matches) {
      const token = raw.slice(1);
      const key = `${message.id}:${token}`;
      if (this.mentions.has(key)) continue;
      this.mentions.add(key);
    }
  }

  #requireChannel(id: string): ChannelRecord {
    const channel = this.#channels.get(id);
    if (!channel) throw new ChannelsError("unknown_channel", `unknown channel ${id}`);
    return channel;
  }

  #requireLog(id: string): ChannelMessageLog {
    const log = this.#logs.get(id);
    if (!log) throw new ChannelsError("unknown_channel", `unknown channel log ${id}`);
    return log;
  }

  #publishChannel(
    channel: ChannelRecord,
    ctx: RequestContext,
    action: Extract<ActivityAction, "created" | "edited" | "deleted" | "messaged" | "participant_added" | "participant_removed">,
    body = "",
  ): void {
    const occurredAt = this.#now();
    this.outbox.append(
      envelope({
        topic: "channels",
        entityType: "channel",
        entityId: channel.id,
        tenantId: channel.tenantId,
        actorId: ctx.actor.actor.id,
        onBehalfOfId: ctx.actor.onBehalfOf?.id ?? null,
        occurredAt,
        version: channel.version,
        payload: {
          title: channel.title,
          facet: null,
          body,
          tombstoned: channel.deleted,
          flavor: channel.flavor,
          lastSeq: channel.lastSeq,
          createdAt: channel.createdAt,
        },
        receipt: {
          level: ctx.receipt?.level ?? "owner",
          entityType: "channel",
          entityId: channel.id,
          actorId: ctx.actor.actor.id,
        },
        correlationId: ctx.correlationId,
      }),
    );
    this.activity.append({
      id: `${action}:${channel.id}:${channel.version}`,
      action,
      entityType: "channel",
      entityId: channel.id,
      actorId: ctx.actor.actor.id,
      tenantId: channel.tenantId,
      occurredAt,
    });
    this.drain();
  }

  #now(): number {
    this.#clock += 1;
    return this.#clock;
  }
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function botActor(token: string, tenantId: string | null): ActorContext {
  const principal: Principal = { kind: "bot", id: token, tenantId };
  return { actor: principal, kernelUsername: "bot", isDeploymentAdmin: false };
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: false };
}

export { requestContext };
export type { HeaderMap };
