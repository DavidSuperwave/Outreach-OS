/**
 * Canonical EntityType vocabulary — 16 variants from model-entity @ 9f7a26b (ADR-003 / OD-7).
 * Task is a document facet, not a type. Thread is EmailThread.
 */
export const ENTITY_TYPES = [
  "user",
  "chat",
  "channel",
  "channel_message",
  "document",
  "project",
  "email_thread",
  "calendar_event",
  "team",
  "call",
  "foreign_entity",
  "static_file",
  "crm_company",
  "crm_contact",
  "reminder",
  "skill",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_PREFIX: Record<EntityType, string> = {
  user: "usr",
  chat: "chat",
  channel: "chn",
  channel_message: "msg",
  document: "doc",
  project: "proj",
  email_thread: "eth",
  calendar_event: "cal",
  team: "team",
  call: "call",
  foreign_entity: "fgn",
  static_file: "file",
  crm_company: "co",
  crm_contact: "ctc",
  reminder: "rmd",
  skill: "skl",
};

const PREFIX_TO_TYPE = Object.fromEntries(
  (Object.entries(ENTITY_PREFIX) as [EntityType, string][]).map(([type, prefix]) => [prefix, type]),
) as Record<string, EntityType>;

/** Document facets. Task is not an EntityType (OD-7). */
export const DOCUMENT_FACETS = ["task", "snippet", "skill"] as const;
export type DocumentFacet = (typeof DOCUMENT_FACETS)[number];

/**
 * property_entity_type (10 values) → canonical EntityType or document facet.
 * TASK is a facet; THREAD aliases EmailThread; COMPANY → crm_company; CALL_RECORD → call.
 */
export const PROPERTY_ENTITY_TYPE = [
  "CHANNEL",
  "CHAT",
  "DOCUMENT",
  "PROJECT",
  "THREAD",
  "USER",
  "TASK",
  "COMPANY",
  "CALL_RECORD",
  "CALENDAR_EVENT",
] as const;

export type PropertyEntityType = (typeof PROPERTY_ENTITY_TYPE)[number];

export type PropertyTypeMapping =
  | { kind: "entity"; type: EntityType }
  | { kind: "facet"; type: "document"; facet: DocumentFacet };

export const PROPERTY_TYPE_MAP: Record<PropertyEntityType, PropertyTypeMapping> = {
  CHANNEL: { kind: "entity", type: "channel" },
  CHAT: { kind: "entity", type: "chat" },
  DOCUMENT: { kind: "entity", type: "document" },
  PROJECT: { kind: "entity", type: "project" },
  THREAD: { kind: "entity", type: "email_thread" },
  USER: { kind: "entity", type: "user" },
  TASK: { kind: "facet", type: "document", facet: "task" },
  COMPANY: { kind: "entity", type: "crm_company" },
  CALL_RECORD: { kind: "entity", type: "call" },
  CALENDAR_EVENT: { kind: "entity", type: "calendar_event" },
};

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export function typeFromPrefix(prefix: string): EntityType | null {
  return PREFIX_TO_TYPE[prefix] ?? null;
}

/** Access receipts for tasks are minted as Document (OD-7). */
export function accessEntityType(type: EntityType, facet?: DocumentFacet | null): EntityType {
  if (type === "document" && facet === "task") return "document";
  return type;
}
