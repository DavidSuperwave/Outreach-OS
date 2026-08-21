import type { EventEnvelope } from "control-plane";
import type { PropertyEntityType } from "registry";
import type { EntityPropertyRow, PropertyValue } from "./types.js";
import { KANBAN_NONE } from "./system.js";

/**
 * Materialized filter index (2a). Not EAV-in-DO-storage — cross-entity grouping
 * for kanban lanes and grid filters. Rebuildable from the properties outbox.
 */
export class PropertyValueIndex {
  #rows = new Map<string, EntityPropertyRow>();
  #byOption = new Map<string, Set<string>>();

  clear(): void {
    this.#rows.clear();
    this.#byOption.clear();
  }

  key(entityId: string, definitionId: string): string {
    return `${entityId}:${definitionId}`;
  }

  put(row: EntityPropertyRow): void {
    const prev = this.#rows.get(this.key(row.entityId, row.definitionId));
    if (prev) this.#unindex(prev);
    this.#rows.set(this.key(row.entityId, row.definitionId), row);
    this.#index(row);
  }

  get(entityId: string, definitionId: string): EntityPropertyRow | undefined {
    return this.#rows.get(this.key(entityId, definitionId));
  }

  forEntity(entityId: string): Record<string, PropertyValue | null> {
    const values: Record<string, PropertyValue | null> = {};
    for (const row of this.#rows.values()) {
      if (row.entityId === entityId) values[row.definitionId] = row.values;
    }
    return values;
  }

  entityIdsForOption(definitionId: string, optionId: string): string[] {
    return [...(this.#byOption.get(`${definitionId}:${optionId}`) ?? [])];
  }

  apply(envelope: EventEnvelope): EntityPropertyRow | null {
    if (envelope.topic !== "properties") return null;
    const definitionId = envelope.payload.definitionId;
    const values = envelope.payload.values;
    const storageType = envelope.payload.storageType;
    if (typeof definitionId !== "string" || !values || typeof storageType !== "string") return null;
    const row: EntityPropertyRow = {
      entityId: envelope.entityId,
      storageType: storageType as PropertyEntityType,
      definitionId,
      values: values as PropertyValue,
      version: envelope.version,
    };
    this.put(row);
    return row;
  }

  snapshot(): EntityPropertyRow[] {
    return [...this.#rows.values()];
  }

  #index(row: EntityPropertyRow): void {
    for (const optionId of optionIdsOf(row.values)) {
      const key = `${row.definitionId}:${optionId}`;
      const bucket = this.#byOption.get(key) ?? new Set();
      bucket.add(row.entityId);
      this.#byOption.set(key, bucket);
    }
  }

  #unindex(row: EntityPropertyRow): void {
    for (const optionId of optionIdsOf(row.values)) {
      this.#byOption.get(`${row.definitionId}:${optionId}`)?.delete(row.entityId);
    }
  }
}

export function optionIdsOf(value: PropertyValue | null | undefined): string[] {
  if (!value) return [KANBAN_NONE];
  if (value.kind === "select") return [value.optionId ?? KANBAN_NONE];
  if (value.kind === "multi_select") return value.optionIds.length > 0 ? [...value.optionIds] : [KANBAN_NONE];
  return [KANBAN_NONE];
}

export function selectOptionId(value: PropertyValue | null | undefined): string {
  if (!value) return KANBAN_NONE;
  if (value.kind === "select") return value.optionId ?? KANBAN_NONE;
  return KANBAN_NONE;
}
