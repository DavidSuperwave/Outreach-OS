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
  {
    name: "soup_list_index",
    kind: "d1",
    owner: "soup-projector",
    rebuildSource: "domain outbox replay (lists schema family)",
    checkpoint: "soup.lists",
  },
  {
    name: "soup_search_index",
    kind: "d1",
    owner: "soup-projector",
    rebuildSource: "domain outbox replay (search schema family)",
    checkpoint: "soup.search",
  },
  {
    name: "webhook_endpoint",
    kind: "do",
    owner: "connectivity.WebhookEndpoint",
    rebuildSource: "per-webhook DO drain + delivery log",
    checkpoint: "webhooks.outbox",
  },
  {
    name: "team_connections",
    kind: "do",
    owner: "connectivity.TeamConnectionStore",
    rebuildSource: "Team DO custody snapshot (OD-29 recommendation)",
    checkpoint: "connectors.outbox",
  },
  {
    name: "user_memory",
    kind: "do",
    owner: "connectivity.MemoryStore",
    rebuildSource: "User DO on-activity refresh (OD-28)",
    checkpoint: "memory.alarm",
  },
  {
    name: "document_authority",
    kind: "do",
    owner: "documents.DocumentsSlice",
    rebuildSource: "per-document in-process map + immutable versions (N7)",
    checkpoint: "documents.outbox",
  },
  {
    name: "folder_edges",
    kind: "d1",
    owner: "documents-projector",
    rebuildSource: "documents and projects outbox replay",
    checkpoint: "documents.folders",
  },
  {
    name: "property_schema",
    kind: "do",
    owner: "task-properties.TaskProperties",
    rebuildSource: "team PropertySchema snapshot (definitions/options/tags)",
    checkpoint: "properties.schema",
  },
  {
    name: "entity_property_index",
    kind: "d1",
    owner: "task-properties-projector",
    rebuildSource: "entity outbox replay (property values)",
    checkpoint: "properties.index",
  },
  {
    name: "channel_message_log",
    kind: "do",
    owner: "channels.ChannelsSlice",
    rebuildSource: "per-channel in-process append log (N9)",
    checkpoint: "channels.outbox",
  },
  {
    name: "channel_members",
    kind: "d1",
    owner: "channels-projector",
    rebuildSource: "channels outbox replay (membership)",
    checkpoint: "channels.members",
  },
  {
    name: "channel_presence",
    kind: "do",
    owner: "channels.PresenceStore",
    rebuildSource: "PresenceSubscriber init/add/remove (replaces /track)",
    checkpoint: "channels.presence",
  },
];

export function ownerOf(name: string): StorageOwner {
  const row = STORAGE_OWNERS.find((item) => item.name === name);
  if (!row) throw new Error(`unowned storage: ${name}`);
  return row;
}
