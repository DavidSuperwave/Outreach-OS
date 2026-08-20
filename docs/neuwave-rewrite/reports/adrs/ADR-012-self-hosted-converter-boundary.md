# ADR-012 — Self-hosted converter boundary (LibreOffice + ffmpeg)

- Status: Proposed (Draft — owner decides; this is the OD-8 design proposal)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

## Context

Two media-substrate components cannot run on Workers (verified, WP-010 §2.7):

- **convert_service** (Neuwave @ `9f7a26b`, 1,365 LOC): embeds LibreOffice
  via `rs-libreoffice-bindings` (macro-inc git dep pinned `056a40d`) over
  Collabora `core-co-25.04` assets, with the MS core-fonts EULA accepted in
  `docker/Dockerfile.convert_service:38-40`. 3 internal/service-key endpoints
  (`POST /internal/convert`, `POST /internal/backfill/docx`, health), also
  queue-drivable (`ConvertQueueMessage` with `job_id`); jobs are
  bucket→bucket `{from_bucket, to_bucket, from_key, to_key}`. It is the
  producer of `DocumentContentLocation::ConvertedPdf`
  (`crates/documents/src/domain/content.rs:26-38`) — the DOCX half of the
  documents content model, not a side utility.
- **ffmpeg**: only in `services/call_recording_preview_handler` (S3-triggered
  Lambda) for call-recording previews; calls are ruled keep.

"The self-hosted converter remains" is deliberate exception 4
(01-AUTHORITY), a controlled owner decision pending ledger recording (OD-2).
The ledger's convert row (research/nuewave-longtail @ `13c2847`) says: no
Workers-native successor; rule with ffmpeg and the documents content model.

## Source and ruling constraints

- 01-AUTHORITY §Deliberate exceptions: the exception must document boundary
  and owner; threat and failure model; observability; deployment and
  rollback; and why it does not become the default pattern for adjacent
  features. This ADR is that documentation for the substrate half.
- 04-TARGET primitive guide: Browser Rendering for browser/PDF rendering;
  "keep the deliberate self-hosted converter exception isolated if it
  remains."
- Rulings 3a/4a: queue-driven, idempotent jobs; DO-orchestrated, no pollers.
- Tripwires: no Rust reuse — the *binding crate* does not port; the packaged
  LibreOffice/Collabora runtime is infrastructure, not product Rust, and is
  the thing the exception preserves.

## Decision

**Proposed: one isolated "media conversion substrate" on Cloudflare
Containers, honoring the exception, with a hard capability boundary.**

1. **Substrate**: a Cloudflare Container image carrying LibreOffice
   (Collabora core assets + MS core fonts, EULA accepted in the image build,
   exactly as the source image does) and ffmpeg — one container family, two
   job types (doc-convert, media-preview). No product logic in the container:
   it is a pure `{input R2 key} → {output R2 key}` transformer.
2. **Boundary**: reachable **only** via a converter capability owned by a
   wrapper orchestrator DO (4a): jobs enqueue with `job_id` idempotency keys,
   the DO drains/dispatches, the container reads/writes R2 via scoped,
   short-lived credentials for exactly the two keys. No inbound public route;
   no outbound network from the container except R2 (egress locked — this is
   the threat-model core: LibreOffice parsing hostile DOCX is the largest
   attack surface in the platform, so it runs blind and boxed).
3. **Consumers**: documents (`ConvertedPdf` production, docx backfill) and
   calls (recording previews). Both treat conversion as async projection
   work: failure marks the derived artifact unavailable, never corrupts the
   authority.
4. **Non-default clause** (required by 01-AUTHORITY): the container substrate
   is *only* for binary/native codecs with no Workers path. Browser
   Rendering covers HTML/PDF rendering needs; Cloudflare Images covers
   raster transforms (ADR-010). Any new container proposal requires its own
   ADR — this exception does not generalize.
5. **ffmpeg alternative kept live**: if Cloudflare Media Transformations
   covers the preview formats needed, the media-preview job type moves there
   and the container keeps only LibreOffice (decision point recorded for the
   domain doc; substrate interface identical either way).

## Alternatives considered

1. **External conversion API (e.g. CloudConvert).** Rejected as default:
   weakens "self-hosted" (the exception's point), sends user documents to a
   third party (data-boundary change requiring its own owner ruling), adds
   an availability dependency.
2. **Drop DOCX rendering.** Contradicts the standing exception; only the
   owner can reverse it (OD-2/OD-8).
3. **WASM LibreOffice in Workers.** Not real at current scale
   (size/memory/runtime limits); revisit only if the platform changes.
4. **Keep an off-Cloudflare VM/ECS remnant.** Rejected: ruling 2 — nothing
   keeps running on AWS.

## Compatibility impact

- Conversion fidelity is the parity surface: golden DOCX→PDF fixtures
  (metrics-correct fonts — hence the EULA fonts in-image) and
  recording→preview fixtures with deterministic failure reporting (05-MAP
  converter proof).
- The internal-only surface means no public API compatibility burden; the
  documents content-location contract (5 locations incl. ConvertedPdf) is
  preserved (ADR-008/documents domain).

## State and authorization impact

- The container owns no state; the orchestrator DO owns job state
  (idempotency, attempts, poison per 3a); R2 outputs are derived artifacts
  under the file/document domain's authorization (receipts gate delivery,
  ADR-004/ADR-010).
- Scoped R2 credentials per job; no standing keys in the container.

## Migration and rollback

- Backfill (`/backfill/docx` successor) is a bulk DO+alarm job over existing
  documents — OD-1 Branch B only; Branch A has nothing to backfill.
- Rollback: container image versions pinned; a bad image rolls back
  independently; derived artifacts regenerate idempotently. Kill switch:
  disabling the capability degrades to "preview unavailable", never data
  loss.

## Operational consequences

- One container fleet to size, patch (LibreOffice CVEs — patch cadence is an
  operational commitment of the exception), and observe (job latency,
  failure taxonomy, queue depth).
- Cost model differs from Workers (always-warm vs per-job cold start) —
  capacity notes required in the domain doc.
- Fonts EULA acceptance is a licensing fact recorded here, as in the source
  image.

## Tests and acceptance

- Golden conversion fixtures (DOCX→PDF incl. font metrics; recording→
  preview) with deterministic failure reporting.
- Isolation tests: container cannot reach the network beyond R2; hostile
  fixture (malformed DOCX) fails the job without breaching the boundary.
- Idempotency: same `job_id` re-enqueued → no duplicate work/output.
- Chaos: kill container mid-job → job retries; poison marks-and-skips.

## Follow-up decisions

- **OD-8 (existing)**: owner ratifies container substrate for converter, and
  chooses ffmpeg-in-container vs Media Transformations.
- **OD-2 (existing)**: record the exception (with this boundary doc) in the
  ledger.
- Preview formats, job taxonomy, and capacity sizing belong to
  `reports/04-target-architecture-decisions.md`.
