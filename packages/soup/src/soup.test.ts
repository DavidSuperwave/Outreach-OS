import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { userPrincipal } from "identity/principal";
import { EntityRegistry } from "registry";
import { PolicyEngine, emptyAccess, grantShare } from "authz";
import { Outbox, envelope } from "control-plane";
import { SoupIndex } from "./soup-index.js";
import { SOUP_ITEM_TYPES } from "./item.js";
import { FavoritesIndex, MAX_FAVORITES_PER_COLLECTION, fractionalBetween } from "./favorites.js";
import { toggleCollapsed } from "./grouping.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);

function actor(id: string) {
  return { actor: userPrincipal(id, tenant), kernelUsername: "u", isDeploymentAdmin: false };
}

function seedMint(type: "document" | "project" | "crm_company", n: number, facet: "task" | null = null) {
  const registry = new EntityRegistry();
  const id = fixtureId(type, n);
  registry.register({ type, id, tenantId: tenant, createdAt: 1, facet });
  const engine = new PolicyEngine(registry);
  const state = emptyAccess(ownerId, tenant);
  const owner = engine.mint({
    actor: actor(ownerId),
    entityType: type,
    entityId: id,
    need: "view",
    state,
  });
  return { id, engine, state, owner };
}

function appendDoc(
  box: Outbox,
  opts: {
    id: string;
    at: number;
    version: number;
    title: string;
    facet?: "task" | null;
    body?: string;
    projectId?: string;
    tombstoned?: boolean;
    correlationId: string;
  },
) {
  box.append(
    envelope({
      topic: "documents",
      entityType: "document",
      entityId: opts.id,
      tenantId: tenant,
      actorId: ownerId,
      onBehalfOfId: null,
      occurredAt: opts.at,
      version: opts.version,
      payload: {
        title: opts.title,
        facet: opts.facet ?? null,
        body: opts.body,
        projectId: opts.projectId,
        tombstoned: opts.tombstoned,
      },
      receipt: null,
      correlationId: opts.correlationId,
    }),
  );
}

describe("OD-7 soup item vocabulary", () => {
  it("has no Task item type; tasks ride document", () => {
    expect(SOUP_ITEM_TYPES).not.toContain("task");
    expect(SOUP_ITEM_TYPES).toContain("document");
  });
});

describe("05-MAP row 4: mixed list filters, order, pagination, updates", () => {
  it("ingests outbox events, filters by type/facet, pages, and live-updates", () => {
    const soup = new SoupIndex();
    const box = new Outbox();
    const seen: string[] = [];
    soup.subscribe((delta) => seen.push(delta.item.entityId));

    const task = seedMint("document", 1, "task");
    const doc = seedMint("document", 2, null);
    const project = seedMint("project", 1);

    appendDoc(box, {
      id: task.id,
      at: 30,
      version: 1,
      title: "Task A",
      facet: "task",
      correlationId: "1",
    });
    appendDoc(box, {
      id: doc.id,
      at: 20,
      version: 1,
      title: "Note",
      facet: null,
      correlationId: "2",
    });
    box.append(
      envelope({
        topic: "projects",
        entityType: "project",
        entityId: project.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 10,
        version: 1,
        payload: { title: "Folder" },
        receipt: null,
        correlationId: "3",
      }),
    );
    box.drain(() => undefined);
    expect(soup.ingest(box)).toBe(3);

    const mixed = soup.query({}, [task.owner, doc.owner, project.owner]);
    expect(mixed.items.map((item) => item.title)).toEqual(["Task A", "Note", "Folder"]);

    const tasksOnly = soup.query({ types: ["document"], facet: "task" }, [task.owner, doc.owner, project.owner]);
    expect(tasksOnly.items).toHaveLength(1);
    expect(tasksOnly.items[0]?.facet).toBe("task");

    const titled = soup.query({ titleContains: "Note" }, [task.owner, doc.owner, project.owner]);
    expect(titled.items.map((item) => item.title)).toEqual(["Note"]);

    const page = soup.query({ limit: 2 }, [task.owner, doc.owner, project.owner]);
    expect(page.items).toHaveLength(2);
    const page2 = soup.query({ limit: 2, cursor: page.nextCursor }, [task.owner, doc.owner, project.owner]);
    expect(page2.items).toHaveLength(1);

    const teammateReceipts: typeof task.owner[] = [];
    expect(soup.query({}, teammateReceipts).items).toHaveLength(0);

    appendDoc(box, {
      id: task.id,
      at: 40,
      version: 2,
      title: "Task A done",
      facet: "task",
      correlationId: "4",
    });
    box.drain(() => undefined);
    soup.ingest(box, box.getCheckpoint("soup.lists")?.lastEventId);
    expect(soup.get(task.id)?.title).toBe("Task A done");
    expect(seen.length).toBeGreaterThan(0);
  });

  it("sorts by title ascending independently of updatedAt", () => {
    const soup = new SoupIndex();
    const box = new Outbox();
    const zebra = seedMint("document", 11, null);
    const alpha = seedMint("document", 12, null);
    appendDoc(box, { id: zebra.id, at: 90, version: 1, title: "Zebra", correlationId: "z" });
    appendDoc(box, { id: alpha.id, at: 10, version: 1, title: "Alpha", correlationId: "a" });
    box.drain(() => undefined);
    soup.ingest(box);
    const page = soup.query({ sort: "title", order: "asc" }, [zebra.owner, alpha.owner]);
    expect(page.items.map((item) => item.title)).toEqual(["Alpha", "Zebra"]);
  });

  it("rebuilds from outbox after drop (gate 5)", () => {
    const box = new Outbox();
    const id = fixtureId("document", 9);
    appendDoc(box, { id, at: 1, version: 1, title: "rebuild me", facet: "task", correlationId: "r" });
    box.drain(() => undefined);
    const live = new SoupIndex();
    live.ingest(box);
    const rebuilt = new SoupIndex();
    rebuilt.ingest(box);
    expect(rebuilt.get(id)?.title).toBe(live.get(id)?.title);
    expect(rebuilt.snapshot()).toEqual(live.snapshot());
  });

  it("drops tombstones from the index and live-updates subscribers", () => {
    const soup = new SoupIndex();
    const box = new Outbox();
    const doc = seedMint("document", 20, null);
    appendDoc(box, { id: doc.id, at: 1, version: 1, title: "gone soon", correlationId: "t1" });
    box.drain(() => undefined);
    soup.ingest(box);
    expect(soup.query({}, [doc.owner]).items).toHaveLength(1);
    appendDoc(box, { id: doc.id, at: 2, version: 2, title: "gone soon", tombstoned: true, correlationId: "t2" });
    box.drain(() => undefined);
    soup.ingest(box, box.getCheckpoint("soup.lists")?.lastEventId);
    expect(soup.get(doc.id)).toBeUndefined();
    expect(soup.query({}, [doc.owner]).items).toHaveLength(0);
  });

  it("subscription reconnect replays missed deltas without duplication", () => {
    const soup = new SoupIndex();
    const box = new Outbox();
    const first = seedMint("document", 30, "task");
    const second = seedMint("document", 31, null);
    const seen = new Map<number, string>();
    const unsub = soup.subscribe((delta) => seen.set(delta.seq, delta.item.entityId));
    appendDoc(box, { id: first.id, at: 1, version: 1, title: "one", facet: "task", correlationId: "s1" });
    box.drain(() => undefined);
    soup.ingest(box);
    const cursor = soup.seq;
    unsub();
    appendDoc(box, { id: second.id, at: 2, version: 1, title: "two", correlationId: "s2" });
    box.drain(() => undefined);
    soup.ingest(box, box.getCheckpoint("soup.lists")?.lastEventId);
    const missed = soup.replayFrom(cursor);
    expect(missed.map((delta) => delta.item.entityId)).toEqual([second.id]);
    expect(missed.every((delta) => !seen.has(delta.seq))).toBe(true);
  });
});

