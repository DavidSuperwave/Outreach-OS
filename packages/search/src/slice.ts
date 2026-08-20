import { levelSatisfies, type Receipt } from "authz";
import { Outbox, envelope, requestContext, type EventEnvelope, type Topic } from "control-plane";
import type { ActorContext } from "identity/principal";
import { ProjectionPlane, SEARCH_ENTITY_TYPES as SOUP_SEARCH_ENTITY_TYPES, isSearchEntityType } from "soup";
import type { SearchEntityType } from "soup";
import { SearchError } from "./errors.js";
import { compareHits, extractBody, isPoisonBody, titleBoostScore } from "./ranking.js";
import {
  SEARCH_ENTITY_TYPES,
  SNIPPET_CHARS,
  type IndexFailure,
  type SearchResult,
} from "./types.js";

export interface SearchApi {
  ingest(outbox?: Outbox): number;
  backfill(outbox: Outbox): number;
  queryUnified(q: string, receipts: readonly Receipt[]): SearchResult[];
  querySimple(q: string, type: SearchEntityType, receipts: readonly Receipt[]): SearchResult[];
  queryChannel(q: string, channelId: string, receipts: readonly Receipt[]): SearchResult[];
}

const SEARCH_TOPICS: Record<SearchEntityType, Topic> = {
  document: "documents",
  project: "projects",
  chat: "chats",
  channel: "channels",
  email_thread: "email",
  call: "calls",
  crm_company: "soup",
};

/**
 * N16 search slice. Wraps soup `ProjectionPlane` / `SearchIndex` (no FTS fork).
 * Indexing hangs off the outbox; ranking + enrichment live here (OD-15 prototype).
 */
export class SearchSlice {
  outbox = new Outbox();
  plane = new ProjectionPlane();
  #failed = new Map<string, IndexFailure>();
  #channelOf = new Map<string, string>();

  constructor() {
    if (SEARCH_ENTITY_TYPES.join() !== SOUP_SEARCH_ENTITY_TYPES.join()) {
      throw new Error("search coverage drifted from soup SEARCH_ENTITY_TYPES");
    }
  }

  openApi(): SearchApi {
    return {
      ingest: (outbox) => this.ingest(outbox),
      backfill: (outbox) => this.backfill(outbox),
      queryUnified: (q, receipts) => this.queryUnified(q, receipts),
      querySimple: (q, type, receipts) => this.querySimple(q, type, receipts),
      queryChannel: (q, channelId, receipts) => this.queryChannel(q, channelId, receipts),
    };
  }

  /** Consume published outbox envelopes into lists + search families. */
  ingest(outbox: Outbox = this.outbox): number {
    outbox.drain(() => undefined);
    const from = this.#resumeFrom(outbox);
    return this.#applyBatch(outbox, outbox.replay(from));
  }

  /**
   * DO+alarm stand-in (pattern 4a): drop local search/lists state and rebuild
   * from the outbox. Checkpoints are rewritten to the last envelope.
   */
  backfill(outbox: Outbox): number {
    this.plane = new ProjectionPlane();
    this.#failed.clear();
    this.#channelOf.clear();
    outbox.drain(() => undefined);
    return this.#applyBatch(outbox, outbox.replay());
  }

  queryUnified(q: string, receipts: readonly Receipt[], limit = 20): SearchResult[] {
    return this.#query(q, receipts, undefined, limit);
  }

  querySimple(q: string, type: SearchEntityType, receipts: readonly Receipt[], limit = 20): SearchResult[] {
    if (!isSearchEntityType(type)) {
      throw new SearchError("unknown_type", `type ${type} is outside the 7-entity coverage contract`);
    }
    return this.#query(q, receipts, [type], limit);
  }

