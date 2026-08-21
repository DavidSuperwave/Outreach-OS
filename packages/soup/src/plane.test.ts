import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { userPrincipal } from "identity/principal";
import { EntityRegistry } from "registry";
import { PolicyEngine, emptyAccess } from "authz";
import { Outbox, envelope, ownerOf } from "control-plane";
import { ProjectionPlane } from "./plane.js";
import { SCHEMA_FAMILIES, SCHEMA_FAMILY_CONTRACTS, SEARCH_ENTITY_TYPES, isSearchEntityType } from "./schemas.js";
import { SOUP_ITEM_TYPES } from "./item.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);

function actor(id: string) {
  return { actor: userPrincipal(id, tenant), kernelUsername: "u", isDeploymentAdmin: false };
}

function mintView(type: "document" | "project" | "chat" | "calendar_event", n: number, facet: "task" | null = null) {
  const registry = new EntityRegistry();
  const id = fixtureId(type, n);
  registry.register({ type, id, tenantId: tenant, createdAt: 1, facet });
  const engine = new PolicyEngine(registry);
  const owner = engine.mint({
    actor: actor(ownerId),
    entityType: type,
    entityId: id,
    need: "view",
    state: emptyAccess(ownerId, tenant),
  });
  return { id, owner };
}

describe("OD-27 one plane, two schema families, shared consumer", () => {
  it("freezes lists and search families with distinct tables and one owner", () => {
    expect(SCHEMA_FAMILIES).toEqual(["lists", "search"]);
    expect(SCHEMA_FAMILY_CONTRACTS).toHaveLength(2);
    expect(new Set(SCHEMA_FAMILY_CONTRACTS.map((row) => row.owner))).toEqual(new Set(["soup-projector"]));
    expect(SCHEMA_FAMILY_CONTRACTS[0]?.ddl).toMatch(/CREATE TABLE entity_row/);
    expect(SCHEMA_FAMILY_CONTRACTS[1]?.ddl).toMatch(/CREATE VIRTUAL TABLE search_fts/);
    expect(ownerOf("soup_list_index").checkpoint).toBe("soup.lists");
    expect(ownerOf("soup_search_index").checkpoint).toBe("soup.search");
  });

  it("feeds both families from one outbox; search coverage is the 7-type contract", () => {
    expect(SEARCH_ENTITY_TYPES).toHaveLength(7);
    expect(SEARCH_ENTITY_TYPES).not.toContain("task");
    expect(isSearchEntityType("calendar_event")).toBe(false);
    expect(SOUP_ITEM_TYPES).toContain("calendar_event");

    const plane = new ProjectionPlane();
    const box = new Outbox();
    const task = mintView("document", 50, "task");
    const chat = mintView("chat", 50);
    const cal = mintView("calendar_event", 50);

    box.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: task.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 3,
        version: 1,
        payload: { title: "Ship the slice", facet: "task", body: "vertical slice hard gate" },
        receipt: null,
        correlationId: "p1",
      }),
    );
    box.append(
      envelope({
        topic: "chats",
        entityType: "chat",
        entityId: chat.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 2,
        version: 1,
        payload: { title: "Standup", body: "slice status" },
        receipt: null,
        correlationId: "p2",
      }),
    );
    box.append(
      envelope({
        topic: "calls",
        entityType: "calendar_event",
        entityId: cal.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 1,
        version: 1,
        payload: { title: "Planning", body: "slice kickoff" },
        receipt: null,
        correlationId: "p3",
      }),
    );
    box.drain(() => undefined);
    expect(plane.ingest(box)).toBe(6);

    const receipts = [task.owner, chat.owner, cal.owner];
    const list = plane.lists.query({}, receipts);
    expect(list.items.map((item) => item.title)).toEqual(["Ship the slice", "Standup", "Planning"]);

    const hits = plane.search.query({ q: "slice" }, receipts);
    expect(hits.map((hit) => hit.entityId).sort()).toEqual([task.id, chat.id].sort());
    expect(hits.every((hit) => hit.entityId !== cal.id)).toBe(true);
    expect(plane.search.get(cal.id)).toBeUndefined();

    expect(plane.search.query({ q: "slice" }, []).length).toBe(0);

    box.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: task.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 4,
        version: 2,
        payload: { title: "Ship the slice", facet: "task", tombstoned: true },
        receipt: null,
        correlationId: "p4",
      }),
    );
    box.drain(() => undefined);
    plane.ingest(box);
    expect(plane.lists.get(task.id)).toBeUndefined();
    expect(plane.search.get(task.id)).toBeUndefined();
    expect(plane.search.query({ q: "slice" }, receipts).map((hit) => hit.entityId)).toEqual([chat.id]);
  });

  it("rebuilds both families identically from the same outbox (gate 5)", () => {
    const box = new Outbox();
    const doc = mintView("document", 77, "task");
    box.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: doc.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 1,
        version: 1,
        payload: { title: "same", facet: "task", body: "rebuild" },
        receipt: null,
        correlationId: "rb",
      }),
    );
    box.drain(() => undefined);
    const a = new ProjectionPlane();
    const b = new ProjectionPlane();
    a.rebuild(box);
    b.rebuild(box);
    expect(a.lists.get(doc.id)).toEqual(b.lists.get(doc.id));
    expect(a.search.get(doc.id)).toEqual(b.search.get(doc.id));
  });
});
