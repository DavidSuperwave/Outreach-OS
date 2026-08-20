import type { Receipt } from "authz";
import { filterVisible, readTag } from "authz";
import type { EventEnvelope } from "control-plane";
import type { EntityType } from "registry";
import type { ProjectionFamily } from "./consumer.js";
import { isSearchEntityType, type SearchEntityType } from "./schemas.js";

export interface SearchHit {
  entityType: SearchEntityType;
  entityId: string;
  tenantId: string;
  title: string;
  snippet: string;
  score: number;
  updatedAt: number;
}

export interface SearchQuery {
  q: string;
  types?: readonly SearchEntityType[];
  limit?: number;
}

interface SearchDoc {
  entityType: SearchEntityType;
  entityId: string;
  tenantId: string;
  title: string;
  body: string;
  updatedAt: number;
  version: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 0);
}

/**
 * Search schema family (ADR-007 coverage freeze). Ranking is lexical token
 * overlap — N16 owns golden-query ranking. Results are receipt-filtered
 * before enrichment (titles of revoked rows never leak).
 */
export class SearchIndex implements ProjectionFamily {
  readonly family = "search" as const;
  readonly checkpoint = "soup.search";
  readonly surface = "search.results" as const;
  #docs = new Map<string, SearchDoc>();

  constructor() {
    readTag(this.surface);
  }

  apply(envelope: EventEnvelope): SearchDoc | null {
    if (!isSearchEntityType(envelope.entityType)) return null;
    const existing = this.#docs.get(envelope.entityId);
    if (existing && existing.version > envelope.version) return existing;
    if (envelope.payload.tombstoned === true) {
      this.#docs.delete(envelope.entityId);
      return existing ? { ...existing, version: envelope.version } : null;
    }
    const title = typeof envelope.payload.title === "string" ? envelope.payload.title : (existing?.title ?? "");
    const body =
      (typeof envelope.payload.body === "string" ? envelope.payload.body : undefined) ??
      (typeof envelope.payload.text === "string" ? envelope.payload.text : undefined) ??
      existing?.body ??
      "";
    const doc: SearchDoc = {
      entityType: envelope.entityType,
      entityId: envelope.entityId,
      tenantId: envelope.tenantId,
      title,
      body,
      updatedAt: envelope.occurredAt,
      version: envelope.version,
    };
    this.#docs.set(envelope.entityId, doc);
    return doc;
  }

  query(query: SearchQuery, receipts: readonly Receipt[]): SearchHit[] {
    const terms = tokenize(query.q);
    if (terms.length === 0) return [];
    const limit = query.limit ?? 20;
    const hits: SearchHit[] = [];
    for (const doc of this.#docs.values()) {
      if (query.types && !query.types.includes(doc.entityType)) continue;
      const haystack = tokenize(`${doc.title} ${doc.body}`);
      let score = 0;
      for (const term of terms) {
        score += haystack.filter((token) => token === term).length;
      }
      if (score === 0) continue;
      hits.push({
        entityType: doc.entityType,
        entityId: doc.entityId,
        tenantId: doc.tenantId,
        title: doc.title,
        snippet: doc.body.slice(0, 160),
        score,
        updatedAt: doc.updatedAt,
      });
    }
    hits.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt || a.entityId.localeCompare(b.entityId));
    const visible = filterVisible(
      hits.map((hit) => ({ entityId: hit.entityId, entityType: hit.entityType as EntityType })),
      receipts,
    );
    const allowed = new Set(visible.map((row) => row.entityId));
    return hits.filter((hit) => allowed.has(hit.entityId)).slice(0, limit);
  }

  get(entityId: string): SearchDoc | undefined {
    return this.#docs.get(entityId);
  }

  size(): number {
    return this.#docs.size;
  }
}
