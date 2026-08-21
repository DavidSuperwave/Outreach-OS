import { describe, expect, it } from "vitest";
import {
  DOCUMENT_FACETS,
  ENTITY_TYPES,
  PROPERTY_ENTITY_TYPE,
  PROPERTY_TYPE_MAP,
  accessEntityType,
} from "./entity-types.js";
import { EntityRegistry, RegistryError } from "./registry.js";
import { fixtureId, parseTypedId, resetIdSequence } from "./ids.js";

describe("OD-7 entity ontology", () => {
  it("freezes exactly 16 EntityType variants and excludes task/thread", () => {
    expect(ENTITY_TYPES).toHaveLength(16);
    expect(ENTITY_TYPES).not.toContain("task");
    expect(ENTITY_TYPES).not.toContain("thread");
    expect(ENTITY_TYPES).toContain("document");
    expect(ENTITY_TYPES).toContain("email_thread");
    expect(DOCUMENT_FACETS).toEqual(["task", "snippet", "skill"]);
  });

  it("maps every property_entity_type value to a canonical type or document facet", () => {
    expect(PROPERTY_ENTITY_TYPE).toHaveLength(10);
    expect(PROPERTY_TYPE_MAP.TASK).toEqual({ kind: "facet", type: "document", facet: "task" });
    expect(PROPERTY_TYPE_MAP.THREAD).toEqual({ kind: "entity", type: "email_thread" });
    expect(PROPERTY_TYPE_MAP.COMPANY).toEqual({ kind: "entity", type: "crm_company" });
    expect(PROPERTY_TYPE_MAP.CALL_RECORD).toEqual({ kind: "entity", type: "call" });
    for (const key of PROPERTY_ENTITY_TYPE) {
      expect(PROPERTY_TYPE_MAP[key]).toBeDefined();
    }
  });

  it("mints task access as document", () => {
    expect(accessEntityType("document", "task")).toBe("document");
  });
});

describe("entity registry", () => {
  it("registers, resolves, and tombstones; tombstoned resolve fails closed", () => {
    resetIdSequence();
    const registry = new EntityRegistry();
    const id = fixtureId("document", 1);
    registry.register({
      type: "document",
      id,
      tenantId: fixtureId("team", 1),
      createdAt: 1,
      facet: "task",
    });
    expect(registry.resolve(id, "document").facet).toBe("task");
    registry.tombstone(id, 2);
    expect(() => registry.resolve(id)).toThrow(RegistryError);
    expect(registry.get(id)?.tombstonedAt).toBe(2);
  });

  it("rejects type/id mismatch and cross-tenant reads", () => {
    const registry = new EntityRegistry();
    const doc = fixtureId("document", 2);
    const team = fixtureId("team", 9);
    registry.register({ type: "document", id: doc, tenantId: team, createdAt: 1, facet: null });
    expect(parseTypedId(doc).type).toBe("document");
    expect(() => registry.resolve(doc, "user")).toThrow(/expected user/);
    expect(() => registry.inTenant(doc, fixtureId("team", 8))).toThrow(/not in tenant/);
  });
});
