import { ENTITY_PREFIX, typeFromPrefix, type EntityType } from "./entity-types.js";

/** ADR-003: opaque type-tagged TEXT ids. Payload is 32 hex chars, not parsed for meaning. */
export function typedId(type: EntityType, payload: string): string {
  if (!/^[0-9a-f]{32}$/i.test(payload)) {
    throw new Error(`id payload must be 32 hex chars, got ${payload}`);
  }
  return `${ENTITY_PREFIX[type]}_${payload.toLowerCase()}`;
}

export function parseTypedId(id: string): { type: EntityType; payload: string } {
  const match = /^([a-z]+)_([0-9a-f]{32})$/.exec(id);
  if (!match) throw new Error(`malformed typed id: ${id}`);
  const type = typeFromPrefix(match[1]);
  if (!type) throw new Error(`unknown id prefix: ${match[1]}`);
  return { type, payload: match[2] };
}

let sequence = 0;
export function resetIdSequence(): void {
  sequence = 0;
}

export function nextId(type: EntityType): string {
  sequence += 1;
  return typedId(type, sequence.toString(16).padStart(32, "0"));
}

export function fixtureId(type: EntityType, n: number): string {
  return typedId(type, n.toString(16).padStart(32, "0"));
}
