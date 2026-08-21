# Domain specification — Static files / unfurl / image fetching (N14 / SUP-561)

## Verdict and source evidence

Wave 4b files + media node. 05-MAP row 16: authorized file fetch and safe
unfurl pass adversarial tests. ADR-010 (files/unfurl/image) and ADR-011
(safe-fetch). OD-1 Branch A: reconstruct the unharvested DynamoDB metadata
shape from design (name, content type, `extension_data`, upload state) — no
DynamoDB, no production harvest (OD-22 degenerate). **OD-6 is still OPEN**:
unfurl and image fetch use connectivity `blockedSafeFetch` only; live
`fetch()` on request-derived URLs is forbidden. Image proxy is
defer/kill-leaning (ledger:79): no `/proxy` launderer; Cloudflare Images may
absorb it. In-memory R2 stand-in + D1-shaped metadata. No Instantly send.
No kernel patches.

## User journeys

Upload a non-Document blob (chat/email attachment stand-in) → metadata
`pending` → bytes land in the blob store → finalize (R2-event stand-in) →
`ready` → download with a receipt. A crash between PUT and finalize leaves
the row `pending` (not downloadable). Paste a link → `unfurl(url)` goes
through blocked safe-fetch and throws `od6_blocked` until OD-6. Inline
remote images call `fetchImage(url)` on the same port. There is no `/proxy`
image-laundering route.

## Invariants

Metadata and authorization never live in the byte store. A file is
downloadable only after `ready`. Deletes are authorization-checked.
**All outbound unfurl/image fetches pass connectivity `blockedSafeFetch`**
(or an injected equivalent `SafeFetch`). No feature-local live `fetch` to
user-controlled URLs. Image-proxy `/proxy` is not implemented. Unfurl/image
results carry no platform credentials. Handlers take receipts for
metadata/bytes; unfurl/image are content-laundering surfaces without
receipts. Query never mints.

## Entities and identifiers

- `static_file` (`file_`) — registry EntityType. Metadata row + opaque blob
  key.
- Unfurl cards and (future) proxied images are **not** entities.

## Authority and consistency

In-process `FilesSlice` is the single metadata writer (queue-consumer shape
per file id). `MemoryBlobStore` stands in for R2. The content-state machine
is `pending → ready` (or `failed` if finalize runs without bytes) — shared
conceptually with documents' future ObjectStorage R2 lift, not a shared
runtime yet. Physical R2 + D1 are a later lift of this shape.

## Storage and indexes

N3 `STORAGE_OWNERS` rows: `file_blob` (R2; in-memory stand-in),
`file_metadata` (D1-shaped). Metadata fields reconstructed from ADR-010:
`name`, `content_type`, `extension_data`, `upload_state`. No DynamoDB.

## RPC/API contract

Typed `FilesApi` (ADR-002). Not added to kernel `api.ts`.

- `beginUpload` / `putBlob` / `finalize` / `download` / `get` / `list` /
  `delete` / `bulkDelete`
- `unfurl(url)` / `fetchImage(url)` — SafeFetch only
- HTTP byte prefix `/files/:id` named, not served as a worker in this node
- **No** `/proxy` image route. `IMAGE_PROXY.status = deferred`

No Instantly send/activate methods.

## Commands and UI surfaces

0 direct file command rows (05-GRAPH §N14). Chrome parity:
`global.upload-files`, `global.upload-folders` (N5). React: `FileWorkspace`
/ upload form / file list on Shell path `/file` (split `files`).

## Authorization matrix

File receipts via `static_file` policy (document-like + parent inheritance).
`/files/*` delivery (later) checks view receipts. Cross-tenant mint denies.
Unfurl/image attach no credentials.

## Events, jobs, retries, and replay

Finalize is the R2-notification stand-in (idempotent per file id). Poison
uploads mark `failed`. Replay = re-run finalize after PUT. Email-attachment
orphan GC is N11/later.

## External providers

| Provider | Posture |
|---|---|
| connectivity `blockedSafeFetch` | Only egress port while OD-6 is open. |
| Cloudflare Images | May absorb image-proxy laundering; not implemented here. |
| Instantly | Out of scope. No send/activate. |

## Migration and reconciliation

OD-1 Branch A: shapes + fixture mapping dry run from reconstructed
`static_files` (DynamoDB metadata) and `s3_objects` (blob keys). No
Postgres load. No DynamoDB client. Live S3→R2 copy waits on real R2.

## Tests and parity fixtures

`packages/files/src/slice.test.tsx` — mapping dry run, pending→ready
including crash between PUT and finalize, bulk-delete, SEC-3 cross-tenant,
05-MAP row 16 adversarial suite (`localhost`, `169.254.169.254`, `file://`,
redirect-like input) all throw `od6_blocked`, no live `fetch`, IMAGE_PROXY
deferred, FileWorkspace SSR, STORAGE_OWNERS rows.

## Observability/SLOs

Upload finalize lag (in-process). Safe-fetch rejection counts (every
unfurl/image today: `od6_blocked`). Image-proxy route remains absent.

## Failure modes and rollback

`FilesError` (`not_ready`, `unknown_file`, `denied`, `missing_blob`,
`proxy_deferred`). `ConnectivityError.od6_blocked` for unfurl/image.
Wrapper rollback = previous package; kernel untouched. Safe-fetch swap when
OD-6 lands.

## Open decisions

- **OD-6** — still OPEN. Live resolver-level safe-fetch not implemented;
  blocked port is the production default.
- **Image proxy** — defer/kill-leaning; Cloudflare Images may absorb it.
  No `/proxy` in this node.
- Live R2 + R2 event notifications → Queues.
- Unfurl Cache API TTL (intentional difference vs source no-cache).
- CRM directory fallback resolver (unfurl coupling).
- Email/chat attachment GC family (N11+).
