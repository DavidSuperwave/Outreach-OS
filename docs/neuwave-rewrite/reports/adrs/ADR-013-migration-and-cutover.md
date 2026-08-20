# ADR-013 — Migration and cutover (dual-branch, gated on OD-1)

- Status: **Accepted** (Ruled 2026-08-20, see `../06-owner-decisions-needed.md`
  OD-1: **Branch A selected**)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

## Ruling (2026-08-20, OD-1)

The OD-1 gate is answered: **fresh start — no live data migrates; Branch A is
selected and Branch B is dead.** The owner confirmed there is no Postgres data
with actual documents to migrate; the old Postgres schemas come over **as
design reference only** (D1 is SQLite, not Postgres — no direct import path
exists anyway; exactly this ADR's Branch A "schemas over, data doesn't").
Consequences: N20a selected, N20b and the 7-stage pipeline do not build;
G-013 closes; every domain's migration release gate becomes "schema-reference
documented + seed fixtures load"; OD-14 (password-hash import) and OD-22
(DynamoDB harvest for migration profiling) lose their Branch-B relevance
(shape-from-code suffices for G-006 unless the owner still grants access).
The Branch B section below is retained as record of the rejected alternative
only. Propagation of the ruling into the canonical ledger on
`research/nuewave-longtail` is still pending (that branch is not writable from
this worktree).

## Context

The package's migration workstream (08-DATA-MIGRATION-AND-CUTOVER.md: seven
stages through dual-run, cutover gates, decommission) and the ledger's ruling
8 contradict each other (WP-010 **CON-1**, gap G-013 "blocked/critical"):

> Ruling 8 (research/nuewave-longtail @ `13c2847`, `merge/README.md:52-56`):
> "schemas over, data doesn't — the four Postgres databases hold no live
> data."

The "four databases" are logical groupings of **one physical Postgres** (267
migrations, ~194 mechanically-derived live tables — WP-010 I1/I2). The
no-live-data premise is a production fact no repo can verify, and it silently
extends to stores ruling 8 never names: **DynamoDB ×2** (static-file metadata
— unharvested, G-006 — and `BulkUploadRequest`), **Redis**, **S3**,
**OpenSearch**, **FusionAuth grants**. OD-1 asks the owner to confirm or
enumerate. This ADR therefore fixes the *decision structure*, not one plan:
both branches are fully specified so no work is invalidated by the ruling.

## Source and ruling constraints

- Ruling 8 (2026-08-19): schemas harvested, no data migration — premise
  pending OD-1 confirmation.
- 01-AUTHORITY ground-truth order: owner ruling outranks package prose; a
  premise-breaking fact goes to the owner-decisions ledger (done: OD-1).
- 08-DATA-MIGRATION stages are the machinery for Branch B; 12-DoD's
  "data is migrated and reconciled" applies only under Branch B.
- WP-020 RPC note: kernel login fixes a **client-side argon2id scheme keyed
  on `SERVICE_SALT`** (api.ts:30) — any user import must reproduce it
  client-side or force credential reset (→ OD-14).

## Decision

**Proposed: a two-branch plan with a hard decision gate. No migration
implementation work starts until OD-1 carries a dated ruling.**

### Gate

OD-1 must state, per store (Postgres, DynamoDB ×2, Redis, S3, OpenSearch,
FusionAuth), whether live data exists. "No live data" must be asserted for
each store, not globally assumed.

### Branch A — no-live-data confirmed (ruling 8 upheld)

1. **Schema adoption, not migration**: the harvested schemas
   (`merge/schema-harvest.md`, with WP-010's corrected arithmetic: 202
   created / 8 dropped / ≈194 live; 23 live `email_*` tables) serve as
   behavioral evidence for domain modeling only. No Hyperdrive, no dual-run,
   no cutover gates, no decommission machinery.
2. **Seed and fixture program** replaces stages 1–7: deterministic seed data
   per domain, golden fixtures for parity tests, plus a small owner-directed
   export path if any stray artifacts (e.g. S3 objects) are worth carrying.
3. 12-DoD migration gates are rewritten to "seed/fixture gates" (doc change,
   recorded).
