# ADR index — WP-030 first-pass drafts

All ADRs landed as **Proposed (Draft)** on 2026-08-20; later the same day the
owner issued in-session rulings (registry of record:
`../06-owner-decisions-needed.md`) that changed several statuses — see the
"Ruled 2026-08-20" column notes below and each ADR's own status block:
ADR-001 Accepted with amendment (OD-11), ADR-003 Accepted-as-amended pending
final read (OD-7), ADR-013 Accepted, Branch A (OD-1), ADR-014 Accepted
(OD-10); ADR-002's deferral-B gate closed (OD-16), ADR-006/007's topology
ruled (OD-27), ADR-009's branch selected (OD-3).
Evidence pins used throughout: implementation worktree @
`dec12f2`, `cloudflare-os` @ `bf7f762`, Neuwave @ `9f7a26b`, decision ledger @
`research/nuewave-longtail` `13c2847` (read via `git show` only). New owner
decisions raised while drafting: `../notes/wp030-adr-owner-decisions.md`
(OD-11 … OD-15).

| ADR | Title | Proposed decision (one line) | Status / gate |
|---|---|---|---|
| [ADR-001](ADR-001-shell-strategy.md) | Custom shell vs stock/hybrid | Wrapper-owned custom React shell speaking the frozen RPC contract; bounded embeds of stock admin/approval surfaces; no frontend fork. | **Accepted with amendment** — OD-11 ruled 2026-08-20 (embed list transitional; parity bar extends to stock surfaces) |
| [ADR-002](ADR-002-api-rpc-compatibility-boundary.md) | API/RPC compatibility boundary | Freeze the kernel's 182-capability surface at `bf7f762`; new surface = wrapper-owned RPC capabilities; HTTP reserved for webhooks/OAuth/files/streaming/`.well-known`. | Draft — OD-12; deferral B **closed** (OD-16 ruled 2026-08-20, kernel flow direct); C3 open |
| [ADR-003](ADR-003-entity-registry-and-identifiers.md) | Entity registry and canonical identifiers | Single registry authoritative for existence/type/tenant/tombstone; opaque type-tagged TEXT ids; 16/10/413 vocabularies adopted, TASK/THREAD via OD-7. | **Accepted-as-amended pending final read** — OD-7 ruled 2026-08-20 (task = document facet; thread = EmailThread); 1a id-format rider open |
| [ADR-004](ADR-004-authorization-receipts.md) | Authorization receipts and policy model | First-class `authz` package: unforgeable typed receipts + per-type policy modules recreating entity_access semantics; SEC-1/2/3 fixed, not recreated; explicit read-side enforcement. | Draft |
| [ADR-005](ADR-005-storage-ownership-rules.md) | DO/D1/R2/KV/Queue/Workflow ownership rules | Single authority per fact; no unowned D1 writes (ownership manifest, CI-enforced); outbox+idempotency at every async boundary; leases/Redis do not port. | Draft |
| [ADR-006](ADR-006-soup-and-materialized-indexes.md) | Soup and cross-entity materialized indexes | One required materialized-index plane (D1, single projector) serving Soup, favorites, property filters, access filtering; RPC query capability; rebuildable by contract. | Draft — topology ruled (OD-27, 2026-08-20: one plane, two schema families); may finalize |
| [ADR-007](ADR-007-seven-entity-type-search.md) | Seven-entity-type search | 7-entity-type coverage contract on one logical index; D1 FTS5 (+ optional Vectorize) behind a single search projector; enrichment from the index plane; golden-query gate. | Draft — OD-2, OD-15; topology ruled (OD-27, 2026-08-20) |
| [ADR-008](ADR-008-sync-and-collaboration.md) | Sync and collaboration | Two CRDT planes kept: lifted Loro sync-service for document content (ruled Lift), kernel Yjs V2 draft/merge/revert trio for workspace code; explicit read-only bridges only. | Draft — OD-13 |
| [ADR-009](ADR-009-notifications-and-realtime.md) | Channels, notifications, realtime | Per-user notification authority + typed 19-type catalog; in-app (kernel session push, per C1) and email digests in pass 1; mobile push conditional on OD-3; typed realtime event union replaces the gateway's free-form strings. | Draft — OD-3 ruled 2026-08-20 (kept: in-app + email digests; push deferred); stale "Drop" overruled |
| [ADR-010](ADR-010-files-unfurl-image-external-fetch.md) | Safe file, unfurl, image, external fetch | R2 bytes + single-owner D1 metadata (DynamoDB semantics recreated); unfurl as RPC card via safe-fetch; Cloudflare Images replaces image_proxy+image_optimizer; all external fetches through safe-fetch. | Draft — G-006 harvest; laundering-path owner call |
| [ADR-011](ADR-011-ssrf-controls.md) | SSRF controls on Workers | One safe-fetch capability: DoH resolve → validate private ranges → connect-time IP pinning, re-validated per redirect hop; fail closed; egress-container escape hatch; no feature-local fetches. | Draft — the OD-6 proposal |
| [ADR-012](ADR-012-self-hosted-converter-boundary.md) | Self-hosted converter boundary | LibreOffice + ffmpeg on an isolated Cloudflare Container behind a DO-orchestrated queue capability; R2-only egress; explicitly not a default pattern; Media Transformations option kept live for ffmpeg. | Draft — OD-8, OD-2 |
| [ADR-013](ADR-013-migration-and-cutover.md) | Migration and cutover | Dual-branch plan gated on OD-1: Branch A (no live data, ruling 8) = schema adoption + seeds; Branch B (live data) = full 08 machinery scoped to enumerated stores; no migration work before the dated ruling. | **Accepted** — OD-1 ruled 2026-08-20 (Branch A; Branch B dead); OD-14 moot |
| [ADR-014](ADR-014-kernel-change-budget.md) | Kernel-change and upstream-patch budget | Budget binding from wave 0; zero carried patches default; extension ladder before any patch; SUP-536 parked pending retroactive admission; per-wave upgrade rehearsal against pin `bf7f762`. | **Accepted** — OD-10 ruled 2026-08-20 (zero-patch budget bound from wave 0) |

## Cross-cutting notes

- Per-domain design choices deliberately live in
  `../04-target-architecture-decisions.md` (sibling WP-030 deliverable); these
  ADRs stay at cross-cutting altitude.
- The four deliberate exceptions (MCP server in pilot; ungoverned OpenAI
  proxy; seven-source search; self-hosted converter) are treated as controlled
  owner decisions throughout; ADR-007 and ADR-012 carry the governance docs
  for two of them, and OD-2 (recording all four in the ledger) remains open.
  The MCP-server and OpenAI-proxy exceptions did not need their own ADRs in
  this set: they are scope rulings, not architecture decisions — their
  boundary documentation rides with the connectivity and model-layer domain
  designs.