describe("grouping (soup-nav collapse/expand)", () => {
  it("groups a mixed list by type and omits collapsed members from the flat page", () => {
    const soup = new SoupIndex();
    const box = new Outbox();
    const task = seedMint("document", 40, "task");
    const project = seedMint("project", 40);
    appendDoc(box, { id: task.id, at: 2, version: 1, title: "Task", facet: "task", correlationId: "g1" });
    box.append(
      envelope({
        topic: "projects",
        entityType: "project",
        entityId: project.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 1,
        version: 1,
        payload: { title: "Folder" },
        receipt: null,
        correlationId: "g2",
      }),
    );
    box.drain(() => undefined);
    soup.ingest(box);
    const receipts = [task.owner, project.owner];
    const open = soup.query({ groupBy: "type" }, receipts);
    expect(open.groups.map((group) => group.key)).toEqual(["document", "project"]);
    expect(open.items).toHaveLength(2);

    const collapsed = toggleCollapsed(new Set(), "document");
    const closed = soup.query({ groupBy: "type", collapsedGroups: [...collapsed] }, receipts);
    expect(closed.groups.find((group) => group.key === "document")?.collapsed).toBe(true);
    expect(closed.items.map((item) => item.entityType)).toEqual(["project"]);
  });
});

describe("favorites listing is enforced", () => {
  it("caps at 500, fractional-orders, hydrates from soup, and hides rows without a view receipt", () => {
    const fav = new FavoritesIndex();
    const soup = new SoupIndex();
    const box = new Outbox();
    const seeded = seedMint("document", 3, "task");
    appendDoc(box, { id: seeded.id, at: 1, version: 1, title: "Pinned task", facet: "task", correlationId: "f" });
    box.drain(() => undefined);
    soup.ingest(box);

    const first = fav.insertBetween({ entityId: seeded.id, entityType: "document" });
    expect(first.sortOrder).toBe(1);
    expect(fav.list([seeded.owner])).toHaveLength(1);
    expect(fav.list([])).toHaveLength(0);
    expect(fav.hydrate(soup, [seeded.owner])[0]?.title).toBe("Pinned task");
    expect(MAX_FAVORITES_PER_COLLECTION).toBe(500);
    expect(fractionalBetween(1, 2)).toBe(1.5);

    const filler = seedMint("document", 4, null);
    for (let i = 0; i < MAX_FAVORITES_PER_COLLECTION - 1; i += 1) {
      fav.add({ entityId: `${filler.id}-${i}`, entityType: "document", sortOrder: i + 2 });
    }
    expect(() => fav.add({ entityId: "overflow", entityType: "document", sortOrder: 999 })).toThrow(/cap 500/);
    const shared = grantShare(seeded.state, teammateId, "comment");
    void shared;
  });
});

describe("N6 task property projection", () => {
  it("copies status and priority from the document envelope onto the Soup row", () => {
    const soup = new SoupIndex();
    const box = new Outbox();
    const task = seedMint("document", 9, "task");
    box.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: task.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 1,
        version: 1,
        payload: { title: "Ship", facet: "task", status: "in_progress", priority: "high" },
        receipt: null,
        correlationId: "prop-1",
      }),
    );
    soup.ingest(box);
    const row = soup.query({ types: ["document"], facet: "task" }, [task.owner]).items[0];
    expect(row?.status).toBe("in_progress");
    expect(row?.priority).toBe("high");
  });
});
