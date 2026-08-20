# ADR-010 — Safe file, unfurl, image, and external-fetch behavior

- Status: Proposed (Draft — owner decides; SSRF mechanism per ADR-011/OD-6)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

## Context

Four related surfaces at Neuwave @ `9f7a26b`
(ledger rows 77–79 @ research/nuewave-longtail `13c2847`; WP-010 §2.6):

- **static_file_service** (1,966 LOC): generic blob storage for everything
  that is not a Document. 6 endpoints ×2 mounts (`/api` + `/internal`),
  presigned-PUT → S3-event → `mark_uploaded` pending→ready lifecycle, CDN
  `GET /file/{id}`. **Metadata lives in DynamoDB** (`src/config.rs:22`) — a
  second, unharvested non-Postgres store (name, content type,
  `extension_data JSONB`, upload state for every static file). Couplings:
  email/chat attachments, image-optimizer derivative keys.
- **unfurl_service** (1,446 LOC): link preview cards (OG/Twitter tags), 8s/3s
  timeouts, redirect limits, content-type checks, streaming size cap, **no
  cache layer** (verified absence), DNS-resolving SSRF guard
  (`src/http_safety/mod.rs:91-115`); also the CRM domain-directory fallback
  resolver. `/proxy` path collides with image_proxy's `/proxy`.
- **image_proxy_service** (1,160 LOC): **does not transform images** — a
  streaming CORS/hotlink/referrer-laundering fetch (10 MB cap enforced on
  Content-Length and during streaming, 15s/5s timeouts, manual redirects max
  5 re-validating each hop, spoofed desktop UA, immutable 1y cache header);
  used mainly for inline remote email images. Resizing is the separate
  `image_optimizer` Lambda (CloudFront derivative keys).
- Static-file metadata migration/parity is blind until the DynamoDB shape is
  harvested (G-006, owner access needed).

## Source and ruling constraints

- Route ruling R3: card/metadata APIs are RPC; **raw byte paths are
  HTTP-required** (file delivery, proxy streams).
- Ledger image_proxy row: Cloudflare Images/Image Resizing is a direct
  replacement absorbing the image_optimizer Lambda (two items collapse into
  one decision). Path collision dissolves under R3 distinct prefixes.
- SSRF: one shared ruling across unfurl/image/webhooks/connectors (OD-6,
  ADR-011); parity bar is resolver-level filtering.
- 04-TARGET: R2 for blobs, metadata and authorization separate.

## Decision

**Proposed:**

1. **Files**: one wrapper file service — R2 for bytes; metadata in a D1 table
   owned by the file service (recreating the DynamoDB record's semantics:
   name, content type, extension data, upload state); upload lifecycle
   pending→ready via R2 presigned/direct upload + completion callback or
   reconciliation alarm (replacing the S3-event hop). Byte delivery via an
   HTTP route that checks receipts then streams from R2 (no public-bucket
   pattern); derivative keys (thumbnails) via Cloudflare Images, stored under
   distinct prefixes with provenance metadata (ADR-005 rule 3).
2. **Unfurl**: an RPC card method (+ bulk) executing through the shared
   safe-fetch capability (ADR-011); behavior parity: OG/Twitter parsing, size
   caps that distrust Content-Length, redirect limits, timeout budget. The
   pin-verified **no-cache** behavior is *improved deliberately*: a bounded
   KV/Cache-API TTL cache is allowed (recorded as an intentional difference —
   caching a preview card is not a semantics change), owner can strike it.
   The CRM fallback-resolver coupling is preserved as an internal capability.
3. **Image fetching**: replace image_proxy + image_optimizer with
   **Cloudflare Images / Image Resizing** for transformation, plus a minimal
   safe-fetch streaming route for the laundering role where it must remain
   (inline remote email images). Whether the arbitrary-URL laundering path
   survives at all is an explicit owner question (the ledger notes it may be
   droppable after the mailbox rebuild) — until ruled, keep it, behind
   ADR-011 controls.
4. **All external fetches** (unfurl, image fetch, webhook delivery, connector
   calls, avatar/favicon fetches) go through the single safe-fetch capability
   — no feature-local `fetch` to user-controlled URLs. Distinct route
   prefixes end the `/proxy` collision.

## Alternatives considered

1. **R2 metadata via custom object metadata only (no D1).** Rejected:
   query/bulk-delete/GC needs an indexable store; authorization must live
   outside R2 (04-TARGET).
2. **Keep a DynamoDB-shaped KV store for file metadata.** Rejected: KV is
   read-mostly (ADR-005); upload-state transitions are writes needing an
   owner.
3. **Rebuild image_proxy as-is and keep image_optimizer separately.**
   Rejected: the platform substitute is strictly more capable and collapses
   two components (ledger row); the UA-spoofing laundering behavior is
   preserved only where product-required, not as a general capability.

## Compatibility impact

- File lifecycle semantics (pending→ready, bulk delete, presigned upload) and
  attachment couplings (email/chat) are the parity surface; exact REST shapes
  collapse into RPC per R3.
- Unfurl card fields and fallback behavior preserved; cache addition recorded
  in the parity matrix as intentional.
- Image URLs: derivative-key format changes (CloudFront keys → Images
  variants); any persisted old derivative URLs must be re-resolved (migration
  note below).

## State and authorization impact

- File metadata D1 table single-owned by the file service; bytes in R2 keyed
  opaquely; receipts checked on every metadata read and byte fetch
  (entity-attachment linkage decides the governing entity receipt).
- Unfurl/image fetch results carry no authorization: they are
  content-laundering surfaces and must never attach platform credentials to
  outbound requests (ADR-011 invariant).

## Migration and rollback

- **Blocked partially by G-006/OD-1**: the DynamoDB table shape must be
  harvested (owner/production access) before Branch B migration or exact
  parity claims. Branch A: schema adoption from the harvested shape + code
  reading.
- Rollback: file service is additive; byte routes versioned; derivative
  regeneration is idempotent (re-run Images transforms).

## Operational consequences

- R2 lifecycle rules for orphan GC replace the `email_sfs_delete_handler`
  Lambda family (retention family design in the domain doc).
- Egress volume through safe-fetch becomes a metered, observable choke point
  (deliberate: that is where SSRF telemetry lives).
- Cloudflare Images is a billed product; usage budget stated at design time.

## Tests and acceptance

- Adversarial fetch suite (shared with ADR-011): private-IP hosts, redirect
  to internal, lying Content-Length, slow-loris, oversized bodies — all fail
  closed. 05-MAP proof: "authorized file fetch and safe unfurl pass
  adversarial tests."
- Lifecycle: upload → ready → fetch → bulk-delete → GC, with receipt checks
  at each read.
- Unfurl golden cards for fixture URLs; CRM fallback resolution parity.
- Image parity: inline email image renders via the new path; derivative
  request produces correct variant.

## Follow-up decisions

- **OD-6 (existing)**: safe-fetch mechanism ruling (ADR-011).
- **G-006 harvest**: owner grants DynamoDB read access or rules the shape
  adopted from code only (ties to OD-1).
- Owner call: does arbitrary-URL image laundering survive post-mailbox
  rebuild? (flagged droppable in the ledger; keep-until-ruled here).
- Attachment GC/retention family details belong to
  `reports/04-target-architecture-decisions.md`.
