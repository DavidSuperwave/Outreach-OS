# ADR-006 — Soup and cross-entity materialized indexes

- Status: Proposed (Draft — owner decides)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

> **Status note (Ruled 2026-08-20, see `../06-owner-decisions-needed.md`
> OD-27):** the projection topology is ruled — **one D1 projection plane, two
> schema families, shared consumer framework** (list/index schemas here;
> search schemas per ADR-007). The soup/search substrate-unification question
> this draft left open is closed on that topology; this ADR may finalize on
> it.

## Context

Soup is Neuwave's cross-entity list/feed engine (`crates/soup` @ `9f7a26b`;
tabs, grouping, filters, saved views, live updates). The kernel at `bf7f762`
has **no cross-entity query plane** — typed-storage collections are per-DO
(`packages/workshop-backend/src/user.ts:151-220`; verified absence,
`reports/01-plan-gap-review.md` C3). Multiple surfaces converge on the same
gap: Soup lists, favorites hydration (a 6-way LEFT JOIN in the source,
`crates/favorites/src/outbound/pg_favorites_repo.rs:153-158`), property
filtering (EAV over `entity_properties`), recents/frecency, and search
enrichment.

## Source and ruling constraints

- Soup ruling (ledger @ research/nuewave-longtail `13c2847`):
  **"Faithful UX on native data (2026-08-19)"** — list behavior recreated
  exactly; substrate CF-native. `graphql_soup` **killed** (wire detail).
- Pattern ruling **1a** rider: the materialized-index layer is **required,
  not optional**.
- 04-TARGET query/projection plane: cross-entity surfaces "cannot be
  recreated by making the shell fan out to dozens of authoritative Durable
  Objects on every render."
- Ledger search rows: the ruled index layer and the search index are "the
  same architectural slot and should be designed together" (→ ADR-007);
  the unification topology is now ruled (OD-27, 2026-08-20: one plane, two
  schema families); the row's dated verdict transcription rides the OD-5
  batch.

## Decision

**Proposed:**

1. **One materialized-index layer** (working name: the index plane) — a D1
   projection database (per-tenant partitioning decided in the domain doc)
   owned by a single projector service (ADR-005 rule 2), fed by the domain
   event stream (outbox → Queues), holding:
   - the **entity row projection**: (type, id, tenant, tombstone, display
     metadata, timestamps, container/project linkage);
   - **typed property value indexes** for filterable properties (the D2/2a
     EAV successor's query side);
   - **per-user decorations** where list-shaped (favorites flags, unread,
     pins) via join tables maintained from the same events;
   - the **access projection** used for read-side filtering (ADR-004).
2. **Soup queries are RPC methods on a query capability** (ADR-002) executing
   against the index plane: filter AST (recreating `crates/item_filters`
   semantics), grouping, ordering, keyset pagination. GraphQL is not
   recreated.
3. **Live updates**: index-plane commits publish change notifications on the
   kernel `/api` session push model (route ruling C1 superseded
   connection_gateway); subscriptions are scoped to a query and deliver
   row-level deltas with a resumable cursor — recreating soup_realtime
   behavior, not its transport.
4. **Hydration replaces the 6-way join**: favorites/recents/search results
   hydrate display metadata by batch reads of the entity row projection.
   Display names remain resolved-at-read (renames and viewer-relative DM
   names stay correct, as in the source).
5. **Rebuildability is a contract**: the index plane can always be rebuilt
   from authorities + event replay; checkpoints per ADR-005 rule 7.

## Alternatives considered

1. **Render-time fan-out to authoritative DOs.** Rejected by 04-TARGET; cost
   and tail latency scale with list size; no cross-entity ordering.
2. **Per-surface bespoke projections** (one for Soup, one for favorites, one
   for search enrichment). Rejected: four copies of the same row shape with
   four staleness models; the source's convergence on shared tables is
   evidence one plane serves all (this is behavior, not topology, because the
   plane is derived, not authoritative).
3. **Search index as the list store** (query OpenSearch-successor for Soup).
   Rejected: ranking indexes are not consistent-enough for list UX
   (ordering/pagination guarantees); the two share feeds, not storage —
   final call folded into ADR-007/OD-5.

## Compatibility impact

- Soup UX parity is the acceptance bar (tabs, grouping, filters, saved
  views, live update behavior; 05-MAP parity proof: one mixed list reproduces
  filters, ordering, pagination, updates).
- Saved-view `config` JSON stays opaque to the backend (three-tier storage
  semantics from the DSS-native row preserved at the surface level).
- Soup command surface (9 tab digits, `g g`, filters/sort/search hotkeys) is
  shell scope (ADR-001) but depends on query capability latency budgets.

## State and authorization impact

- The index plane is **never an authority** (ADR-005); every row is derived.
- All list reads are receipt-filtered via the access projection; fail-closed
  on projection miss (ADR-004 rule 3).

## Migration and rollback

- OD-1 Branch A: plane builds from empty authorities; nothing to migrate.
- Branch B: plane is rebuilt after authority load (08 §4) — never migrated
  row-for-row from Postgres.
- Rollback: drop-and-rebuild; staleness during rebuild is the degraded mode
  (lists lag, authorities unaffected).

## Operational consequences

- Projector lag becomes a user-visible SLO (list freshness); expose staleness
  metrics and a backfill endpoint-equivalent (bulk rebuild job as DO+alarm
  per 4a).
- D1 sizing/partitioning must be watched per tenant; hot tables are the
  entity row projection and property indexes.

## Tests and acceptance

- Golden Soup fixtures: filter/group/order/pagination parity against recorded
  source behavior.
- Live-update test: entity mutation → delta on an open subscription within
  SLO; reconnect resumes without loss or duplication.
- Rebuild determinism: two rebuilds from the same authority state are
  identical.
- Access filtering: revoked entity disappears from list results within SLO
  (and the favorites-gap decision from ADR-004 is honored).

## Follow-up decisions

- **OD-5 (existing)**: batch ruling covers the rows without verdicts
  (frecency, activity vocabulary) that feed this plane. The soup/search
  substrate-unification question was ruled separately — **OD-27, 2026-08-20:
  one D1 projection plane, two schema families, shared consumer framework**
  (see `../06-owner-decisions-needed.md` OD-27); the batch only transcribes
  the dated verdict onto the ledger row.
- Filter-AST scope (which of `crates/item_filters`' literals port in pass 1)
  and D1 partitioning belong to
  `reports/04-target-architecture-decisions.md`.
