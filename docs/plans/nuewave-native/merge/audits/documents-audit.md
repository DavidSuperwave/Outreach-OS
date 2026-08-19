# Domain audit — documents (the core artifact)

> Created 2026-08-19 by the **research pass** (highest-leverage row 1 of 6).
> Status: research only. **No verdict** — the ledger row stays `◐` until
> David rules. Pointers: `[NW]` = `DavidSuperwave/Neuwave` @
> `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`, `[CF]` = the `cloudflare-os`
> submodule; `path:line` from each clone root. Facts from code at the pin
> only. Rulings D1/D2/D3/D4, R3, A2, C1/C2 are cited, never re-argued.
>
> **Headline for the ledger:** `documents` is not one capability. It is the
> polymorphic core entity (18,653 LOC / 76 files) with **five creation
> flavors**, **two different content substrates** — one of which is the
> already-lifted `sync-service` — and a **separate annotation stack** that
> the ledger currently carries as unrelated `◐` rows. Sizing or ruling it as
> a single row will under-scope it. See §G.

## A. Endpoints

### A1. Hex router — `crates/documents`, mounted at `/documents` in DSS
(`[NW] services/document_storage_service/src/api/mod.rs:123-131`; router
`crates/documents/src/inbound/axum_router.rs:217-320`)

Twelve paths are behind an `ensure_document_exists` middleware that loads
`DocumentBasic` into request extensions and 404s on miss
(`axum_router.rs:281-286, 325-340`) — a per-request existence+load hop that
the D1/1a **entity registry** is the natural replacement for.

| Method | Path | Behavior |
|---|---|---|
| GET/PATCH/DELETE | `/documents/{id}` | Fetch / edit metadata / soft-delete (`:226-231`) |
| GET | `/documents/{id}/location_v3` | Resolve content location — the substrate router, see §B2 (`:232-235`) |
| GET | `/documents/{id}/branch_name` | Task → git branch name (`:236-239`) |
| GET | `/documents/{id}/github_prs` | PRs attached to a task document (`:240-243`) |
| GET | `/documents/{id}/short_id` | Short-id lookup (`:244-247`) |
| POST | `/documents/{id}/copy` | Copy (`:248-251`) |
| GET | `/documents/{id}/duplicates` | Task duplicate matches (`:252-255`) |
| POST | `/documents/{id}/duplicates/dismiss` | Dismiss match set (`:256-259`) |
| POST | `/documents/{id}/duplicates/{match_id}/delete_this` | Resolve a duplicate by deleting this side (`:260-263`) |
| GET | `/documents/{id}/cached_snapshot_url` | Signed snapshot URL (CloudFront — see §B3) (`:264-267`) |
| PUT | `/documents/{id}/snapshot` | Write snapshot (`:268-271`) |
| GET/PUT | `/documents/{id}/team_share` | Read/set team-wide share (`:272-276`) |
| GET | `/documents/slug/{slug}` | Team-slug resolution (`:285-288`) |
| POST | `/documents/` | Create (`:289-292`) |
| POST | `/documents/create_task` | Create **task** flavor (`:293-296`) |
| POST | `/documents/similarity_search` | Task similarity search (`:297-300`) |
| GET | `/documents/system_skills` | List built-in skills (`:301-304`) |
| POST | `/documents/create_markdown` | Create **markdown** flavor — `#[cfg(feature = "document_create")]` (`:308-311`) |
| POST | `/documents/create_snippet` | Create **snippet** flavor — same feature gate (`:312-315`) |
| POST | `/documents/create_skill` | Create **skill** flavor — same feature gate (`:316-319`) |

**Coverage note:** the last three are behind a Cargo feature flag. Whether
`document_create` is enabled in the deployed DSS build was **not verified**
— the flag's default and the deploy profile were not read.

### A2. DSS-native document routes merged onto the same prefix
(`[NW] services/document_storage_service/src/api/documents/mod.rs:49-62`)

Three more routes are `.merge`d onto `/documents` from the service itself,
not the crate — so the real `/documents` surface is **25 paths, from two
different codebases**:

| Method | Path | Behavior |
|---|---|---|
| GET | `/documents/` | User's documents list (collides with the crate's `POST /` on the same path) |
| GET | `/documents/starter_docs` | First-run starter documents |
| GET | `/documents/list` | Document list |

### A3. Route-model finding (affects R3/A2, not a re-argument)

DSS mounts its whole router **twice** — bare at the origin root and again
under `/dss` (`[NW] services/document_storage_service/src/api/mod.rs:290-291`).
Every path in this audit therefore answers at both `/documents/...` and
`/dss/documents/...`. Under R3 (RPC-first via `/api`) this duplication has
no successor and simply disappears; recorded here so the collision register
is not surprised by two live spellings of every DSS path.

