/**
 * ADR-007 / N4 coverage freeze. email → email_thread; call_record → call.
 * Duplicated here so `search/browser` does not import soup's node graph.
 */
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

/** Enriched hit. Title/snippet come from the lists family after ids. */
export interface SearchResult {
  entityType: SearchEntityType;
  entityId: string;
  tenantId: string;
  title: string;
  snippet: string;
  score: number;
  updatedAt: number;
}

export interface IndexFailure {
  entityId: string;
  entityType: string;
  version: number;
  reason: "index_failed";
}

/**
 * OD-15 prototype ranking: title token matches × TITLE_BOOST + body token
 * matches. Owner sign-off on the ranking/freshness tolerance band is still
 * open; this freeze is the golden-query prototype, not the elected substrate.
 */
export const TITLE_BOOST = 3;

export const SNIPPET_CHARS = 160;

/** Bodies at or above this length are pathological and skipped. */
export const MAX_INDEX_BODY_CHARS = 512_000;

/** Vectorize semantic add-on is not pass-1 (ADR-007). */
export const VECTORIZE = {
  status: "deferred",
  note: "Optional semantic add-on behind the same projector; not required by the harvested surface.",
} as const;

/** Live D1 FTS5 is the N4 DDL freeze; this node wraps in-memory SearchIndex. */
export const LIVE_D1_FTS5 = {
  status: "deferred",
  ddlOwner: "soup-projector",
  note: "SEARCH_SCHEMA_DDL (search_doc + search_fts) stays on the soup projector. N16 does not fork FTS tables.",
} as const;