4. G-013 closes; G-006 (DynamoDB harvest) downgrades to
   "shape-from-code acceptable" unless the owner still grants access.

### Branch B — DEAD (ruled out 2026-08-20 per OD-1; retained as record only)

1. Full 08 machinery scoped to **exactly the enumerated stores**: source
   profiling, canonical identity mapping (durable, resumable, inspectable —
   old-id → new-id tables per ADR-003), transform/load with idempotency and
   checkpoints, projection rebuild (never migrate projections), shadow/
   dual-run behind one controlled adapter per domain, cutover gates,
   decommission evidence.
2. **Authorities first, projections rebuilt** (ADR-005/006/007): only
   authoritative stores migrate; index plane, search, notifications badge
   state, frecency all rebuild.
3. **Hyperdrive is transitional only** for reading the old Postgres during
   migration; it never appears in the target manifest.
4. **Credentials**: users migrate via OD-14's ruling — reproduce the argon2id
   `SERVICE_SALT` scheme client-side at first login against imported
   verifiers, or force reset. FusionAuth grants are not imported as-is
   (FusionAuth is dead by ruling); only identity/team/role facts map.
5. Per-tenant cutover with feature gates; rollback tested per domain before
   any write cutover; never two unconstrained authoritative writers.

### Common to both branches

- The DynamoDB static-file table shape (G-006) must be settled (harvest or
  shape-from-code ruling) before the file service's metadata model freezes
  (ADR-010).
- Migration/seed tooling lives in the wrapper repo, versioned, replayable.

## Alternatives considered

1. **Assume Branch A now (build nothing).** Rejected: if any pilot data
   exists, retrofitting identity mapping after domains ship is the worst-cost
   path; the gate is cheap, guessing is not.
2. **Build full 08 machinery now.** Rejected: contradicts the standing owner
   ruling and burns the first pass on machinery that may have no object
   (CON-1's explicit warning: do not run migration profiling until OD-1 is
   answered).
3. **Global "probably empty" middle path** (spot-check stores ourselves).
   Rejected: production access and the ruling are the owner's; agents cannot
   verify (WP-010 §1.3 "not verifiable from repos").

## Compatibility impact

- Branch A: none. Branch B: cutover gates bind to the parity gates of
  ADR-001/002 (API/command/UI parity must pass before any domain cutover, 08
  §6), so migration sequencing couples to the build graph (OD-4).

## State and authorization impact

- Identity mapping is authorization-critical: permission principals map
  before access projections build (ADR-004); a mis-mapped principal is a
  security bug, so mapping tables carry provenance and are reconciled
  row-count + sampled-entity checks before enabling receipts for migrated
  tenants.

## Migration and rollback

- This ADR *is* the migration plan skeleton. Rollback: Branch A — reseed;
  Branch B — per-domain rollback path is a cutover-gate precondition (08
  §6), with the old store read-only rather than decommissioned until the
  owner closes the rollback window (08 §7).

## Operational consequences

- Branch A: near-zero. Branch B: migration observability (checkpoints,
  reconciliation dashboards), owner-granted production access custody, and a
  support/runbook program per 08 §6.

## Tests and acceptance

- Gate test (both branches): the decision record exists with per-store
  answers before any `migrations/` or import tooling merges.
- Branch A: seed determinism (two seeds → identical state); fixture coverage
  per domain parity suite.
- Branch B: per-job idempotency/resume tests; reconciliation thresholds;
  authorization parity on migrated tenants (ADR-004 matrix re-run);
  interrupted-migration resume drill; rollback drill per domain.

## Follow-up decisions

- **OD-1 — RULED 2026-08-20** (see `../06-owner-decisions-needed.md` OD-1):
  fresh start, Branch A; Branch B dead. Ledger transcription pending.
- **OD-14**: moot under the Branch A ruling (gates nothing; degenerates to a
  seed-fixture detail).
- **G-006**: shape-from-code acceptable under Branch A unless the owner still
  grants harvest access.
- Store-by-store target mappings belong to
  `reports/04-target-architecture-decisions.md`.
