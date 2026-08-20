# WP-030 ADR drafting — NEW owner decisions (mergeable list)

Source: `reports/adrs/` (2026-08-20). Continues the numbering from
`wp000-owner-decisions.md` / `wp010-owner-decisions.md` (OD-1 … OD-10 exist);
this file adds **OD-11 … OD-15**. Existing decisions are referenced by the
ADRs, not restated here. Merge into `reports/06-owner-decisions-needed.md`
when created.

---

## OD-11 — Shell strategy sign-off (ADR-001)

- **Evidence:** 04-TARGET requires the stock-vs-custom shell decision as an
  ADR and says the owner's end goal points toward a custom shell but the
  first pass must estimate compatibility cost. ADR-001 carries that estimate
  (379 static commands + 4 runtime markers, 27 routes, 52 split
  registrations, 16 blocks; kernel shell has no splits/Soup/blocks/leader
  scopes).
- **Decision needed:** ratify the wrapper-owned custom shell, and approve the
  proposed embed list for stock surfaces (admin configuration, approval
  queue, gadget/workpiece iframes) vs recreating them.
- **Impact:** fixes the largest single UI workstream and the wave-1 shell
  slice; embeds reduce cost but bind those surfaces to kernel upgrades.
- **Blocked work:** shell package scaffolding; command-registry
  implementation start; WP-040 slice UI.

## OD-12 — RPC freeze details: names, Access-mode auth, Cloudflare-limits trio, dynamic-surface scope (ADR-002)

- **Evidence:** `reports/notes/wp020-rpc-coverage.md` — (a) `TODO(multi-gadget)`
  renames exist in kernel source (`openGadget`→`openWorkspace`,
  `newGadget`→`newWorkspace`, `GadgetMetadata`→`WorkspaceMetadata`,
  `defaultGadgetId` backfill); (b) 4 ledger rows are `needs-review`:
  `PublicApi.authenticateFromCfAccess` (only meaningful behind Cloudflare
  Access) and the `getCloudflareUsage`/`listCloudflareAccounts`/
  `selectCloudflareAccount` limits/top-up flow; (c) per-vendor gatekeeper
  session contracts (19 packages) and per-gadget `connectToGadget` facets are
  outside the 182-row freeze.
- **Decision needed:** (a) freeze current names (recommended) or adopt the
  renames with aliases pre-freeze; (b) keep-live / keep-disabled / defer for
  Access-mode auth and the limits trio in the Neuwave deployment; (c) order
  per-vendor/per-gadget contract inventories or rule them out of scope for
  pass 1.
- **Impact:** the freeze baseline the whole compatibility program tests
  against; renaming after the freeze is a breaking-change process.
- **Blocked work:** publishing the frozen contract-test suite; admin/auth
  deployment configuration.

## OD-13 — Two-CRDT-plane ruling: lifted Loro sync-service + kernel Yjs trio coexist (ADR-008)

- **Evidence:** sync-service ruled **Lift as-is (2026-08-19)** (ledger @
  `13c2847`; Loro CRDT, WASM exception); the kernel at `bf7f762` ships its
  own Yjs V2 workspace-code doc with the draft/merge/revert trio
  (`api.ts:1355-1372, 1540-1560, 2370-2376`) inside the frozen 182 surface.
  Neither ruling permits collapsing one into the other.
- **Decision needed:** ratify the two-plane posture — Loro for document
  content, kernel Yjs for workspace code; no convergence work in pass 1 —
  and set the sync-session revocation-latency policy (how fast a receipt
  revocation must terminate live sync sessions).
- **Impact:** prevents a plausible-but-ruling-violating "unify collaboration"
  workstream; fixes the documents content-location integration and the
  extraction bridge for search.
- **Blocked work:** documents domain spec (content locations); sync mount
  integration (L1 `/sync`); search `extract_sync` successor.

## OD-14 — Credential migration contract under a live-data ruling (ADR-013, Branch B only)

- **Evidence:** kernel `login`/`createAccount`/`changePassword` fix a
  client-side argon2id scheme keyed on `SERVICE_SALT` (api.ts:30;
  `reports/notes/wp020-rpc-coverage.md`). FusionAuth is dead by ruling; if
  OD-1 finds live users, their credentials/identities must cross.
- **Decision needed:** for Branch B: reproduce the argon2id/`SERVICE_SALT`
  scheme client-side against imported verifiers, or force a credential reset
  for all migrated users. (Moot under Branch A.)
- **Impact:** user-facing cutover experience and the auth domain's import
  design; a reset is simpler and safer, a scheme port preserves sessions.
- **Blocked work:** none until OD-1 resolves to Branch B; then auth-domain
  migration design.

## OD-15 — Search substrate election checkpoint (ADR-007)

- **Evidence:** ledger search rows (@ `13c2847`) leave the substrate open
  ("D1 FTS5 + Vectorize" named as candidates; "rule with
  search_processing_service — one system"); WP-010 corrected the
  "seven-source" framing to a 7-entity-type coverage contract with a
  golden-query parity gate; OpenSearch does not come along.
- **Decision needed:** after a prototype runs the golden-query gate, ratify
  D1 FTS5 (+ optional Vectorize semantic add-on) as the index substrate, or
  redirect to a dedicated external index; also set the accepted ranking
  tolerance band (BM25 vs FTS5 ranking will differ).
- **Impact:** the one substrate slot shared by search and the required
  materialized-index layer (1a rider); a late change re-opens the index
  plane. May be folded into the OD-5 batch-ruling session.
- **Blocked work:** search projector implementation beyond prototype;
  golden-query tolerance definition.

---

Also re-flagged for the OD-5 batch (not new numbers): Redis successor mapping
ratification (ADR-005), the frecency/activity-vocabulary/DLP/analytics-proxy/
channel-bot missing rows, and the ADR-010 question of whether the
arbitrary-URL image-laundering path survives the mailbox rebuild.