  /**
   * Channel mount: deny unless the caller presents a view receipt on
   * `channelId`. Hits are still receipt-filtered; membership does not mint.
   */
  queryChannel(q: string, channelId: string, receipts: readonly Receipt[], limit = 20): SearchResult[] {
    const membership = receipts.some(
      (receipt) => receipt.entityId === channelId && levelSatisfies(receipt.level, "view"),
    );
    if (!membership) {
      throw new SearchError("denied", "queryChannel requires a view receipt on the channel");
    }
    return this.#query(q, receipts, undefined, limit).filter(
      (hit) => hit.entityId === channelId || this.#channelOf.get(hit.entityId) === channelId,
    );
  }

  failed(entityId: string): IndexFailure | undefined {
    return this.#failed.get(entityId);
  }

  failures(): IndexFailure[] {
    return [...this.#failed.values()];
  }

  appendEnvelope(input: Parameters<typeof envelope>[0]): EventEnvelope {
    const env = envelope(input);
    this.outbox.append(env);
    return env;
  }

  topicFor(type: SearchEntityType): Topic {
    return SEARCH_TOPICS[type];
  }

  #query(
    q: string,
    receipts: readonly Receipt[],
    types: readonly SearchEntityType[] | undefined,
    limit: number,
  ): SearchResult[] {
    const candidateLimit = Math.max(this.plane.search.size(), limit, 20);
    const ids = this.plane.search.query({ q, types, limit: candidateLimit }, receipts);
    const hits: SearchResult[] = [];
    for (const raw of ids) {
      const item = this.plane.lists.get(raw.entityId);
      if (!item || item.tombstoned) continue;
      if (!isSearchEntityType(item.entityType)) continue;
      const score = titleBoostScore(item.title, item.body, q);
      if (score === 0) continue;
      hits.push({
        entityType: item.entityType,
        entityId: item.entityId,
        tenantId: item.tenantId,
        title: item.title,
        snippet: item.body.slice(0, SNIPPET_CHARS),
        score,
        updatedAt: item.updatedAt,
      });
    }
    hits.sort(compareHits);
    return hits.slice(0, limit);
  }

  #applyBatch(outbox: Outbox, batch: EventEnvelope[]): number {
    for (const next of batch) this.#apply(next);
    if (batch.length > 0) {
      const last = batch[batch.length - 1]!;
      outbox.checkpoint("soup.lists", last.eventId, last.version);
      outbox.checkpoint("soup.search", last.eventId, last.version);
    }
    return batch.length;
  }

  #apply(next: EventEnvelope): void {
    this.plane.lists.apply(next);
    this.#trackChannel(next);
    if (!isSearchEntityType(next.entityType)) return;
    if (next.payload.tombstoned === true) {
      this.#failed.delete(next.entityId);
      this.#channelOf.delete(next.entityId);
      this.plane.search.apply(next);
      return;
    }
    const body = extractBody(next.payload);
    if (isPoisonBody(body)) {
      this.#failed.set(next.entityId, {
        entityId: next.entityId,
        entityType: next.entityType,
        version: next.version,
        reason: "index_failed",
      });
      if (this.plane.search.get(next.entityId)) {
        this.plane.search.apply({ ...next, payload: { tombstoned: true } });
      }
      return;
    }
    this.#failed.delete(next.entityId);
    this.plane.search.apply(next);
  }

  #trackChannel(next: EventEnvelope): void {
    if (next.payload.tombstoned === true) {
      this.#channelOf.delete(next.entityId);
      return;
    }
    if (next.entityType === "channel") {
      this.#channelOf.set(next.entityId, next.entityId);
      return;
    }
    if (typeof next.payload.channelId === "string") {
      this.#channelOf.set(next.entityId, next.payload.channelId);
    }
  }

  #resumeFrom(outbox: Outbox): string | undefined {
    const lists = outbox.getCheckpoint("soup.lists")?.lastEventId;
    const search = outbox.getCheckpoint("soup.search")?.lastEventId;
    return lists ?? search;
  }
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: false };
}

export { envelope, requestContext };
