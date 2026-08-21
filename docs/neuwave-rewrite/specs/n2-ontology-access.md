# Domain specification — Entity ontology + authorization receipts (N2 / SUP-550)

## Verdict and source evidence

OD-7: task is a document facet; thread = EmailThread; 16-variant EntityType is final.  
ADR-003 (accepted-as-amended, pending owner final read), ADR-004 (proposed; implemented as specified).  
Wrapper packages: `packages/registry`, `packages/authz`. Kernel pin untouched.  
Receipts are in-process branded values; they never cross `/api`.

## User journeys

Owner shares a document (including a task-facet document) at Comment → teammate can comment, cannot edit.  
Revoke → subsequent mint denies (SEC-1, including stale list/favorites paths).  
Cross-tenant id guess denies (SEC-3).  
Channel membership grants comment; inbox-delegate edits a thread; project children inherit folder grants; CRM is team-scoped.

## Invariants

No handler authorizes from a raw id — it takes a `Receipt` via one of the 14 extractors.  
Tombstoned entities fail closed. Per-type policy is code (13 named query modules).  
Task access receipts are Document. Agent `onBehalfOf` mints for the delegating principal.

## Entities and identifiers

16 EntityTypes with ADR-003 type-tagged ids. `property_entity_type` TASK → document/task facet; THREAD → email_thread.

## Authority and consistency

Registry = existence/tenant/tombstone.  
`AccessStore` = owning-DO share-state stand-in (N2); physical DOs ride domain nodes.  
PolicyEngine = sole mint path. D1 `entity_access_index` is N4 and is never the authority.

## Storage and indexes

In-memory registry + AccessStore in N2. D1 registry table and access projection ride N3/N4.

## RPC/API contract

No public RPC. Share methods are per-domain and land with those domains.

## Commands and UI surfaces

26 command rows owned (`block-entity` 17 + `entity` 8 + `property-editor` 1).  
`commandEnabled` freezes receipt-level enablement; UI ships N5/N8.

## Authorization matrix

05-MAP row 2: 16 EntityTypes × owner / comment-share / outsider × view / comment / edit / owner, plus harvested specials for all 13 query modules (`packages/authz/src/fixtures/behavior-matrix.ts`).

## Events, jobs, retries, and replay

Share-change events and access-projection drain are N3/N4. N2 records the denial semantics.

## Tests and parity fixtures

`packages/registry/src/ontology.test.ts` (16 types, property map, tombstones).  
`packages/authz/src/matrix.test.ts` (harvested user × entity × level matrix).  
`packages/authz/src/authz.test.ts` (SEC-1/2/3, unforgeable receipts).  
`packages/authz/src/queries.test.ts` (B3 13-module freeze).  
`packages/authz/src/extractors.test.ts` (B2 14-extractor freeze).  
`packages/authz/src/commands.test.ts` (26-row enablement).  
`packages/authz/src/reads.test.ts` (favorites.list enforced).

## Failure modes and rollback

`AuthzError` / `RegistryError`. Rollback = revert wrapper packages.

## Open decisions

SEC-1/2/3 concrete text lives in Linear SUP-474 (unreadable here); fixtures encode harvested denial semantics (revoke, no-escalate, cross-tenant).  
ADR-004 remains Proposed pending owner final read; N2 implements the proposed decision.
