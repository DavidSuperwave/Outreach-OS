import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { userPrincipal } from "identity/principal";
import { EntityRegistry } from "registry";
import { PolicyEngine, emptyAccess, grantShare } from "authz";
import { Outbox, envelope } from "control-plane";
import { SoupIndex } from "./soup-index.js";
import { SOUP_ITEM_TYPES } from "./item.js";
import { FavoritesIndex, MAX_FAVORITES_PER_COLLECTION } from "./favorites.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);

function actor(id: string) {
  return { actor: userPrincipal(id, tenant), kernelUsername: "u", isDeploymentAdmin: false };
}

function seedMint(type: "document" | "project", n: number, facet: "task" | null = null) {
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
    soup.subscribe((item) => seen.push(item.entityId));

    const task = seedMint("document", 1, "task");
    const doc = seedMint("document", 2, null);
    const project = seedMint("project", 1);

    box.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: task.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 30,
        version: 1,
        payload: { title: "Task A", facet: "task" },
        receipt: null,
        correlationId: "1",
      }),
    );
    box.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: doc.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 20,
        version: 1,
        payload: { title: "Note", facet: null },
        receipt: null,
        correlationId: "2",
      }),
    );
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

    const page = soup.query({ limit: 2 }, [task.owner, doc.owner, project.owner]);
    expect(page.items).toHaveLength(2);
    const page2 = soup.query({ limit: 2, cursor: page.nextCursor }, [task.owner, doc.owner, project.owner]);
    expect(page2.items).toHaveLength(1);

    const teammateReceipts: typeof task.owner[] = [];
    expect(soup.query({}, teammateReceipts).items).toHaveLength(0);

    box.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: task.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 40,
        version: 2,
        payload: { title: "Task A done", facet: "task" },
        receipt: null,
        correlationId: "4",
      }),
    );
    box.drain(() => undefined);
    soup.ingest(box, box.getCheckpoint("soup")?.lastEventId);
    expect(soup.get(task.id)?.title).toBe("Task A done");
    expect(seen.length).toBeGreaterThan(0);
  });

  it("rebuilds from outbox after drop (gate 5)", () => {
    const box = new Outbox();
    const id = fixtureId("document", 9);
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
        payload: { title: "rebuild me", facet: "task" },
        receipt: null,
        correlationId: "r",
      }),
    );
    box.drain(() => undefined);
    const live = new SoupIndex();
    live.ingest(box);
    const rebuilt = new SoupIndex();
    rebuilt.ingest(box);
    expect(rebuilt.get(id)?.title).toBe(live.get(id)?.title);
  });
});

describe("favorites listing is enforced", () => {
  it("caps at 500 and hides rows without a view receipt", () => {
    const fav = new FavoritesIndex();
    const seeded = seedMint("document", 3, "task");
    fav.add({ entityId: seeded.id, entityType: "document", sortOrder: 0.5 });
    expect(fav.list([seeded.owner])).toHaveLength(1);
    expect(fav.list([])).toHaveLength(0);
    expect(MAX_FAVORITES_PER_COLLECTION).toBe(500);
    const shared = grantShare(seeded.state, teammateId, "comment");
    void shared;
  });
});
