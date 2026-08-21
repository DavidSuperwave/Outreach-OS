import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AuthzError, emptyAccess, requireReceipt } from "authz";
import { ACTIVITY_ACTIONS, Outbox, envelope } from "control-plane";
import { userPrincipal } from "identity/principal";
import { fixtureId } from "registry";
import { PATH_ROUTES, isWebServed } from "shell";
import { MAX_FAVORITES_PER_COLLECTION as SOUP_FAVORITES_CAP, N4_COMMAND_IDS } from "soup";
import { ActivitySlice, actorContext } from "./slice.js";
import { activityFactId, activityId, ACTIVITY_ID_NAMESPACE, uuidv5, UUID_NAMESPACE_DNS } from "./ids.js";
import {
  combineScore,
  frequencyValue,
  recencyValue,
  FREQUENCY_PERCENT,
  MAX_RECENT_EVENTS,
  RECENCY_DECAY_RATE,
  RECENCY_PERCENT,
} from "./frecency.js";
import { ACTIVITY_COMMAND_IDS, N17_PARITY_COMMAND_IDS } from "./commands.js";
import { FREQUENCY_PERCENT as TYPE_FREQUENCY, MS_PER_HOUR, RECENTS_DELETED_HTTP } from "./types.js";
import { ActivityError } from "./errors.js";
import { ActivityWorkspace } from "./ui.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);
const HOUR = MS_PER_HOUR;

function src(name: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), name), "utf8");
}

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function seedDocument(slice: ActivitySlice, n: number, title: string) {
  const id = fixtureId("document", n);
  slice.registry.register({ type: "document", id, tenantId: tenant, createdAt: 1, facet: "task" });
  slice.access.put(id, emptyAccess(ownerId, tenant));
  const box = new Outbox();
  box.append(
    envelope({
      topic: "documents",
      entityType: "document",
      entityId: id,
      tenantId: tenant,
      actorId: ownerId,
      onBehalfOfId: null,
      occurredAt: 1,
      version: 1,
      payload: { title, facet: "task" },
      receipt: null,
      correlationId: `soup-${n}`,
    }),
  );
  box.drain(() => undefined);
  slice.soup.ingest(box);
  const receipt = slice.engine.mint({
    actor: ownerActor(),
    entityType: "document",
    entityId: id,
    need: "view",
  });
  return { id, receipt };
}

function recordOpened(
  slice: ActivitySlice,
  entityId: string,
  occurredAt: number,
  actorId = ownerId,
) {
  return slice.record({
    action: "opened",
    entityType: "document",
    entityId,
    actorId,
    tenantId: tenant,
    occurredAt,
  });
}

