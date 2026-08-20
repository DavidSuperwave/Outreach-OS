import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { ownerOf } from "control-plane";
import { commandEnabled as chromeEnabled, defaultChromeContext, CommandRegistry } from "shell";
import {
  ChannelsSlice,
  actorContext,
  botActor,
  requestContext,
} from "./slice.js";
import { dryRunIdentityMapping, COMMS_TABLES } from "./mapping.js";
import { CHANNEL_COMMAND_IDS, CHANNEL_COMMAND_FREEZE_COUNT, N9_PARITY_COMMAND_IDS } from "./commands.js";
import {
  BOT_TOKEN_HEADER,
  BOT_SCOPE_HEADER,
  BOT_TOKEN_RE,
  FIXTURE_BOT_TOKEN,
  FIXTURE_BOT_TOKEN_B,
  assertBotOwnerXor,
  isBotToken,
  parseBotToken,
  resolvePosterXor,
  webhookPath,
  ChannelsError,
} from "./bot.js";
import { N9_KERNEL_RPC, PresenceStore, trackPath } from "./presence.js";
import { REALTIME_EVENT_TYPES, type RealtimeEvent } from "./types.js";
import { ChannelWorkspace } from "./ui.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function teammateActor() {
  return actorContext(userPrincipal(teammateId, tenant), "member");
}

