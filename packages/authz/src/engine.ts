import { EntityRegistry, RegistryError, accessEntityType, type EntityType } from "registry";
import type { ActorContext, Principal } from "identity/principal";
import { levelSatisfies, type AccessLevel } from "./levels.js";
import { AuthzError, mintReceipt, type Receipt } from "./receipt.js";
import { POLICIES } from "./policies.js";
import type { AccessState } from "./access-state.js";
import { AccessStore } from "./access-store.js";

export interface MintRequest<T extends EntityType = EntityType> {
  actor: ActorContext;
  entityType: T;
  entityId: string;
  need: AccessLevel;
  /** Owning-DO snapshot. If omitted, PolicyEngine reads AccessStore (the DO stand-in). */
  state?: AccessState;
}

function subjectOf(actor: ActorContext): Principal {
  return actor.onBehalfOf ?? actor.actor;
}

/**
 * Sole mint path for receipts (ADR-004). Resolves registry first (fail closed on
 * tombstone / wrong tenant), then per-type policy code against owning-DO state.
 * Agent `onBehalfOf` mints for the delegating principal.
 */
export class PolicyEngine {
  constructor(
    readonly registry: EntityRegistry,
    readonly store: AccessStore = new AccessStore(),
  ) {}

  mint<L extends AccessLevel, T extends EntityType>(request: MintRequest<T> & { need: L }): Receipt<L, T> {
    const { actor, entityId, need } = request;
    const subject = subjectOf(actor);
    const accessType = accessEntityType(request.entityType, this.registry.get(entityId)?.facet);
    const state = request.state ?? this.store.require(entityId);
    let record;
    try {
      record = this.registry.inTenant(entityId, state.tenantId);
    } catch (error) {
      if (error instanceof RegistryError && error.code === "tombstoned") {
        throw new AuthzError("tombstoned", error.message);
      }
      if (error instanceof RegistryError && error.code === "unknown_tenant") {
        throw new AuthzError("cross_tenant", error.message);
      }
      throw new AuthzError("unregistered", error instanceof Error ? error.message : "unregistered");
    }
    if (record.type !== accessType && !(record.type === request.entityType)) {
      throw new AuthzError("denied", "registry type mismatch");
    }
    if (record.tenantId !== subject.tenantId && subject.tenantId !== null) {
      throw new AuthzError("cross_tenant", "actor tenant does not match entity tenant");
    }
    const have = POLICIES[accessType](state, subject.id, { store: this.store, actor: subject });
    if (!have || !levelSatisfies(have, need)) {
      throw new AuthzError("denied", `${subject.id} lacks ${need} on ${entityId}`);
    }
    return mintReceipt({
      level: have as L,
      entityType: accessType as T,
      entityId,
      actorId: subject.id,
      tenantId: record.tenantId,
    });
  }
}

/** Domain handlers accept a receipt; they never take a raw id for authorization. */
export function requireReceipt<T extends EntityType>(
  receipt: Receipt<AccessLevel, T>,
  need: AccessLevel,
  entityId: string,
): void {
  if (receipt.entityId !== entityId) throw new AuthzError("forged", "receipt entity mismatch");
  if (!levelSatisfies(receipt.level, need)) {
    throw new AuthzError("denied", `receipt ${receipt.level} does not satisfy ${need}`);
  }
}
