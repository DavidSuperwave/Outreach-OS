# Domain specification — Soup projection plane (N4 / SUP-551)

## Verdict and source evidence

Ruling 1a rider: materialized-index layer is required. Kernel has no cross-entity query plane.  
ADR-006 freeze as in-process `ProjectionPlane` (D1 later). OD-27: one plane, two schema families
(`lists` / `search`), shared consumer. OD-7: no Task Soup item. Favorites listing is enforced
(SEC-1). Wave 2 is the slice-sufficient cut (05-MAP row 4). Search ranking is N16.

## User journeys

Mixed list of a task-facet document, a plain document, and a project: filter by type/facet/title,
order by updatedAt (or title/createdAt), paginate, group, live-update from outbox, hide rows
without View receipts. Search family indexes the 7 coverage types from the same outbox and
receipt-filters before enrichment.

## Invariants

Projection is rebuildable from the outbox. Query never mints receipts. Tombstones drop from both
families. Lists and search do not share storage. Single projector owner (`soup-projector`).

## Storage and indexes

In-memory maps keyed by entity id implementing `LIST_SCHEMA_DDL` / `SEARCH_SCHEMA_DDL`.
Checkpoints `soup.lists` and `soup.search` on the N3 outbox. `entity_access_index` is a lists-family
join. N6 hardens list reads to consume this projected, tenant-scoped policy outcome directly;
query paths never mint receipts and the authority path never reads the projection. N6's v2
compatibility migration gives rows and access composite tenant keys; projector replacement uses
an atomic D1 batch, while revocation closes affected access rows before the authority commit.

## Commands and UI surfaces

59 command rows frozen (`soup` 28 + `soup-entity` 22 + `soup-nav` 8 + `favorites` 1).
`commandEnabled` is the list/search+receipt contract; UI ships with N5.

## Tests and parity fixtures

`packages/soup/src/soup.test.ts` — mixed list, sort, pagination, live update, rebuild, tombstone,
subscription replay, grouping, favorites cap/fractional/hydrate/enforcement.  
`packages/soup/src/plane.test.ts` — OD-27 families, shared consumer, 7-type coverage, dual rebuild.  
`packages/soup/src/commands.test.ts` — 59-row enablement.

## Failure modes and rollback

Drop + replay from outbox. Projector lag is list/search freshness, not authority.