describe("N9 channels + messages + realtime (05-MAP row 7)", () => {
  it("maps seven comms_* tables without writing (OD-1 Branch A)", () => {
    expect(COMMS_TABLES).toHaveLength(7);
    const mapped = dryRunIdentityMapping(COMMS_TABLES.map((table, index) => ({ table, pgId: index + 1 })));
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
    expect(mapped.map((row) => row.role)).toEqual([
      "channel",
      "member",
      "message",
      "thread",
      "reaction",
      "bot",
      "bot_token",
    ]);
    const slice = new ChannelsSlice();
    expect(slice.registry.get(mapped[0]!.mappedId)).toBeNull();
  });

  it("two users and one agent exchange ordered messages and reconnect without loss or duplication", () => {
    resetIdSequence();
    const slice = new ChannelsSlice();
    const api = slice.openApi();
    const { channel, receipt } = api.createChannel(
      { title: "Outreach", memberIds: [teammateId] },
      requestContext(ownerActor(), { correlationId: "ch-1" }),
    );
    api.createBot(
      { name: "Agent", token: FIXTURE_BOT_TOKEN, userId: ownerId, channelId: channel.id },
      requestContext(ownerActor(), { receipt, correlationId: "bot-1" }),
    );

    const seenA: RealtimeEvent[] = [];
    const seenB: RealtimeEvent[] = [];
    const seenAgent: RealtimeEvent[] = [];
    const unsubA = api.subscribe(channel.id, "sess-a", 0, (event) => seenA.push(event));
    const unsubB = api.subscribe(channel.id, "sess-b", 0, (event) => seenB.push(event));
    api.subscribe(channel.id, "sess-agent", 0, (event) => seenAgent.push(event));
    expect(seenA.some((event) => event.type === "ready")).toBe(true);

    const ownerCtx = requestContext(ownerActor(), { receipt, correlationId: "m1" });
    const a1 = api.postMessage({ channelId: channel.id, body: "hello from A" }, ownerCtx);
    const teammateReceipt = slice.engine.mint({
      actor: teammateActor(),
      entityType: "channel",
      entityId: channel.id,
      need: "comment",
    });
    const b1 = api.postMessage(
      { channelId: channel.id, body: "hello from B" },
      requestContext(teammateActor(), { receipt: teammateReceipt, correlationId: "m2" }),
    );
    const agent1 = api.postMessage(
      { channelId: channel.id, body: "agent ack", agent: true },
      requestContext(botActor(FIXTURE_BOT_TOKEN, tenant), { correlationId: "m3" }),
    );

    const liveBodies = (events: RealtimeEvent[]) =>
      events.filter((event) => event.type === "message").map((event) => event.message.body);
    expect(liveBodies(seenA)).toEqual(["hello from A", "hello from B", "agent ack"]);
    expect(liveBodies(seenB)).toEqual(liveBodies(seenA));
    expect(liveBodies(seenAgent)).toEqual(liveBodies(seenA));
    expect([a1.message.seq, b1.message.seq, agent1.message.seq]).toEqual([1, 2, 3]);
    expect(api.listMessages(channel.id).map((row) => row.seq)).toEqual([1, 2, 3]);
    expect(agent1.message.senderKind).toBe("agent");

    const cursor = seenA.filter((event) => event.type !== "ready").at(-1)!.seq;
    unsubA();
    unsubB();

    api.postMessage({ channelId: channel.id, body: "after disconnect" }, ownerCtx);
    const thread = api.postMessage(
      { channelId: channel.id, body: "thread reply", parentId: a1.message.id },
      ownerCtx,
    );
    expect(thread.message.parentId).toBe(a1.message.id);
    expect(api.listThread(channel.id, a1.message.id).map((row) => row.body)).toEqual(["thread reply"]);

    const replayA: RealtimeEvent[] = [];
    const seqs = new Set<number>();
    api.subscribe(channel.id, "sess-a-re", cursor, (event) => {
      if (event.type === "ready") return;
      expect(seqs.has(event.seq)).toBe(false);
      seqs.add(event.seq);
      replayA.push(event);
    });
    expect(replayA.filter((event) => event.type === "message").map((event) => event.message.body)).toEqual([
      "after disconnect",
      "thread reply",
    ]);
    expect(replayA.every((event) => event.seq > cursor)).toBe(true);

    const dm = api.createDm(teammateId, requestContext(ownerActor(), { correlationId: "dm-1" }));
    expect(dm.channel.flavor).toBe("dm");
    expect(dm.channel.memberIds).toEqual([ownerId, teammateId]);
  });

  it("presence query replaces /track and PresenceSubscriber init/add/remove", () => {
    expect(N9_KERNEL_RPC).toEqual([
      "PresenceSubscriber.init",
      "PresenceSubscriber.add",
      "PresenceSubscriber.remove",
    ]);
    const store = new PresenceStore();
    store.init("s1", ownerId);
    store.init("s2", teammateId);
    store.add("s1", "channel", "chn_1");
    store.ping("s2", "channel", "chn_1");
    const snapshot = store.query("channel", "chn_1");
    expect(snapshot.trackPath).toBe(trackPath("channel", "chn_1"));
    expect(snapshot.trackPath).toBe("/track/channel/chn_1");
    expect(snapshot.sessions.map((row) => row.actorId).sort()).toEqual([ownerId, teammateId].sort());
    store.remove("s1", "channel", "chn_1");
    expect(store.query("channel", "chn_1").sessions.map((row) => row.actorId)).toEqual([teammateId]);

    resetIdSequence();
    const slice = new ChannelsSlice();
    const api = slice.openApi();
    const { channel } = api.createChannel({ title: "P" }, requestContext(ownerActor(), { correlationId: "p" }));
    api.trackPresence("ua", ownerId, channel.id, "open");
    api.trackPresence("ub", teammateId, channel.id, "open");
    expect(api.queryPresence(channel.id).sessions).toHaveLength(2);
    api.trackPresence("ua", ownerId, channel.id, "close");
    expect(api.queryPresence(channel.id).sessions).toHaveLength(1);
  });

  it("channel-bot contract: mbot format, x-macro-bot-token header, no send mail", () => {
    expect(BOT_TOKEN_HEADER).toBe("x-macro-bot-token");
    expect(BOT_SCOPE_HEADER).toBe("x-macro-bot-scope");
    expect(isBotToken(FIXTURE_BOT_TOKEN)).toBe(true);
    expect(BOT_TOKEN_RE.test(FIXTURE_BOT_TOKEN)).toBe(true);
    expect(parseBotToken(FIXTURE_BOT_TOKEN)).toEqual({ prefix: "a".repeat(12), secret: "b".repeat(64) });
    expect(isBotToken("mbot_short")).toBe(false);

    resetIdSequence();
    const slice = new ChannelsSlice();
    const api = slice.openApi();
    const { channel, receipt } = api.createChannel({ title: "Bots" }, requestContext(ownerActor(), { correlationId: "b0" }));
    api.createBot(
      { name: "Status", token: FIXTURE_BOT_TOKEN, userId: ownerId, channelId: channel.id },
      requestContext(ownerActor(), { receipt, correlationId: "b1" }),
    );
    expect(api.webhookUrl(channel.id)).toBe(webhookPath(channel.id));
    const posted = api.postWebhook(channel.id, "stripe event", {
      [BOT_TOKEN_HEADER]: FIXTURE_BOT_TOKEN,
      [BOT_SCOPE_HEADER]: "channel",
    });
    expect(posted.message.senderKind).toBe("bot");
    expect(posted.message.body).toBe("stripe event");
    expect(slice.getBot(FIXTURE_BOT_TOKEN)?.lastUsedAt).toBeGreaterThan(0);
    expect(() => slice.sendMail()).toThrow(ChannelsError);
    expect(() => slice.sendMail()).toThrow(/does not send mail/);
    expect(Object.keys(api)).not.toContain("sendMail");
  });

  it("bot ownership XOR and human XOR bot poster", () => {
    expect(() => assertBotOwnerXor({ userId: ownerId, teamId: tenant })).toThrow(/XOR/);
    expect(() => assertBotOwnerXor({})).toThrow(/XOR/);
    expect(assertBotOwnerXor({ userId: ownerId })).toEqual({ kind: "user", userId: ownerId });
    expect(assertBotOwnerXor({ teamId: tenant })).toEqual({ kind: "team", teamId: tenant });

    expect(() =>
      resolvePosterXor({
        actorKind: "user",
        actorId: ownerId,
        headers: { [BOT_TOKEN_HEADER]: FIXTURE_BOT_TOKEN },
      }),
    ).toThrow(/XOR/);
    expect(() => resolvePosterXor({ actorKind: null })).toThrow(/XOR/);
    expect(resolvePosterXor({ actorKind: "user", actorId: ownerId }).kind).toBe("human");
    expect(resolvePosterXor({ actorKind: null, headers: { [BOT_TOKEN_HEADER]: FIXTURE_BOT_TOKEN } }).kind).toBe("bot");

    resetIdSequence();
    const slice = new ChannelsSlice();
    const api = slice.openApi();
    const { channel, receipt } = api.createChannel({ title: "Xor" }, requestContext(ownerActor(), { correlationId: "x0" }));
    expect(() =>
      api.createBot(
        { name: "Both", token: FIXTURE_BOT_TOKEN, userId: ownerId, teamId: tenant },
        requestContext(ownerActor(), { receipt, correlationId: "x1" }),
      ),
    ).toThrow(/XOR/);
    api.createBot(
      { name: "Team bot", token: FIXTURE_BOT_TOKEN_B, teamId: tenant, channelId: channel.id },
      requestContext(ownerActor(), { receipt, correlationId: "x2" }),
    );
    expect(() =>
      api.postMessage(
        { channelId: channel.id, body: "nope", headers: { [BOT_TOKEN_HEADER]: FIXTURE_BOT_TOKEN_B } },
        requestContext(ownerActor(), { receipt, correlationId: "x3" }),
      ),
    ).toThrow(/XOR/);
  });

  it("membership serializes with the log so a removed member cannot post", () => {
    resetIdSequence();
    const slice = new ChannelsSlice();
    const api = slice.openApi();
    const { channel, receipt } = api.createChannel(
      { title: "Members", memberIds: [teammateId] },
      requestContext(ownerActor(), { correlationId: "mem-1" }),
    );
    const teammateReceipt = slice.engine.mint({
      actor: teammateActor(),
      entityType: "channel",
      entityId: channel.id,
      need: "comment",
    });
    api.removeMember(teammateId, requestContext(ownerActor(), { receipt, correlationId: "mem-2" }));
    expect(() =>
      api.postMessage(
        { channelId: channel.id, body: "too late" },
        requestContext(teammateActor(), { receipt: teammateReceipt, correlationId: "mem-3" }),
      ),
    ).toThrow(/not a member/);
  });

  it("duplicate idempotency keys are no-ops and Soup lists the channel", () => {
    resetIdSequence();
    const slice = new ChannelsSlice();
    const api = slice.openApi();
    const ctx = requestContext(ownerActor(), { correlationId: "id-1", idempotencyKey: "create-once" });
    const first = api.createChannel({ title: "Once" }, ctx);
    const second = api.createChannel({ title: "Once" }, ctx);
    expect(second.channel.id).toBe(first.channel.id);
    expect(api.listChannels([first.receipt])).toHaveLength(1);
    expect(api.listChannels([first.receipt])[0]?.title).toBe("Once");
  });

  it("names the 16-command freeze and chrome parity set including find two-scope loop", () => {
    expect(CHANNEL_COMMAND_IDS).toHaveLength(CHANNEL_COMMAND_FREEZE_COUNT);
    expect(new Set(CHANNEL_COMMAND_IDS).size).toBe(16);
    expect(CHANNEL_COMMAND_IDS).toEqual(expect.arrayContaining(["channel.find", "channel.find-input"]));
    expect(N9_PARITY_COMMAND_IDS).toEqual(
      expect.arrayContaining(["create-menu.channel", "go-to.channels", "channel.reply"]),
    );
    const chrome = defaultChromeContext({ leader: "c", signedIn: true });
    expect(chromeEnabled("create-menu.channel", chrome)).toBe(true);
    expect(chromeEnabled("create-menu.channel-message", chrome)).toBe(true);
    expect(chromeEnabled("go-to.channels", chrome)).toBe(true);
    expect(chromeEnabled("command-menu.open-category.channels", chrome)).toBe(true);

    const registry = new CommandRegistry();
    registry.setActive("block");
    registry.register({
      id: "channel.find",
      scope: "block",
      chord: "cmd+f",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: true,
      handle: () => true,
    });
    expect(registry.dispatch({ chord: "cmd+f", inputFocused: true, touch: false, platform: "mac" })).toBe("channel.find");
    expect(REALTIME_EVENT_TYPES).toEqual(["message", "message_edited", "message_deleted", "presence", "ready"]);
  });

  it("renders ChannelWorkspace on Shell /channels without Macro branding", () => {
    resetIdSequence();
    const slice = new ChannelsSlice();
    const api = slice.openApi();
    const { channel, receipt } = api.createChannel({ title: "Visible channel" }, requestContext(ownerActor(), { correlationId: "ui" }));
    api.postMessage(
      { channelId: channel.id, body: "first line" },
      requestContext(ownerActor(), { receipt, correlationId: "ui-m" }),
    );
    api.trackPresence("ui", ownerId, channel.id, "open");
    const html = renderToString(
      createElement(ChannelWorkspace, {
        items: api.listChannels([receipt]),
        messages: api.listMessages(channel.id),
        presence: api.queryPresence(channel.id),
        composeOpen: true,
        draft: "Visible channel",
        findOpen: true,
      }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-split=\"channel\"");
    expect(html).toContain("data-path=\"/channel/_\"");
    expect(html).toContain("href=\"/channels\"");
    expect(html).toContain("Visible channel");
    expect(html).toContain("first line");
    expect(html).toContain("data-command=\"create-menu.channel\"");
    expect(html).toContain("data-command=\"channel.find\"");
    expect(html).toContain("data-surface=\"channel.messages\"");
    expect(html).not.toMatch(/macro/i);
  });

  it("registers channel_message_log, channel_members, and channel_presence in STORAGE_OWNERS", () => {
    expect(ownerOf("channel_message_log").owner).toBe("channels.ChannelsSlice");
    expect(ownerOf("channel_message_log").kind).toBe("do");
    expect(ownerOf("channel_members").kind).toBe("d1");
    expect(ownerOf("channel_presence").owner).toBe("channels.PresenceStore");
  });
});
