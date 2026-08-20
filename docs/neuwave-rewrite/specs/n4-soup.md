# Domain specification — Soup projection plane (N4 / SUP-551)

## Verdict and source evidence

Ruling 1a rider: materialized-index layer is required. Kernel has no cross-entity query plane.  
ADR-006 freeze as in-process `SoupIndex` (D1 later). OD-7: no Task Soup item.  
Favorites listing is enforced (SEC-1). Wave 2 is the slice-sufficient cut (05-MAP row 4).

## User journeys

Mixed list of a task-facet document, a plain document, and a project: filter by type/facet, order by updatedAt, paginate, live-update from outbox, hide rows without View receipts.

## Invariants

Projection is rebuildable from the outbox. Query never mints receipts. Tombstones drop from the index.

## Storage and indexes

In-memory map keyed by entity id. Checkpoint `soup` on the N3 outbox.

## Commands and UI surfaces

59 command rows land with N5 UI; N4 freezes the list contract.

## Tests and parity fixtures

`packages/soup/src/soup.test.ts` — mixed list, pagination, live update, rebuild, favorites cap/enforcement.
