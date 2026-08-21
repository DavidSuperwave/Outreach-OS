import { parseTypedId } from "./ids.js";
import type { DocumentFacet, EntityType } from "./entity-types.js";

export class RegistryError extends Error {
  constructor(
    readonly code: "not_found" | "tombstoned" | "type_mismatch" | "already_exists" | "unknown_tenant",
    message: string,
  ) {
    super(message);
    this.name = "RegistryError";
  }
}

export interface RegistryRecord {
  type: EntityType;
  id: string;
  tenantId: string;
  createdAt: number;
  tombstonedAt: number | null;
  facet: DocumentFacet | null;
}

/**
 * Existence / tombstone / tenant authority (ADR-003). Not an ACL store.
 * D1 physical table rides N3; this is the in-process contract freeze.
 */
export class EntityRegistry {
  #rows = new Map<string, RegistryRecord>();

  register(record: Omit<RegistryRecord, "tombstonedAt"> & { tombstonedAt?: number | null }): RegistryRecord {
    const parsed = parseTypedId(record.id);
    if (parsed.type !== record.type) {
      throw new RegistryError("type_mismatch", `id ${record.id} is not a ${record.type} id`);
    }
    if (this.#rows.has(record.id)) {
      throw new RegistryError("already_exists", `entity already registered: ${record.id}`);
    }
    const stored: RegistryRecord = {
      ...record,
      tombstonedAt: record.tombstonedAt ?? null,
    };
    this.#rows.set(record.id, stored);
    return stored;
  }

  resolve(id: string, expectedType?: EntityType): RegistryRecord {
    const row = this.#rows.get(id);
    if (!row) throw new RegistryError("not_found", `entity not registered: ${id}`);
    if (row.tombstonedAt !== null) {
      throw new RegistryError("tombstoned", `entity is tombstoned: ${id}`);
    }
    if (expectedType && row.type !== expectedType) {
      throw new RegistryError("type_mismatch", `expected ${expectedType}, got ${row.type}`);
    }
    return row;
  }

  get(id: string): RegistryRecord | null {
    return this.#rows.get(id) ?? null;
  }

  tombstone(id: string, at = Date.now()): RegistryRecord {
    const row = this.resolve(id);
    const next = { ...row, tombstonedAt: at };
    this.#rows.set(id, next);
    return next;
  }

  inTenant(id: string, tenantId: string): RegistryRecord {
    const row = this.resolve(id);
    if (row.tenantId !== tenantId) {
      throw new RegistryError("unknown_tenant", `entity ${id} is not in tenant ${tenantId}`);
    }
    return row;
  }

  snapshot(): RegistryRecord[] {
    return [...this.#rows.values()].map((row) => ({ ...row }));
  }

  restore(rows: readonly RegistryRecord[]): void {
    this.#rows.clear();
    for (const row of rows) this.#rows.set(row.id, { ...row });
  }
}
