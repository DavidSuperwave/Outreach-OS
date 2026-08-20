# ADR-007 — Seven-entity-type search (ranking, freshness, enrichment)

- Status: Proposed (Draft — owner decides; exception governance per OD-2)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

> **Status note (Ruled 2026-08-20, see `../06-owner-decisions-needed.md`
> OD-27):** the topology shared with ADR-006 is ruled — **one D1 projection
> plane, two schema families, shared consumer framework** (search FTS tables
> are the second schema family on the same plane). This ADR may finalize on
> that topology. OD-15 (substrate/technology election after the golden-query
> prototype) and OD-2 (exception recording) remain open.

## Context

Corrected framing (WP-010, verdict **C** on claim E2): "seven-source search"
means **seven indexed entity types on one OpenSearch index** — document,
project, chat, channel, email, call_record, crm_company — not seven search
providers. At Neuwave @ `9f7a26b`:

- `crates/search_service` (7,061 LOC): 3 mounts (`POST /`, `POST /simple`,
  `/channel`), per-entity handlers ×7, query-term parsing (`terms.rs`),
  result **enrichment from Postgres** after the index returns ids
  (`enrich.rs`). It queries; it does not index.
- `services/search_processing_service` (10,165 LOC): the indexing half — one
  Kafka consumer per entity type (×7, matching exactly), plus internal
  `/backfill`, `/delete_document`, `/extract_sync` (text pull for
  sync-service-backed docs).

The "seven-source search remains" deliberate exception (01-AUTHORITY) is one
of the four controlled owner decisions pending ledger recording (OD-2).

## Source and ruling constraints

- 01-AUTHORITY deliberate exception 3: seven-source search remains — read as
  the **7-entity-type coverage contract + ranking/freshness parity**, per the
  WP-010 correction (G-010). The "query router over provider sources" phrasing
  in 04-TARGET/05-MAP is superseded by this ADR's framing.
- Ledger rows `search_service`/`search_processing_service` (research branch @
  `13c2847`): defer, "rule with each other — one system"; substrate is a
  D1/1a index-layer question; candidates named: D1 FTS5 lexical + Vectorize
  semantic, enrichment from entity data.
- Pattern ruling 3a: consumers idempotent (re-index by id is a no-op), poison
  marked-and-skipped. 4a: backfill is a DO+alarm bulk job, not a dispatcher.
- 04-TARGET: lexical → D1 FTS or dedicated index; semantic → Vectorize with
  explicit source-of-truth and deletion propagation.

## Decision

**Proposed:**

1. **The coverage contract is frozen at the 7 entity types**; adding/removing
   a type is a ledgered compatibility change.
2. **One logical search system, two halves, one substrate slot** shared with
   the index plane (ADR-006):
   - **Indexing half**: the same domain event stream that feeds the index
     plane feeds search — one Queue consumer per entity type (preserving the
     7-consumer shape as the coverage checklist), writing to a lexical index.
     Proposed substrate: **D1 FTS5** tables owned by the search projector
     (single-owner rule). Vectorize is an optional semantic add-on behind the
     same projector, not pass-1 scope unless the owner pulls it in.
   - **Query half**: an RPC search capability (ADR-002) recreating unified +
     simple + channel query semantics, query-term parsing, and per-type
     result shapes; **enrichment** hydrates from the entity row projection
     (ADR-006) instead of Postgres joins.
3. **Freshness model**: index lag = projector lag; `sync_content_updated`-
   style text extraction for collaborative docs is an explicit extraction
   step against the lifted sync-service (ADR-008), preserving the source's
   `/extract_sync` behavior as an internal capability.
4. **Deletion propagation**: registry tombstones (ADR-003) drive de-indexing;
   verified by the tombstone acceptance test.
5. **Backfill/re-index** is a bulk DO+alarm job with checkpoints (4a), exposed
   as an operator capability, not a public route.

## Alternatives considered

1. **Managed OpenSearch/Elastic off-platform.** Rejected for pass 1: keeps an
   external stateful substrate the ruling program is dissolving; only
   reconsidered if D1 FTS5 fails the golden-query gate (ranking quality or
   scale), which the acceptance tests measure before commitment hardens.
2. **A provider-fan-out "query router".** Rejected: artifact of the corrected
   mis-phrasing; no such thing exists in the source.
3. **Search directly over the index plane (no separate FTS tables).**
   Rejected: list projections need consistent ordering, search needs ranked
   retrieval; shared feed, separate structures (see ADR-006 alternative 3).

## Compatibility impact

- Query surface parity: unified/simple/channel semantics, term parsing, and
  per-type result shapes are the ledgered contract; the golden-query set
  (05-MAP: coverage and ranking within tolerances) is the acceptance
  artifact.
- Ranking parity is *tolerance-based*, not exact: OpenSearch BM25 vs FTS5
  ranking will differ; the owner accepts a tolerance band via the golden set.

## State and authorization impact

- The search index stores only what enriched results may reveal; **results
  are receipt-filtered at query time** via the access projection before
  enrichment (no leak of titles/snippets for revoked entities), fail-closed.
- Index tables owned solely by the search projector (ADR-005).

## Migration and rollback

- No index migration ever: search indexes are rebuilt from authorities +
  events in both OD-1 branches.
- Rollback: drop index, rebuild; degraded mode = stale/absent search while
  lists (ADR-006) keep working.

## Operational consequences

- Metrics: per-type indexing lag, queue depth, poison count, golden-query
  score tracked over time.
- FTS5 storage growth per tenant watched; extraction jobs for large docs are
  budgeted (interacts with converter/text-extraction family, ADR-012).

## Tests and acceptance

- Golden-query suite: 7-type coverage, ranking within owner-accepted
  tolerance, freshness SLO (entity mutation → searchable within N seconds).
- Idempotency: double-delivery of an index event is a no-op (index-by-id).
- Tombstone: deleted entity absent from results within SLO.
- Authorization: cross-user golden queries never return unauthorized rows.

## Follow-up decisions

- **OD-2 (existing)**: record the exception in the ledger with the corrected
  7-entity-type wording + boundary/threat/observability/rollback docs.
- **OD-15 (new)**: substrate election checkpoint — owner ratifies D1 FTS5
  (+ optional Vectorize) after the golden-query gate runs on a prototype, or
  redirects to a dedicated index. Fold into the OD-5 batch if preferred.
- Analyzer/tokenization details and per-type field mappings belong to
  `reports/04-target-architecture-decisions.md`.
