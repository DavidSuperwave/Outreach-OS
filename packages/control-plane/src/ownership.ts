export type StorageKind = "do" | "d1" | "r2" | "kv" | "queue";

export interface StorageOwner {
  name: string;
  kind: StorageKind;
  owner: string;
  rebuildSource: string;
  checkpoint: string;
}

/** Living ownership manifest (ADR-005). N3 freezes the shape; domains fill rows. */
export const STORAGE_OWNERS: StorageOwner[] = [
  {
    name: "entity_registry",
    kind: "d1",
    owner: "registry",
    rebuildSource: "domain create/delete outbox",
    checkpoint: "registry.outbox",
  },
  {
    name: "entity_access_index",
    kind: "d1",
    owner: "authz-projector",
    rebuildSource: "share-change events",
    checkpoint: "authz.outbox",
  },
  {
    name: "team_authority",
    kind: "do",
    owner: "identity.TeamDurableObject",
    rebuildSource: "Team DO snapshot",
    checkpoint: "team.outbox",
  },
];

export function ownerOf(name: string): StorageOwner {
  const row = STORAGE_OWNERS.find((item) => item.name === name);
  if (!row) throw new Error(`unowned storage: ${name}`);
  return row;
}
