/**
 * OD-27: one D1 projection plane, two schema families, shared consumer.
 * Physical SQLite is the same DDL; N4 freeze is in-memory maps behind it.
 * N16 hardens search ranking; this node freezes topology + 7-type coverage.
 */

export const SCHEMA_FAMILIES = ["lists", "search"] as const;
export type SchemaFamilyName = (typeof SCHEMA_FAMILIES)[number];

/** ADR-007 coverage contract. email → email_thread; call_record → call. */
export const SEARCH_ENTITY_TYPES = [
  "document",
  "project",
  "chat",
  "channel",
  "email_thread",
  "call",
  "crm_company",
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export function isSearchEntityType(value: string): value is SearchEntityType {
  return (SEARCH_ENTITY_TYPES as readonly string[]).includes(value);
}

export const LIST_SCHEMA_DDL = `
CREATE TABLE entity_row (
  entity_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  version INTEGER NOT NULL,
  facet TEXT,
  project_id TEXT,
  body TEXT NOT NULL DEFAULT '',
  unread INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  tombstoned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX entity_row_updated ON entity_row (tenant_id, updated_at DESC, entity_id);
CREATE INDEX entity_row_type ON entity_row (tenant_id, entity_type, facet);

CREATE TABLE entity_property (
  entity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (entity_id, name)
);

CREATE TABLE user_decoration (
  actor_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  unread INTEGER NOT NULL DEFAULT 0,
  pin INTEGER NOT NULL DEFAULT 0,
  sort_order REAL,
  PRIMARY KEY (actor_id, entity_id)
);

-- Read-side cache of policy outcomes. Authority path never reads this (ADR-004).
CREATE TABLE entity_access_index (
  actor_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  level TEXT NOT NULL,
  PRIMARY KEY (actor_id, entity_id)
);
`.trim();

/**
 * Additive compatibility migrations for deployments that already applied the
 * N4 list schema above. Keep LIST_SCHEMA_DDL as the frozen v1 contract: new
 * list fields are introduced here so an existing D1 database is upgraded
 * without a destructive table rewrite.
 */
export const LIST_SCHEMA_MIGRATIONS = {
  version: 2,
  entityRowPrimaryKey: ["tenant_id", "entity_id"],
  accessPrimaryKey: ["tenant_id", "actor_id", "entity_id"],
  orphanAccessPolicy: "discard-and-rebuild-from-authority",
} as const;

export const SEARCH_SCHEMA_DDL = `
CREATE TABLE search_doc (
  entity_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL
);
CREATE VIRTUAL TABLE search_fts USING fts5(
  title,
  body,
  content='search_doc',
  content_rowid='rowid'
);
`.trim();

export interface SchemaFamilyContract {
  name: SchemaFamilyName;
  checkpoint: string;
  owner: string;
  ddl: string;
  tables: readonly string[];
}

export const SCHEMA_FAMILY_CONTRACTS: readonly SchemaFamilyContract[] = [
  {
    name: "lists",
    checkpoint: "soup.lists",
    owner: "soup-projector",
    ddl: LIST_SCHEMA_DDL,
    tables: ["entity_row", "entity_property", "user_decoration", "entity_access_index"],
  },
  {
    name: "search",
    checkpoint: "soup.search",
    owner: "soup-projector",
    ddl: SEARCH_SCHEMA_DDL,
    tables: ["search_doc", "search_fts"],
  },
];
