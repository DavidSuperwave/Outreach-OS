import type { Receipt } from "authz";
import { filterVisible, readTag } from "authz";
import type { EventEnvelope } from "control-plane";
import { Outbox } from "control-plane";
import type { DocumentFacet } from "registry";
import type { ProjectionFamily } from "./consumer.js";
import { compareItems, matchesFilter, type SoupFilter, type SoupSortField, type SoupSortOrder } from "./filters.js";
import { flattenGroups, groupItems, type SoupGroup, type SoupGroupBy } from "./grouping.js";
import {
  payloadBool,
  payloadNumber,
  payloadString,
  soupItemType,
  type SoupItem,
  type SoupItemType,
} from "./item.js";

export interface SoupQuery {
  types?: SoupItemType[];
  facet?: DocumentFacet | null;
  titleContains?: string;
  projectId?: string | null;
  filter?: SoupFilter;
  cursor?: string | null;
  limit?: number;
  sort?: SoupSortField;
  order?: SoupSortOrder;
  groupBy?: SoupGroupBy;
  collapsedGroups?: readonly string[];
}

export interface SoupPage {
  items: SoupItem[];
  groups: SoupGroup[];
  nextCursor: string | null;
}

export interface SoupDelta {
  seq: number;
  item: SoupItem;
}

export type SoupListener = (delta: SoupDelta) => void;

/**
 * Lists schema family (ADR-006 freeze). Physical D1 is the same contract
 * with SQLite behind it. Authority path never reads this; list filtering is enforced.
 */
export class SoupIndex implements ProjectionFamily {
  readonly family = "lists" as const;
  readonly checkpoint = "soup.lists";
  readonly surface = "soup.list" as const;
  #rows = new Map<string, SoupItem>();
  #listeners = new Set<SoupListener>();
  #seq = 0;
  #log: SoupDelta[] = [];

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
      title: payloadString(envelope.payload, "title") ?? existing?.title ?? "",
      body: payloadString(envelope.payload, "body") ?? payloadString(envelope.payload, "text") ?? existing?.body ?? "",
      updatedAt: envelope.occurredAt,
      createdAt: payloadNumber(envelope.payload, "createdAt") ?? existing?.createdAt ?? envelope.occurredAt,
      version: envelope.version,
      facet: (envelope.payload.facet as DocumentFacet | null | undefined) ?? existing?.facet ?? null,
      projectId: payloadString(envelope.payload, "projectId") ?? existing?.projectId ?? null,
      unread: payloadBool(envelope.payload, "unread") ?? existing?.unread ?? false,
      done: payloadBool(envelope.payload, "done") ?? existing?.done ?? false,
      tombstoned,
      status: payloadString(envelope.payload, "status") ?? existing?.status ?? null,
      priority: payloadString(envelope.payload, "priority") ?? existing?.priority ?? null,
    };
    if (tombstoned) this.#rows.delete(envelope.entityId);
    else this.#rows.set(envelope.entityId, item);
    const visible = tombstoned ? { ...item, tombstoned: true } : item;
    this.#seq += 1;
    const delta: SoupDelta = { seq: this.#seq, item: visible };
    this.#log.push(delta);
    for (const listener of this.#listeners) listener(delta);
    return visible;
  }

  ingest(outbox: Outbox, fromEventId?: string): number {
    const batch = outbox.replay(fromEventId);
    for (const next of batch) this.apply(next);
    if (batch.length > 0) {
      const last = batch[batch.length - 1]!;
      outbox.checkpoint(this.checkpoint, last.eventId, last.version);
    }
    return batch.length;
  }

  subscribe(listener: SoupListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Reconnect: deltas after `seq` with no loss or duplication (gate 5 / subscription-replay). */
  replayFrom(seq: number): SoupDelta[] {
    return this.#log.filter((delta) => delta.seq > seq);
  }

  get seq(): number {
    return this.#seq;
  }

  snapshot(): SoupItem[] {
    return [...this.#rows.values()].filter((item) => !item.tombstoned);
  }

  persistence(): { items: SoupItem[]; seq: number; log: SoupDelta[] } {
    return {
      items: [...this.#rows.values()].map((item) => ({ ...item })),
      seq: this.#seq,
      log: this.#log.map((delta) => ({ seq: delta.seq, item: { ...delta.item } })),
    };
  }

  restore(snapshot: { items: readonly SoupItem[]; seq: number; log: readonly SoupDelta[] }): void {
    this.#rows = new Map(snapshot.items.map((item) => [item.entityId, { ...item }]));
    this.#seq = snapshot.seq;
    this.#log = snapshot.log.map((delta) => ({ seq: delta.seq, item: { ...delta.item } }));
    this.#listeners.clear();
  }

  /**
   * Mixed list. Rows the actor cannot View never render (ADR-004 read-side).
   * `receipts` must already be minted; this projection does not mint.
   */
  query(query: SoupQuery, receipts: readonly Receipt[]): SoupPage {
    const limit = query.limit ?? 50;
    const sort = query.sort ?? "updatedAt";
    const order = query.order ?? "desc";
    const groupBy = query.groupBy ?? "none";
    let rows = this.snapshot();
    const compiled = compileQuery(query);
    if (compiled) rows = rows.filter((item) => matchesFilter(item, compiled));
    rows.sort((a, b) => compareItems(a, b, sort, order));
    const visible = filterVisible(rows, receipts);
    const collapsed = new Set(query.collapsedGroups ?? []);
    const groups = groupItems(visible, groupBy, collapsed);
    const flat = flattenGroups(groups);
    const start = query.cursor ? flat.findIndex((item) => item.entityId === query.cursor) + 1 : 0;
    const slice = flat.slice(Math.max(0, start), Math.max(0, start) + limit);
    const next = slice.length === limit ? (slice[slice.length - 1]?.entityId ?? null) : null;
    return { items: slice, groups, nextCursor: next };
  }

  get(entityId: string): SoupItem | undefined {
    return this.#rows.get(entityId);
  }
}

function compileQuery(query: SoupQuery): SoupFilter | null {
  const parts: SoupFilter[] = [];
  if (query.types) parts.push({ kind: "type", types: query.types });
  if (query.facet !== undefined) parts.push({ kind: "facet", facet: query.facet });
  if (query.titleContains) parts.push({ kind: "title", contains: query.titleContains });
  if (query.projectId !== undefined) parts.push({ kind: "project", projectId: query.projectId });
  if (query.filter) parts.push(query.filter);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return { kind: "and", filters: parts };
}
