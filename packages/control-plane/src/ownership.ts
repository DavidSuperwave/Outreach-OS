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
  {
    name: "file_blob",
    kind: "r2",
    owner: "files.MemoryBlobStore",
    rebuildSource: "in-memory R2 stand-in (N14); live R2 object keys later",
    checkpoint: "files.blobs",
  },
  {
    name: "file_metadata",
    kind: "d1",
    owner: "files.FilesSlice",
    rebuildSource: "D1-shaped metadata reconstructed from ADR-010 (OD-1 Branch A; no DynamoDB)",
    checkpoint: "files.metadata",
  },
  {
    name: "email_thread",
    kind: "d1",
    owner: "mailbox.MailboxSlice",
    rebuildSource: "account DO consumers write thread/message D1 (N11)",
    checkpoint: "email.outbox",
  },
  {
    name: "mailbox_sync_checkpoint",
    kind: "do",
    owner: "mailbox.MailboxSlice",
    rebuildSource: "Gmail history id cursor per connected account (N11)",
    checkpoint: "mailbox.sync",
  },
  {
    name: "calendar_index",
    kind: "d1",
    owner: "calendar-projector",
    rebuildSource: "calendar outbox replay (date-range + Soup)",
    checkpoint: "calendar.index",
  },
  {
    name: "calls_index",
    kind: "d1",
    owner: "calendar-projector",
    rebuildSource: "calls outbox replay (Soup + search feed)",
    checkpoint: "calls.index",
  },
  {
    name: "call_lifecycle",
    kind: "do",
    owner: "calendar.CalendarSlice",
    rebuildSource: "per-call in-process lifecycle (join/leave/finalize) (N13)",
    checkpoint: "calls.outbox",
  },
  {
    name: "transcript_sidecar",
    kind: "do",
    owner: "calendar.TranscriptSidecar",
    rebuildSource: "in-memory transcription sidecar (N13); R2 blobs later",
    checkpoint: "transcripts.ingest",
  },
  {
    name: "crm_company",
    kind: "do",
    owner: "crm.CrmSlice",
    rebuildSource: "per-team CRM DO snapshot (domain-keyed companies)",
    checkpoint: "crm.outbox",
  },
  {
    name: "crm_contact",
    kind: "d1",
    owner: "crm-projector",
    rebuildSource: "crm outbox replay (company-linked contacts)",
    checkpoint: "crm.contacts",
  },
];

export function ownerOf(name: string): StorageOwner {
  const row = STORAGE_OWNERS.find((item) => item.name === name);
  if (!row) throw new Error(`unowned storage: ${name}`);
  return row;
}
