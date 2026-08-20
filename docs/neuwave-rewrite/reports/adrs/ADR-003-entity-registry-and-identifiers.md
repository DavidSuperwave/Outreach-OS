# ADR-003 — Entity registry and canonical entity identifiers

- Status: **Accepted-as-amended pending final read** (OD-7 Ruled 2026-08-20,
  see `../06-owner-decisions-needed.md` OD-7)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

## Amendment (Ruled 2026-08-20, OD-7)

Entity-type canonicalization is ruled, following Macro's actual treatment (per
the dedicated audit, `../notes/od7-task-treatment-audit.md`):

- **Task is NOT a first-class entity type.** Task stays a **document facet**
  (document + `sub_type='task'` marker + TASK property bundle); access
  receipts are minted as Document, exactly as at every boundary in the source
  ("Tasks are documents at API boundaries"). Any text below treating
  first-class task as a live option — including the previously recommended
  hybrid (task first-class, thread facet) — is **superseded**.
- **Thread is resolved as an alias of `EmailThread`**, which is already a
  first-class `EntityType` variant — no new entity type there either.
- Consequently the canonical vocabulary stays the verified 16 `EntityType`
  variants; `property_entity_type`'s TASK/THREAD values map to the
  document-facet dimension and EmailThread respectively, and the property
  system carries the facet dimension as in the source.

## Context

Neuwave's platform ontology is `Entity = (entity_type, entity_id)` glue spread
across 56 crates. Verified vocabularies at Neuwave @ `9f7a26b`:

- `EntityType` = **16** variants (`crates/model-entity/src/lib.rs:34`);
- `property_entity_type` = **10** values (initial 6 + COMPANY/TASK
  `20251128000000:3-4` + CALL_RECORD `20260709192942` + CALENDAR_EVENT
  `20260726023229`) — including `TASK` and `THREAD`, which have **no
  EntityType variant** (both are document facets today);
- `FileType` = **413** generated variants → 18 viewer associations
  (`crates/model_file_type/src/lib.rs`).

The old system re-verifies entity existence per request (e.g. the
`ensure_document_exists` middleware hop) and has no single registry; tombstone
and cross-entity behavior is per-domain.

## Source and ruling constraints

- Pattern ruling **1a** (David, 2026-08-19; `merge/pattern-review.md` @
  research/nuewave-longtail `13c2847`): adopt the ontology, replace the
  encoding, with two standing riders — the **materialized-index layer is
  required** (ADR-006) and the **TEXT/UUID id format is settled before any
  glue is built**.
- Pattern ruling **2a** rider: entity-type canonicalization is settled before
  any property row is written (→ OD-7).
- Ledger row `foreign_entity`: the cleanest case of an entity existing only in
  the registry (id, type, tenant, tombstone) with payload in metadata.
- Q20 "One Task Database" invariant and the documents-row split proposals
  bound what TASK may become.

## Decision

**Proposed:**

1. **A single wrapper-owned entity registry** is the authority for entity
   *existence, type, tenant, and tombstone* — nothing else. Implementation
   slot: a registry capability backed by a D1 table owned by one registry
   worker/DO (single-authority rule, ADR-005), plus per-entity authoritative
   aggregates that remain the authority for entity *content*.
2. **Canonical identifier**: opaque, globally unique, type-tagged TEXT id
   (UUIDv7 payload recommended for time-ordered locality), never parsed for
   meaning beyond the type tag; the (type, id) pair remains the public
   identity everywhere (RPC, projections, activity, search, favorites).
   Legacy numeric/uuid ids are mapped, not reused, if any data migrates
   (ADR-013). Exact wire format is the 1a rider decision the owner signs off.
3. **Closed, versioned type vocabulary** seeded from the verified 16
   `EntityType` variants; `property_entity_type`'s 10 values must become a
   subset of the canonical vocabulary — the TASK/THREAD discrepancy **was
   ruled via OD-7 (2026-08-20)**: task = document facet, thread = EmailThread
   alias (see Amendment above). `FileType` (413) is adopted as
   a data vocabulary (not 413 code paths) with the 18 viewer associations as
   the behavioral contract.
4. **Tombstones are registry facts** with deletion propagation obligations
   (search de-index, projection cleanup, notification suppression) expressed
   as events per ADR-005's outbox discipline.

## Alternatives considered

1. **No registry; per-domain existence checks (status quo).** Rejected: 1a
   explicitly replaces the `ensure_document_exists`-style hops; cross-entity
   surfaces (Soup, favorites' 6-way hydration join, search enrichment) all
   need one existence/tombstone truth.
2. **Registry as authority for entity payloads too (one giant table).**
   Rejected: violates state-ownership principle (03-PRINCIPLES §3) and 1a's
   "per-type access policy stays code"; would make D1 the write free-for-all
   04-TARGET forbids.
3. **Kernel-owned registry (extend workpiece ids).** Rejected: kernel
   workpiece ids are workspace-scoped (`api.ts:141`); entity ontology is
   product scope; kernel-change budget says no.

## Compatibility impact

- Entity (type, id) tuples appear in RPC payloads, deep links, activity facts
  (UUIDv5 derivation at `crates/activity/src/domain/models.rs:40`), favorites
  PKs, and property rows — the id-format rider decision is therefore a
  one-way door and precedes all domain glue.
- Frontend aliases (task/snippet/skill → md blocks) are shell-level and must
  not leak into the registry vocabulary.

## State and authorization impact

- Registry rows carry tenant; every receipt check (ADR-004) resolves the
  entity through the registry first, so tombstoned/foreign-tenant entities
  fail closed.
- The registry is not an ACL store: per-type access policy stays code (1a).

## Migration and rollback

- OD-1 Branch A (no live data): registry starts empty; seed fixtures only.
- OD-1 Branch B: identity-mapping stage (08 §2) writes durable old-id → new-id
  mappings into a migration D1 table before any domain load; resumable and
  inspectable.
- Rollback: registry schema versioned; additive-only migrations during first
  pass; tombstone semantics make hard deletes unnecessary in rollback windows.

## Operational consequences

- One more single-authority service on the critical path of every entity
  create; must be cheap (single D1 write + event) and cache-safe (existence
  reads may be served from projections; authority remains the registry).
- Vocabulary changes become governed events (a new entity type is a ledgered
  change, not a string).

## Tests and acceptance

- Property/registry consistency test: every `property_entity_type` value maps
  to a canonical type or facet mapping (per the OD-7 ruling, 2026-08-20:
  TASK → document facet, THREAD → EmailThread).
- Tombstone propagation test: delete entity → within SLO, absent from Soup
  projection, search index, favorites hydration; activity facts retained.
- Id-format fuzz: ids are opaque (no consumer parses payload), stable under
  serialization across RPC/D1/R2 metadata.
- 16/10/413 vocabulary snapshots asserted against the pinned source counts.

## Follow-up decisions

- **OD-7 — RULED 2026-08-20** (see `../06-owner-decisions-needed.md` OD-7 and
  `../notes/od7-task-treatment-audit.md`): task stays a document facet; thread
  = EmailThread (already first-class). Properties, registry vocabulary, and
  the WP-040 task slice are unblocked.
- 1a rider sign-off: final TEXT/UUID id wire format (owner).
- Per-domain aggregate boundaries and the registry's exact D1 schema belong to
  `reports/04-target-architecture-decisions.md`.