### A4. Agent toolset

`crates/documents/src/inbound/toolset/` exposes five agent tools:
`create_document`, `edit_document`, `read_content`, `read_metadata`,
`rename_document` (`toolset/mod.rs` + one file each). Under the ruled
ai_toolset treatment these become Gatekeeper session APIs; the **frozen
ai_toolset invariant** applies, so the five names/shapes are the contract to
map piece-by-piece.

## B. Storage model

### B1. Tables (all in the one physical Postgres, `0001_baseline.sql`)

The document family is **15 tables**, all created in the Prisma-legacy
baseline with quoted PascalCase names:

| Table | Role | Pointer |
|---|---|---|
| `Document` | The row: `id TEXT` (uuid default), `name`, `owner`, `fileType`, `branchedFromId`, `branchedFromVersionId`, `documentFamilyId`, `projectId`, `uploaded`, soft-delete `deletedAt` | `0001_baseline.sql:325-341` |
| `DocumentFamily` | Branch family grouping | baseline |
| `DocumentInstance` | **Versions.** `revisionName`, `documentId`, `sha` | `:415-427` |
| `DocumentInstanceModificationData` | Per-version JSONB modification data + two PDF migration stamps | `:428-441` |
| `DocumentBom` / `BomPart` | Docx bill-of-materials: parts addressed by `sha` + `path` | `:442-461` |
| `DocumentProcessResult` / `JobToDocumentProcessResult` | Async job output keyed by `jobType` | `:462-470` |
| `DocumentText` / `DocumentTextParts` / `DocumentSummary` | Extracted text + summaries (written by the extractor Lambda — see the Lambda audit §C3) | baseline |
| `DocumentView` / `UserDocumentViewLocation` / `ItemLastAccessed` | View + resume-position tracking | `:343-351` |
| `DocumentPermission` | Join to `SharePermission` | `:373-378` |
| `InstructionsDocuments` | Documents acting as agent instructions | baseline |

**Versioning is content-addressed:** `DocumentInstance.sha` is the join key
to stored bytes, and `sha_cleanup_worker` garbage-collects unreferenced shas
hourly (Lambda audit §C7). Any CF-native version model has to keep or
consciously replace that sha-keyed indirection — it is what makes copy and
branch cheap.

### B2. Content lives in one of five places — this is the load-bearing finding
(`[NW] crates/documents/src/domain/content.rs:12-176`)

`DocumentContent` is a state + location pair, not a blob pointer:

- `DocumentContentState` — `unknown` | `pending` | `ready` (`:12-24, 142-153`)
- `DocumentContentLocation` — `object_storage` | **`sync_service`** |
  `docx_bom_parts` | `converted_pdf` | `unknown` (`:26-44, 161-176`)

The legacy-migration helper maps `fileType` to a location when the columns
are absent: `Docx → ConvertedPdf`, `Md → Unknown`, everything else →
`ObjectStorage` (`:95-111`).

The consequence for the rebuild: **`documents` does not own its content.**
For live-collaborative documents the bytes live in `sync-service` — one of
the **three lifted services** (ruling A3, mounted per L1 at `/sync`). A
CF-native `documents` domain therefore has to keep the location indirection
and treat the lifted `sync-service` as an authoritative content backend it
does not control. `location_v3` (§A1) is the resolver endpoint that makes
this choice per request, and `document.sync_content_updated` (§C) is how the
sync side tells the rest of the system its bytes moved.

### B3. Object storage and delivery

- Upload URLs, byte upload, UTF-8 object reads, markdown source:
  `outbound/s3_upload_url.rs`, `s3_markdown_source.rs`,
  `s3_utf8_object_reader.rs`, `document_bytes_upload.rs`.
- `CloudFrontConfig` (`domain/models.rs:335-350`) backs
  `cached_snapshot_url` — signed-CDN delivery of snapshots.
- `outbound/sync_service_probe.rs` — DSS probes sync-service for liveness /
  content state; the coupling in §B2 made concrete.
- `outbound/editing_worker_client.rs` — calls `ai-editing-worker`, the
  second lifted service.

R2 covers the object-storage role; the CloudFront signing role maps to
Workers-signed R2 URLs. Neither is a new capability, but **both lifted
services are inbound dependencies of this domain**, which is what makes the
route reconciliation (A2/L1) a prerequisite of building `documents`, not a
follow-up.

### B4. File typing

