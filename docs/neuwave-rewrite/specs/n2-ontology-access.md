# Domain specification — Entity ontology + authorization receipts (N2 / SUP-550)

## Verdict and source evidence

OD-7: task is a document facet; thread = EmailThread; 16-variant EntityType is final.  
ADR-003, ADR-004. Wrapper packages: `packages/registry`, `packages/authz`.  
Kernel pin untouched. Receipts are in-process branded values; they never cross `/api`.

## User journeys

Owner shares a document (including a task-facet document) at Comment → teammate can comment, cannot edit.  
Revoke → subsequent mint denies (SEC-1, including stale list/favorites paths).  
Cross-tenant id guess denies (SEC-3).

## Invariants

No handler authorizes from a raw id — it takes a `Receipt`. Tombstoned entities fail closed. Per-type policy is code. Task access receipts are Document.

## Entities and identifiers

16 EntityTypes with ADR-003 type-tagged ids. `property_entity_type` TASK → document/task facet; THREAD → email_thread.

## Authority and consistency

Registry = existence/tenant/tombstone. Owning DO (later) = share rows. PolicyEngine = sole mint path. D1 `entity_access_index` is N4.

## Storage and indexes

In-memory registry + AccessState maps in N2. D1 registry table and access projection ride N3/N4.

## RPC/API contract

No public RPC. Share methods are per-domain and land with those domains.

## Commands and UI surfaces

26 command rows owned; UI ships N5/N8. N2 freezes enablement as receipt-level.

## Authorization matrix

05-MAP row 2: owner/comment-share/outsider × view/comment/edit/owner on a task-facet document.

## Events, jobs, retries, and replay

Share-change events and access-projection drain are N3/N4. N2 records the denial semantics.

## Tests and parity fixtures

`packages/registry/src/ontology.test.ts` (16 types, property map, tombstones).  
`packages/authz/src/authz.test.ts` (05-MAP row 2, SEC-1/2/3, unforgeable receipts).

## Failure modes and rollback

`AuthzError` / `RegistryError`. Rollback = revert wrapper packages.

## Open decisions

SEC-1/2/3 concrete text lives in Linear SUP-474 (unreadable here); fixtures encode harvested denial semantics (revoke, no-escalate, cross-tenant).
