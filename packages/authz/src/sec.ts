import { EntityRegistry, fixtureId, type EntityType } from "registry";
import { userPrincipal, type ActorContext } from "identity/principal";
import { emptyAccess, grantShare, revokeShare, type AccessState } from "./access-state.js";
import { PolicyEngine } from "./engine.js";
import { AuthzError } from "./receipt.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);
const outsiderId = fixtureId("user", 3);
const otherTenant = fixtureId("team", 2);

function actor(userId: string, tenantId: string | null = tenant): ActorContext {
  return {
    actor: userPrincipal(userId, tenantId),
    kernelUsername: userId === ownerId ? "admin" : userId === teammateId ? "member" : "outsider",
    isDeploymentAdmin: userId === ownerId,
  };
}

export function seedEntity(
  type: EntityType,
  facet: "task" | null = null,
): {
  engine: PolicyEngine;
  registry: EntityRegistry;
  id: string;
  state: AccessState;
} {
  const registry = new EntityRegistry();
  const id = fixtureId(type, 1);
  registry.register({
    type,
    id,
    tenantId: tenant,
    createdAt: 1,
    facet: type === "document" ? facet : null,
  });
  return {
    engine: new PolicyEngine(registry),
    registry,
    id,
    state: emptyAccess(ownerId, tenant),
  };
}

export function seedDocument(facet: "task" | null = "task") {
  const seeded = seedEntity("document", facet);
  return { ...seeded, docId: seeded.id };
}

/**
 * SEC-1/2/3 are ruled fixed-not-recreated (Q20). Concrete Linear SUP-474 text is
 * not in this repo; these fixtures encode the harvested denial semantics:
 * SEC-1 revoked grant cannot be used (including stale list/favorites paths).
 * SEC-2 share cannot escalate past the granted level.
 * SEC-3 guessed ids / cross-tenant ids deny.
 */
export function secFixtures() {
  return { tenant, ownerId, teammateId, outsiderId, otherTenant, actor, seedDocument };
}

export function assertSec1RevokeDenies(): void {
  const { engine, docId, state } = seedDocument();
  const shared = grantShare(state, teammateId, "comment");
  engine.mint({ actor: actor(teammateId), entityType: "document", entityId: docId, need: "comment", state: shared });
  const revoked = revokeShare(shared, teammateId);
  try {
    engine.mint({ actor: actor(teammateId), entityType: "document", entityId: docId, need: "view", state: revoked });
    throw new Error("SEC-1: revoked grant was still accepted");
  } catch (error) {
    if (!(error instanceof AuthzError) || error.code !== "denied") throw error;
  }
}

export function assertSec2NoEscalate(): void {
  const { engine, docId, state } = seedDocument();
  const shared = grantShare(state, teammateId, "comment");
  try {
    engine.mint({ actor: actor(teammateId), entityType: "document", entityId: docId, need: "edit", state: shared });
    throw new Error("SEC-2: comment grant escalated to edit");
  } catch (error) {
    if (!(error instanceof AuthzError) || error.code !== "denied") throw error;
  }
}

export function assertSec3CrossTenantDenies(): void {
  const { engine, docId, state } = seedDocument();
  try {
    engine.mint({
      actor: actor(outsiderId, otherTenant),
      entityType: "document",
      entityId: docId,
      need: "view",
      state,
    });
    throw new Error("SEC-3: cross-tenant view was accepted");
  } catch (error) {
    if (!(error instanceof AuthzError)) throw error;
    if (error.code !== "cross_tenant" && error.code !== "denied") throw error;
  }
}

export type MatrixRow = {
  name: string;
  actorId: string;
  need: "view" | "comment" | "edit" | "owner";
  entityType: EntityType;
  setup: (state: AccessState) => AccessState;
  expect: "allow" | "deny";
};