`FileType` is a macro-generated enum with **413 variants** mapped to MIME
types and **18 `FileAssociation` viewer categories** (Font, Document,
Database, Data, Vector, ThreeD, Vm, Media, Code, Pdf, Md, Canvas, …)
(`[NW] crates/model_file_type/src/lib.rs:51, 230-249, 250+`). The
association drives which frontend viewer opens. This is a data table, not
logic — it ports as data, and it is the single cheapest large win in the
domain.

## C. Events

`DocumentTopicEvent` publishes **8 variants** to the `macro.documents` Kafka
topic (`[NW] crates/documents/src/domain/events.rs:162-190`, schema version
1 at `:191-195`):

| Event | Meaning | Pointer |
|---|---|---|
| `document.created` | Created | `events.rs:23-42, 164-166` |
| `document.updated` | Metadata / permissions changed | `:43-66, 167-169` |
| `document.deleted` | Soft delete | `:67-79, 170-172` |
| `document.content_uploaded` | Bytes (re)written to S3 | `:80-95, 173-175` |
| `document.sync_content_updated` | Live-collab content changed, re-extract | `:96-107, 176-178` |
| `document.purged` | Hard delete | `:108-116, 179-181` |
| `document.copied` | Copied | `:139-161, 182-184` |
| `document.interaction` | Peer joined/left or periodic save; `InteractionReason` at `:117-128` | `:129-138, 185-187` |

Consumers at the pin: `search_processing_service`'s document Kafka consumer
(`[NW] services/search_processing_service/src/inbound/kafka_consumer/document.rs`),
`document_text_extractor`, and `deleted_item_poller`. Under D3/3a these
become intent records + in-DO alarms with idempotent consumers; the eight
names are the contract to preserve, and `document.interaction` is the one
that is a **presence** signal rather than a state change — it belongs with
the C1 kernel session events, not with the durable outbox.

## D. Sub-capabilities the ledger currently carries elsewhere

These are all reached through document rows and would be built with
`documents`, not after it:

1. **Threads / comments / annotations.** `Thread`, `ThreadAnchor`,
   `Comment`, `CommentThread` models live in this crate
   (`domain/models.rs:601-658`); tables `Thread`, `ThreadAnchor`, `Comment`,
   `WebAnnotations`, plus the PDF anchor stack `PdfHighlightAnchor`,
   `PdfHighlightRect`, `PdfPlaceableCommentAnchor` (baseline). Mounted
   separately at `/threads` (`[NW] services/document_storage_service/src/api/mod.rs:142-147`).
   The ledger's `DSS-native: … annotations` row and this row are the same
   build.
2. **Tasks.** `create_task`, `similarity_search`, `duplicates` ×3,
   `branch_name`, `github_prs`, table `document_task`, `TeamTaskMetadata` /
   `TaskBranchName` / `GithubPullRequest*` models
   (`domain/models.rs:88-292`). Tasks are a **document sub-type**
   (`document_sub_type` table), not their own entity — note this is exactly
   why `property_entity_type` has a `TASK` value that `EntityType` does not
   (§F).
3. **Skills / snippets / markdown.** Three more creation flavors with their
   own request/response types (`domain/models.rs:420-558`), plus
   `system_skills`.
4. **Team share.** `DocumentTeamShare` / `SetDocumentTeamShareRequest`
   (`:560-600`) over the polymorphic `SharePermission` stack (§E).

## E. The polymorphic sharing model (D1 evidence)

`SharePermission` is one row joined by **six per-type tables** —
`DocumentPermission`, `ChatPermission`, `ProjectPermission`,
`MacroPromptPermission`, `EmailThreadPermission`, `ChannelSharePermission`
(`0001_baseline.sql:353-412`) — plus `entity_access`
(`20260331152752_add_entity_access_table.sql:3`) and
`OrganizationDefaultSharePermission`.

This is the concrete shape of what D1/1a ruled: the `Entity=(type,id)`
ontology is kept, and per-type access policy **stays per-type code**. The
six join tables are that per-type policy in table form. They do not become
one generic ACL table; they become per-type checks against the entity
registry.

## F. The D2 rider, made concrete

D2/2a carries a rider that **entity-type canonicalization comes first**.
Here is the exact divergence at the pin:

- `model-entity::EntityType` — **16** variants (`user`, `chat`, `channel`,
  `channel_message`, `document`, `project`, `email_thread`,
  `calendar_event`, `team`, `call`, `foreign_entity`, `static_file`,
  `crm_company`, `crm_contact`, `reminder`, `skill`) — confirmed
  independently from the connection_gateway OpenAPI `EntityType` enum.
