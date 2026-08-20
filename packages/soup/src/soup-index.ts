import type { Receipt } from "authz";
import { filterVisible, readTag } from "authz";
import type { EventEnvelope } from "control-plane";
import { Outbox } from "control-plane";
import type { DocumentFacet } from "registry";
import { soupItemType, type SoupItem, type SoupItemType } from "./item.js";

export interface SoupQuery {
  types?: SoupItemType[];
  facet?: DocumentFacet | null;
  cursor?: string | null;
  limit?: number;
}

export interface SoupPage {
  items: SoupItem[];
  nextCursor: string | null;
}

export type SoupListener = (item: SoupItem) => void;

/**
 * In-process Soup projection (ADR-006 freeze). Physical D1 is the same contract
 * with SQLite behind it. Authority path never reads this; list filtering is enforced.
 */
export class SoupIndex {
  #rows = new Map<string, SoupItem>();
  #listeners = new Set<SoupListener>();
  readonly surface = "soup.list" as const;

  constructor() {
    readTag(this.surface);
  }

  apply(envelope: EventEnvelope): SoupItem | null {
    const type = soupItemType(envelope.entityType);
    if (!type) return null;
    const existing = this.#rows.get(envelope.entityId);
    if (existing && existing.version > envelope.version) return existing;
    const tombstoned = envelope.payload.tombstoned === true;
    const item: SoupItem = {
      entityType: type,
      entityId: envelope.entityId,
      tenantId: envelope.tenantId,
      title: typeof envelope.payload.title === "string" ? envelope.payload.title : existing?.title ?? "",
      updatedAt: envelope.occurredAt,
      version: envelope.version,
      facet: (envelope.payload.facet as DocumentFacet | null | undefined) ?? existing?.facet ?? null,
      tombstoned,
    };
    if (tombstoned) this.#rows.delete(envelope.entityId);
    else this.#rows.set(envelope.entityId, item);
    const visible = tombstoned ? { ...item, tombstoned: true } : item;
    for (const listener of this.#listeners) listener(visible);
    return visible;
  }

  ingest(outbox: Outbox, fromEventId?: string): number {
    const batch = outbox.replay(fromEventId);
    for (const next of batch) this.apply(next);
    if (batch.length > 0) {
      const last = batch[batch.length - 1];
      outbox.checkpoint("soup", last.eventId, last.version);
    }
    return batch.length;
  }

  subscribe(listener: SoupListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Mixed list. Rows the actor cannot View never render (ADR-004 read-side).
   * `receipts` must already be minted; this projection does not mint.
   */
  query(query: SoupQuery, receipts: readonly Receipt[]): SoupPage {
    const limit = query.limit ?? 50;
    let rows = [...this.#rows.values()].filter((item) => !item.tombstoned);
    if (query.types) rows = rows.filter((item) => query.types!.includes(item.entityType));
    if (query.facet !== undefined) rows = rows.filter((item) => item.facet === query.facet);
    rows.sort((a, b) => b.updatedAt - a.updatedAt || a.entityId.localeCompare(b.entityId));
    const visible = filterVisible(rows, receipts);
    const start = query.cursor ? visible.findIndex((item) => item.entityId === query.cursor) + 1 : 0;
    const slice = visible.slice(Math.max(0, start), Math.max(0, start) + limit);
    const next = slice.length === limit ? slice[slice.length - 1]?.entityId ?? null : null;
    return { items: slice, nextCursor: next };
  }

  get(entityId: string): SoupItem | undefined {
    return this.#rows.get(entityId);
  }
}