describe("N17 uuidv5 activity ids", () => {
  it("matches the RFC 4122 DNS name-based vector", () => {
    expect(uuidv5("www.example.com", UUID_NAMESPACE_DNS)).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
    expect(uuidv5("python.org", UUID_NAMESPACE_DNS)).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
  });

  it("is deterministic for the same (action, entityType, entityId, actorId, occurredAt)", () => {
    const input = {
      action: "created" as const,
      entityType: "document",
      entityId: fixtureId("document", 1),
      actorId: ownerId,
      occurredAt: 42,
    };
    const a = activityFactId(input);
    const b = activityFactId(input);
    expect(a).toBe(b);
    expect(a).toBe(activityId(ACTIVITY_ID_NAMESPACE, `created:document:${input.entityId}:${ownerId}:42`));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("treats replay of the same tuple as a no-op", () => {
    const slice = new ActivitySlice();
    const entityId = fixtureId("document", 1);
    const first = recordOpened(slice, entityId, 100);
    const replay = recordOpened(slice, entityId, 100);
    expect(first?.id).toBe(replay?.id);
    expect(slice.activity.list()).toHaveLength(1);
  });
});

describe("N17 closed vocabulary poison", () => {
  it("imports ACTIVITY_ACTIONS from control-plane and does not duplicate the list", () => {
    expect(ACTIVITY_ACTIONS).toHaveLength(10);
    expect(ACTIVITY_ACTIONS).toEqual([
      "created",
      "edited",
      "opened",
      "deleted",
      "messaged",
      "sent",
      "property_changed",
      "participant_added",
      "participant_removed",
      "call_started",
    ]);
    expect(src("slice.ts")).toMatch(/ACTIVITY_ACTIONS/);
    expect(src("slice.ts")).toMatch(/from "control-plane"/);
    expect(src("commands.ts")).not.toContain("property_changed");
    expect(src("types.ts")).not.toContain("participant_added");
  });

  it("rejects unknown actions as poison (counter++, skip)", () => {
    const slice = new ActivitySlice();
    const entityId = fixtureId("document", 1);
    const poisoned = slice.record({
      action: "starred",
      entityType: "document",
      entityId,
      actorId: ownerId,
      tenantId: tenant,
      occurredAt: 1,
    });
    expect(poisoned).toBeNull();
    expect(slice.poisonCount).toBe(1);
    expect(slice.activity.list()).toHaveLength(0);
    const ok = recordOpened(slice, entityId, 2);
    expect(ok?.action).toBe("opened");
    expect(slice.poisonCount).toBe(1);
    expect(slice.activity.list()).toHaveLength(1);
  });
});

describe("N17 frecency constants and scores", () => {
  it("freezes OD-21 constants exactly", () => {
    expect(FREQUENCY_PERCENT).toBe(0.7);
    expect(RECENCY_PERCENT).toBe(0.3);
    expect(RECENCY_DECAY_RATE).toBe(0.1);
    expect(MAX_RECENT_EVENTS).toBe(10);
    expect(TYPE_FREQUENCY).toBe(0.7);
    expect(FREQUENCY_PERCENT + RECENCY_PERCENT).toBe(1);
  });

  it("pins exact numeric scores against a fake clock", () => {
    const now = 20 * HOUR;
    const slice = new ActivitySlice(now);
    const hot = fixtureId("document", 10);
    const once = fixtureId("document", 20);
    const stale = fixtureId("document", 30);

    for (let i = 0; i < 10; i += 1) recordOpened(slice, hot, now - i);
    recordOpened(slice, once, now);
    for (let i = 0; i < 5; i += 1) recordOpened(slice, stale, now - 10 * HOUR - i);

    const hotScore = slice.score(ownerId, hot)!;
    const onceScore = slice.score(ownerId, once)!;
    const staleScore = slice.score(ownerId, stale)!;

    expect(hotScore.frequency).toBe(1);
    expect(hotScore.recency).toBe(1);
    expect(hotScore.score).toBe(1);

    expect(onceScore.frequency).toBe(0.1);
    expect(onceScore.recency).toBe(1);
    expect(onceScore.score).toBe(0.37);

    expect(staleScore.frequency).toBe(0.5);
    expect(staleScore.recency).toBe(Math.exp(-1));
    expect(staleScore.score).toBe(0.7 * 0.5 + 0.3 * Math.exp(-1));
    expect(staleScore.score).toBe(combineScore(frequencyValue(5), recencyValue(10)));
  });

  it("scores from the last 10 events only", () => {
    const now = 15 * HOUR;
    const slice = new ActivitySlice(now);
    const entityId = fixtureId("document", 11);
    for (let i = 0; i < 15; i += 1) recordOpened(slice, entityId, now - i);
    const scored = slice.score(ownerId, entityId)!;
    expect(scored.eventCount).toBe(10);
    expect(scored.frequency).toBe(1);
    expect(scored.recency).toBe(1);
    expect(scored.score).toBe(1);
  });
});

describe("N17 recents = frecency (05-MAP row 12)", () => {
  it("ranks a stream stably (score desc, entityId) and replay does not reorder", () => {
    const now = 20 * HOUR;
    const slice = new ActivitySlice(now);
    const hot = fixtureId("document", 10);
    const once = fixtureId("document", 20);
    const stale = fixtureId("document", 30);
    const tiedA = fixtureId("document", 40);
    const tiedB = fixtureId("document", 41);

    const stream: Array<{ entityId: string; at: number }> = [];
    for (let i = 0; i < 10; i += 1) stream.push({ entityId: hot, at: now - i });
    stream.push({ entityId: once, at: now });
    for (let i = 0; i < 5; i += 1) stream.push({ entityId: stale, at: now - 10 * HOUR - i });
    stream.push({ entityId: tiedA, at: now });
    stream.push({ entityId: tiedB, at: now });

    for (const row of stream) recordOpened(slice, row.entityId, row.at);
    const first = slice.recents(ownerId).map((row) => row.entityId);
    expect(first).toEqual([hot, stale, once, tiedA, tiedB]);

    for (const row of stream) recordOpened(slice, row.entityId, row.at);
    expect(slice.recents(ownerId).map((row) => row.entityId)).toEqual(first);
    expect(slice.activity.list()).toHaveLength(stream.length);
  });

  it("names GET /recents/deleted as leftover and does not build a second recents engine", () => {
    expect(RECENTS_DELETED_HTTP).toBe("/recents/deleted");
    expect(src("slice.ts")).not.toMatch(/\/recents\/deleted/);
    expect(src("slice.ts")).toMatch(/rankRecents/);
    expect(src("ui.tsx")).toContain('data-surface="activity.frecency"');
    expect(src("ui.tsx")).not.toContain('data-surface="activity.recents"');
  });
});

describe("N17 my-activity and entity-activity", () => {
  it("splits the two keyset surfaces and never mints on query", () => {
    const slice = new ActivitySlice(100);
    const { id: a, receipt: receiptA } = seedDocument(slice, 1, "Alpha");
    const { id: b } = seedDocument(slice, 2, "Beta");
    recordOpened(slice, a, 10);
    recordOpened(slice, b, 20);
    slice.record({
      action: "edited",
      entityType: "document",
      entityId: a,
      actorId: teammateId,
      tenantId: tenant,
      occurredAt: 30,
    });

    const mint = vi.spyOn(slice.engine, "mint");
    const mine = slice.myActivity(ownerId);
    const entity = slice.entityActivity(a, receiptA);
    slice.recents(ownerId);
    slice.listFavorites([receiptA]);
    slice.hydrateFavorites([receiptA]);
    expect(mint).not.toHaveBeenCalled();

    expect(mine.map((row) => row.entityId)).toEqual([b, a]);
    expect(mine.every((row) => row.actorId === ownerId)).toBe(true);
    expect(entity.map((row) => row.action).sort()).toEqual(["edited", "opened"]);
    expect(entity.every((row) => row.entityId === a)).toBe(true);

    expect(() => slice.entityActivity(b, receiptA)).toThrow(AuthzError);
    requireReceipt(receiptA, "view", a);
  });
});

describe("N17 favorites wrap soup FavoritesIndex", () => {
  it("requires view, hydrates titles, rechecks receipts, fractionally reorders, and caps at 500", () => {
    const slice = new ActivitySlice();
    const { id: firstId, receipt: firstReceipt } = seedDocument(slice, 3, "Pinned task");
    const { id: secondId, receipt: secondReceipt } = seedDocument(slice, 4, "Second pin");

    const first = slice.addFavorite({ entityId: firstId, entityType: "document" }, firstReceipt);
    expect(first.sortOrder).toBe(1);
    expect(slice.listFavorites([firstReceipt])).toHaveLength(1);
    expect(slice.listFavorites([])).toHaveLength(0);
    expect(slice.hydrateFavorites([firstReceipt])[0]?.title).toBe("Pinned task");
    expect(slice.hydrateFavorites([])).toHaveLength(0);
    expect(SOUP_FAVORITES_CAP).toBe(500);

    const second = slice.addFavorite({ entityId: secondId, entityType: "document" }, secondReceipt);
    const moved = slice.reorderFavorite(
      { entityId: secondId, entityType: "document" },
      secondReceipt,
      undefined,
      first.sortOrder,
    );
    expect(moved.sortOrder).toBe(first.sortOrder / 2);
    expect(second.sortOrder).toBe(2);

    const filler = fixtureId("document", 9);
    for (let i = 0; i < 498; i += 1) {
      slice.favorites.add({ entityId: `${filler}-${i}`, entityType: "document", sortOrder: i + 3 });
    }
    const { id: overflowId, receipt: overflowReceipt } = seedDocument(slice, 8, "Overflow");
    expect(() => slice.addFavorite({ entityId: overflowId, entityType: "document" }, overflowReceipt)).toThrow(
      ActivityError,
    );
    expect(() => slice.addFavorite({ entityId: overflowId, entityType: "document" }, overflowReceipt)).toThrow(/cap 500/);
  });

  it("publishes no activity facts when favorites change", () => {
    const slice = new ActivitySlice();
    const { id, receipt } = seedDocument(slice, 5, "Quiet pin");
    recordOpened(slice, id, 1);
    const before = slice.activity.list().length;
    const poisonBefore = slice.poisonCount;
    slice.addFavorite({ entityId: id, entityType: "document" }, receipt);
    slice.reorderFavorite({ entityId: id, entityType: "document" }, receipt, 1);
    slice.removeFavorite(id);
    expect(slice.activity.list()).toHaveLength(before);
    expect(slice.poisonCount).toBe(poisonBefore);
    expect(src("slice.ts")).toMatch(/Favorites emit no activity facts/);
  });
});

describe("N17 OD-19 no retention/deletion job", () => {
  it("does not expose a delete-retention API", () => {
    const api = new ActivitySlice().openApi();
    expect(Object.keys(api).sort()).toEqual([
      "addFavorite",
      "entityActivity",
      "hydrateFavorites",
      "listFavorites",
      "myActivity",
      "recents",
      "record",
      "removeFavorite",
      "reorderFavorite",
      "score",
    ]);
    for (const key of Object.keys(api)) {
      expect(key).not.toMatch(/delete|purge|retain|expire|gc|retention/i);
    }
    expect(src("slice.ts")).not.toMatch(/function (purge|expire|gcActivity|retain)/);
    expect(src("slice.ts")).not.toMatch(/class \w*(Retention|Deletion)Job/);
    expect(src("index.ts")).not.toMatch(/purgeExpired|deleteRetention|gcActivity/);
  });
});

describe("N17 commands + UI + /activity route", () => {
  it("reuses the N4 favorites command rows and adds no new freeze", () => {
    expect(ACTIVITY_COMMAND_IDS).toHaveLength(0);
    expect(N17_PARITY_COMMAND_IDS).toEqual(["favorites.open.<favorite>", "soup-entity.favorite"]);
    expect(N4_COMMAND_IDS).toContain("favorites.open.<favorite>");
    expect(N4_COMMAND_IDS).toContain("soup-entity.favorite");
  });

  it("serves Shell path /activity from PATH_ROUTES", () => {
    expect(PATH_ROUTES).toContain("/activity");
    expect(isWebServed("/activity")).toBe(true);
  });

  it("renders ActivityWorkspace surfaces without Macro branding", () => {
    const html = renderToString(
      createElement(ActivityWorkspace, {
        mine: [
          {
            id: "fact-1",
            action: "opened",
            entityType: "document",
            entityId: fixtureId("document", 1),
            actorId: ownerId,
            occurredAt: 1,
          },
        ],
        recents: [
          {
            entityId: fixtureId("document", 1),
            entityType: "document",
            score: 1,
            frequency: 1,
            recency: 1,
            lastOccurredAt: 1,
            eventCount: 10,
          },
        ],
        favorites: [
          {
            entityId: fixtureId("document", 1),
            entityType: "document",
            title: "Pinned task",
            sortOrder: 1,
          },
        ],
      }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-split=\"home\"");
    expect(html).toContain("data-path-route=\"/activity\"");
    expect(html).toContain("data-surface=\"activity.mine\"");
    expect(html).toContain("data-surface=\"activity.frecency\"");
    expect(html).toContain("data-surface=\"favorites.list\"");
    expect(html).toContain("data-command=\"favorites.open.&lt;favorite&gt;\"");
    expect(html).toContain("data-command=\"soup-entity.favorite\"");
    expect(html).toContain("Pinned task");
    expect(html).not.toMatch(/macro/i);
  });

  it("keeps browser.ts UI-only (no node:crypto)", () => {
    expect(src("browser.ts")).not.toMatch(/node:crypto/);
    expect(src("browser.ts")).not.toMatch(/from "\.\/slice/);
    expect(src("browser.ts")).not.toMatch(/from "\.\/ids/);
    expect(src("ui.tsx")).not.toMatch(/node:crypto/);
    expect(src("ids.ts")).toMatch(/node:crypto/);
  });
});