- `property_entity_type` — **10** values, and they are a *different set*:
  `CHANNEL`, `CHAT`, `DOCUMENT`, `PROJECT`, `THREAD`, `USER`
  (`20251030100000_init_properties_schema.sql:20-27`), then `COMPANY` and
  `TASK` (`20251128000000_add_system_properties.sql:3-4`), `CALL_RECORD`
  (`20260709192942_add_call_record_property_entity_type.sql:2`),
  `CALENDAR_EVENT` (`20260726023229_calendar_event_property_entity_type.sql:3`).

`THREAD` and `TASK` are property-entity-types with **no `EntityType`
variant** — because both are document-adjacent concepts (a thread on a
document, a task sub-type of a document). That is the canonicalization
debt `docs/PROPERTY_TARGET_ENTITY_TYPE_PLAN.md` reports, and it lands
squarely on this row: you cannot canonicalize entity types without deciding
whether thread and task are entities or facets of `document`.

## G. Why this is more than one ledger row

Sized as one row, `documents` reads as "a table and a blob store". What is
actually here: 25 endpoints from two codebases, 5 creation flavors, 15
tables, 8 events, 5 agent tools, a 413-entry type table, a two-substrate
content model coupled to a lifted service, a version/branch/sha model, an
annotation stack with PDF geometry, and a task system with GitHub
integration.

**Options for David (not a ruling):**

- **G1 — split the row** into `documents-core` (row + versions + content
  location + events), `annotations` (threads/comments/PDF anchors, merging
  the existing DSS-native annotations row), and `tasks` (sub-type +
  duplicates + branch/PR integration), each ruled separately.
- **G2 — keep one row**, rule it once, and carry the §D list as explicit
  sub-scope inside it.
- **G3 — split only tasks out** (it is the piece most likely to be
  differently-scoped for an outreach product) and keep annotations inside
  documents.

## H. Open questions parked for design time

1. Is the `document_create` feature flag on in the deployed build — i.e. are
   markdown/snippet/skill live capabilities or dead code at the pin? (§A1)
2. Does the sha-keyed version model survive, or do versions become DO
   storage generations? It is the hinge for copy/branch cost. (§B1)
3. `documents` reads and writes through two of the three lifted services.
   Does the A2/L1 route reconciliation get done **before** this domain is
   built? (§B3)
4. Thread and task: entities in the canonical ontology, or facets of
   `document`? Blocks the D2 rider. (§F)
5. 413 file types — port the whole table or the subset an outreach product
   opens? (§B4)
6. Snapshot delivery: keep signed-CDN semantics on R2, or serve through a
   Worker? (§B3)

## I. Coverage

**Read:** `crates/documents` router (`inbound/axum_router.rs:217-340`),
`domain/content.rs` in full, `domain/events.rs:1-196`, `domain/models.rs`
struct/enum index (all 34 declarations by name and line, bodies read only
for the ones cited), the crate's file tree and per-file LOC, the toolset
file list, `model_file_type/src/lib.rs:40-298` (macro + counts),
`0001_baseline.sql:325-470` plus the full quoted-table index of that file,
the four `property_entity_type` migrations, DSS
`api/mod.rs:66-291` mount list and `api/documents/mod.rs:49-62`, and the
connection_gateway OpenAPI `EntityType` enum.

**Not read:** `domain/service.rs` (1,775 lines) and
`outbound/pg_document_repo.rs` (1,203 lines) — the two largest files, read
only via their file names and the router/model surfaces they serve, so
**all business-rule detail inside create/edit/copy/delete is unverified**;
`domain/create/`, `domain/upload_finalize.rs`, `domain/permission_token.rs`,
`domain/activity.rs`, `domain/branch_name.rs`, `domain/markdown_backfill.rs`
and the `markdown_backfill` bin; every per-endpoint handler body in
`inbound/axum_router/*.rs` (24 files); the five toolset implementations
(tool **names** here are inferred from filenames, not from registered tool
identifiers — treat as provisional); `inbound/attachment/*`; all `outbound/`
S3/CloudFront/editing-worker/sync-probe bodies; every test file; the
`DocumentFamily`, `DocumentText*`, `DocumentSummary`, `InstructionsDocuments`,
`ItemLastAccessed` column definitions (named from the baseline table index,
columns unread); the frontend document surfaces (this audit is backend-only —
cross-check against `endpoint-inventory-frontend.md` and
`reference/platform-context/ui-ux-component-catalog.md` before any UI
scoping); whether `document_create` is enabled in deploy config.

**Inherited, not re-verified:** the ledger's existing `[CF]` targets and the
kernel idiom pointers in `cloud-handoff.md` §5 were not re-checked against
`cloudflare-os/` for this audit.
