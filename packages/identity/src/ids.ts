/** ADR-003: opaque type-tagged TEXT ids. Payload is time-ordered hex, not parsed for meaning. */
export type EntityTypeTag = "user" | "team" | "invite" | "membership";

const PREFIX: Record<EntityTypeTag, string> = {
  user: "usr",
  team: "team",
  invite: "inv",
  membership: "mem",
};

export function typedId(type: EntityTypeTag, payload: string): string {
  if (!/^[0-9a-f]{32}$/i.test(payload)) {
    throw new Error(`id payload must be 32 hex chars, got ${payload}`);
  }
  return `${PREFIX[type]}_${payload.toLowerCase()}`;
}

export function parseTypedId(id: string): { type: EntityTypeTag; payload: string } {
  const match = /^(usr|team|inv|mem)_([0-9a-f]{32})$/.exec(id);
  if (!match) throw new Error(`malformed typed id: ${id}`);
  const prefix = match[1] as "usr" | "team" | "inv" | "mem";
  const type = (Object.keys(PREFIX) as EntityTypeTag[]).find((key) => PREFIX[key] === prefix);
  if (!type) throw new Error(`unknown id prefix: ${prefix}`);
  return { type, payload: match[2] };
}

let sequence = 0;
export function resetIdSequence(): void {
  sequence = 0;
}

export function nextId(type: EntityTypeTag): string {
  sequence += 1;
  return typedId(type, sequence.toString(16).padStart(32, "0"));
}

export function fixtureId(type: EntityTypeTag, n: number): string {
  return typedId(type, n.toString(16).padStart(32, "0"));
}
