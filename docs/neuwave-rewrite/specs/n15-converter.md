# Domain specification — Converter + media (N15 / SUP-562)

## Verdict and source evidence

Wave 4c substrate node. Deliberate exception 4 (OD-2, ruled 2026-08-20): the
self-hosted converter remains as an isolated Cloudflare Container boundary
per ADR-012. 05-MAP row 17: golden conversion fixtures with deterministic
failure reporting. This wrapper implements the **in-process orchestrator +
golden fixtures**, not a live container (no Cloudflare quota). LibreOffice /
Collabora / ffmpeg stay named as the realistic substrate; they are not
booted here. Instantly is out of scope. No kernel patches. No
`cloudflare-os/` edits.

Source: `services/convert_service` (queue-drivable `ConvertQueueMessage` with
`job_id`; bucket→bucket `{from_key, to_key}`); producer of
`DocumentContentLocation::ConvertedPdf`. ffmpeg lives only in
`call_recording_preview_handler` (N13 consumer).

## User journeys

Upload / attach a DOCX → orchestrator enqueues a `doc-convert` job → drain
runs the container port → derived PDF lands at `toKey` and
`ConvertedPdfPort.attach` returns `{ location: "ConvertedPdf", body, sha }`.
The named golden fixture `GOLDEN_DOCX_V1` always yields
`PDF:` + sha256(input). A hostile `POISON_DOCX` fails with `convert_failed`;
the document authority and source blob are untouched. Call-recording
`preview()` / `media-preview` jobs exist as a type; without an elected
MediaTransform port they throw `preview_unsupported` (OD-8). Re-enqueue of
the same `job_id` is a no-op.

## Invariants

The converter never holds authority over any entity — pure
`{input bytes} → {output bytes}` (live shape: `{input R2 key} → {output R2
key}`). Failures are first-class job results; they never corrupt the source
document. Same `job_id` is idempotent. No inbound public HTTP route. No
outbound network from the container except the blob store (in-process: no
`fetch(` in converter src except comments). `ConvertedPdfPort.attach` **must
invoke** the supplied converter (N7's stub ignored it). 0 command rows.
Duplicate drain of a terminal job is a no-op.

## Entities and identifiers

None owned. Job records (`job_id`) live on the orchestrator DO; ConvertedPdf
artifacts are derived under the documents content-location model (N7).
Call-preview outputs are derived under N13. Job types:
`doc-convert` | `media-preview`.

## Authority and consistency

In-process `ConverterSlice` stands in for the wrapper orchestrator DO (4a):
serialized enqueue / drain / apply. `MemoryBlobStore` stands in for R2.
`ContainerPort` is a pure transformer — it never sees keys, credentials, or
the network. Physical Cloudflare Container + scoped per-job R2 credentials
are a later lift of this shape. Concurrent writers are queue parallelism;
duplicates collapse on `job_id`.

## Storage and indexes

Local constant `CONVERTER_STORAGE = { name: "converter_jobs", kind: "queue" }`
(`owner: converter.ConverterSlice`). Parent copies this row into N3
`STORAGE_OWNERS`. R2 blobs are derived artifacts under documents/files, not
owned here. No D1. No projection indexes.

## RPC/API contract

Typed `ConverterApi` (ADR-002 pattern). Not added to kernel `api.ts`. No
public HTTP. Source `POST /internal/convert`, `POST /internal/backfill/docx`,
and `/health` are **not** exposed (`CONVERTER_PUBLIC_ROUTE = null`). Surface:
`enqueue` / `drain` / `apply` / `preview` / `get` / `list`, plus
`ConvertedPdfPort.attach`. No Instantly send/activate methods.

## Commands and UI surfaces

0 command rows (`CONVERTER_COMMAND_IDS = []`). Chrome is N7/N13 consumers
(`go-to.documents`, `go-to.calls`, ConvertedPdf viewer, call preview). React:
`ConverterWorkspace` / `JobList` on Shell path `/documents` with
`data-slice="converter"` and `data-surface="converter.jobs"`, showing job
states and golden/poison labels. No Macro branding.

## Authorization matrix

Not reachable from users. The container accepts jobs only from the
orchestrator (no inbound internet). Live: R2 credentials scoped to the two
keys per job. Receipts that gate ConvertedPdf delivery live on documents
(ADR-004 / ADR-010), not here.

## Events, jobs, retries, and replay

Job in → transform → `succeeded` or `failed{reason}`. `job_id` idempotency.
Poison / hostile DOCX = `convert_failed`, mark-and-skip, no output blob.
Replay = re-enqueue by `(input sha, converter version)` — safe because
outputs are derived. Conversion is deterministic; this node does not retry
transient container churn (live: retry once then poison per ADR-012).
`media-preview` without a MediaTransform port throws `preview_unsupported`
rather than silently succeeding.

## External providers

| Provider | Posture |
|---|---|
| Cloudflare Container (LibreOffice / Collabora core-co-25.04 + MS core fonts EULA) | Named substrate. **Not booted** in this node. In-process `goldenContainer()` stand-in. |
| ffmpeg in the same container family | OD-8 option A. Not elected. |
| Cloudflare Media Transformations | OD-8 option B. Same `MediaTransformPort` interface. Not elected. |
| Instantly | Out of scope. No send/activate. |

## Migration and reconciliation

OD-1 Branch A: ConvertedPdf artifacts are derivative — **regenerate, never
migrate**. Identity-mapping dry run is not required (no owned entities).
Backfill (`/backfill/docx` successor) is a bulk DO+alarm job over existing
documents when a live container exists; not implemented here.

## Tests and parity fixtures

`packages/converter/src/slice.test.tsx` — golden `GOLDEN_DOCX_V1` →
`PDF:`+sha256; poison `POISON_DOCX` → `convert_failed` with no output blob
and intact source; `job_id` idempotency; no public route; no `fetch(` in src
except comments; OD-8 `preview_unsupported` for `preview()` / media-preview
without MediaTransform; ConvertedPdfPort invokes converter then
enqueue+drain; ConverterWorkspace SSR; `CONVERTER_STORAGE` local constant
(parent wires `ownerOf`); 0 command rows.

## Observability/SLOs

In-process: job state + attempts + error class. Live SLOs (not measured
here): conversion p95 by size class; failure rate by reason class; container
health/restart; queue age. Target p95 < 30s for ≤10MB docx (04-TARGET §17).
Extract-failure rate is this node's named metric once the container is live.

## Failure modes and rollback

`ConverterError`: `convert_failed`, `preview_unsupported`, `missing_blob`,
`unknown_job`. Kill switch: disable the capability → "preview unavailable" /
ConvertedPdf missing, never data loss. Live rollback = previous pinned
container image; outputs are immutable and regenerable. Wrapper rollback =
previous package; kernel untouched.

## Open decisions

- **OD-8** — still OPEN for this node. ffmpeg-in-container vs Cloudflare
  Media Transformations. Interface (`media-preview` job type +
  `MediaTransformPort`) is identical either way; without a port,
  `preview_unsupported`.
- Live Cloudflare Container (LibreOffice/Collabora, scoped R2 credentials,
  egress lock, CVE patch cadence). Not in this node.
- Fonts EULA acceptance in the image build (source
  `docker/Dockerfile.convert_service:38-40`). Required for metric-tolerant
  golden PDF parity; not accepted here.
- Font-metric / pixel-tolerant comparison vs the in-process
  `PDF:`+sha256 byte stand-in.
- Capacity sizing (always-warm vs per-job cold start) for the container
  fleet.
