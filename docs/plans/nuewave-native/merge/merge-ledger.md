# Merge ledger — every capability, one verdict

> Created 2026-08-19. The backbone of the merge audit (ruling 7: re-audit
> everything). One row per capability at the granularity a verdict is about.
> `Verdict:` slots are filled **only by David's dated rulings** — everything
> else in a row is research and may be refined by agents. Prior verdicts from
> the concept-only docs are recorded as *provisional* and carry no authority.
>
> Row lifecycle: `☐ unresearched` → `◐ researched` (pointers + proposal
> filled, cross-refs to the inventories) → `✔ ruled` (verdict + date).
> When every row is `✔`, this file plus dates is the final audit the Linear
> scope-map agent builds "Nuewave T" from.

Pinned source: `DavidSuperwave/Neuwave@9f7a26b` — see `README.md`.
Cross-refs: `endpoint-inventory-backend.md` (EB), `endpoint-inventory-frontend.md` (EF), `schema-harvest.md` (SH).

> **Default ruling (2026-08-19, Q19):** every row not explicitly ruled or
> parked is **KEEP — faithful recreation**. Kills happen only by explicit
> ruling (so far: `graphql_soup`, FusionAuth, and the AWS substrate itself).
> **Parked to the end:** the business chrome — billing/paywall, onboarding,
> getting-started — because David plans something different there; its
> *primitives* (how the old flows/pricing/first-run mechanically work) still
> get documented from source as reference for that redesign.

## 1. Backend domains — DSS composition root (`/dss`)

Mounted domain crates per `../reference/platform-context/platform-canvas.md`;
pointers to be verified against `services/document_storage_service` and
`crates/*` during research.

| St | Capability | Old source | What it is | Provisional (old docs) | Proposed CF target | Verdict |
|---|---|---|---|---|---|---|
| ◐ | documents | `crates/documents` (18,653 LOC / 76 files); router `crates/documents/src/inbound/axum_router.rs:217-320`; content model `crates/documents/src/domain/content.rs:12-176`; events `crates/documents/src/domain/events.rs:162-190`; tables `crates/macro_db_client/migrations/0001_baseline.sql:325-470`; file types `crates/model_file_type/src/lib.rs:51,230-249` | **The polymorphic core entity, not one capability.** 25 endpoints on `/documents` from two codebases (22 hex + 3 DSS-native, `services/document_storage_service/src/api/documents/mod.rs:49-62`); **5 creation flavors** (document, task, markdown, snippet, skill — last three behind `#[cfg(feature = "document_create")]`); **15 tables** incl. `DocumentInstance` (versions, sha-keyed), `DocumentFamily`+`branchedFrom*` (branching), `DocumentBom`/`BomPart` (docx), `DocumentText*`; **8 Kafka events** on `macro.documents`; 5 agent tools (frozen ai_toolset applies); 413 `FileType` variants → 18 viewer associations. **Content lives in one of 5 locations** (`object_storage`, `sync_service`, `docx_bom_parts`, `converted_pdf`, `unknown`) — so the domain does **not** own its bytes: live-collab content is held by the lifted `sync-service`. Carries the threads/comments/PDF-annotation stack and the task system (duplicates, branch names, GitHub PRs). Full audit: `audits/documents-audit.md`. | Keep | Entity registry + per-entity DO under **D1/1a** (the `ensure_document_exists` middleware hop is what the registry replaces); content-location indirection preserved with R2 for `object_storage` and the **lifted `sync-service` (A3, mounted per L1 `/sync`)** as an authoritative backend it doesn't control; **materialized-index layer (D1/1a, required)** for lists; 8 events → intent record + in-DO alarm with idempotent consumers under **D3/3a**, except `document.interaction` which is presence and belongs with **C1** kernel session events; 25 endpoints collapse to RPC methods under **R3** (the DSS double-mount at root *and* `/dss`, `api/mod.rs:290-291`, has no successor); per-type sharing stays per-type code per **D1/1a**. Effort: **largest single row in the ledger** — audit §G offers three splits (G1 core/annotations/tasks, G2 one row with sub-scope, G3 split tasks only). | — |
| ◐ | projects (=folders) | `crates/projects` (9,809 LOC / 45 files); router `crates/projects/src/inbound/axum_router.rs:119-175`; table `crates/macro_db_client/migrations/0001_baseline.sql` `"Project"`; events `crates/projects/src/domain/events.rs` | Folder tree over a **self-referential `Project.parentId`** — this is the Project=Folder invariant in schema form. 11 endpoints: CRUD + `/content`, `/permissions`, `/access_level`, `/revert_delete` (soft-delete restore), `/permanent` (hard delete), plus `/pending`, `/preview` (batch), `/upload` and `/upload_extract`. Columns `uploadPending` + `uploadRequestId` make folder upload an **async, resumable job**: the row is written pending, the `upload_extractor_lambda_trigger`→`_handler` pair expands the archive, and progress reaches the client as `UploadFolderStatusUpdate` (`completed`/`partially_completed`/`failed`/`unknown`) over connection_gateway. **6 events** on `macro.projects`: `project.created/updated/deleted/restored/permanently_deleted/uploaded`. Sharing via `ProjectPermission` → `SharePermission`. | Keep | Tree in typed-storage with the parent edge indexed via the **D1/1a materialized-index layer** (folder listing is the hot read); soft-delete + restore + purge is a three-state lifecycle that wants the entity registry's tombstones (**D1/1a**). Folder upload is the clearest **D3/3a + D4/4a** case in the ledger: `uploadPending`/`uploadRequestId` become in-DO intent + alarm, the Lambda trigger/handler pair collapses into one DO (see `audits/lambda-batch-families-audit.md` §B/§E1), and the status updates become **C1** kernel session events instead of gateway pushes. 6 events under **D3/3a**. Effort: medium — the tree is small, the async upload pipeline is the real work. | — |
| ✔ | channels | `crates/channels` | Channels containers | ~~Conflict: keep-thin vs drop~~ | DO-backed channels + messaging | **Keep full — faithful recreation incl. messaging surface (2026-08-19)** |
| ✔ | soup | `crates/soup` | The list/feed engine behind Soup lists | Keep (thin) | Typed RPC + DO queries, WebSocket push | **Faithful UX on native data (2026-08-19)** — list behavior recreated exactly; substrate is CF-OS-native |
| ✔ | graphql_soup | `crates/graphql_soup` | GraphQL surface over soup | — | — | **Killed (2026-08-19)** — internal wire detail; replaced by typed RPC per soup ruling |
| ◐ | search_service | `crates/search_service` (7,061 LOC / 31 files); routers `crates/search_service/src/api/search/mod.rs:19-21`, `api/search/simple/mod.rs:21`; per-entity handlers `api/search/{document,project,chat,channel,email,call_record,crm_company}.rs` | **Tiny HTTP surface, wide entity coverage.** Only 3 mounts — `POST /` (unified), `POST /simple` (a reduced/faster variant with its own per-entity handlers under `api/search/simple/`), and `/channel` — but each fans out across **7 indexed entity types**: document, project, chat, channel, email, call_record, crm_company. Also `terms.rs` (query-term parsing) and `enrich.rs` (result hydration from Postgres after the index returns ids). Backend is **OpenSearch** (`infra/stacks/opensearch`), which the index is queried against directly; `search_service` owns query construction + enrichment, **not** indexing (that is `search_processing_service`). | Defer | Query/enrichment layer is a thin RPC surface under **R3**; the substrate choice is the real decision and it is a **D1/1a index-layer** question, not a separate product — the ruled "required materialized-index layer" and the search index are the same architectural slot and should be designed together, not as two stores. Candidates: D1 FTS5 for lexical + Vectorize for semantic, with enrichment reading the entity DOs. The 7 entity types are the coverage contract. Effort: small-to-medium for the query surface; the substrate is the cost. **Rule with `search_processing_service`** — they are one system. | — |
| ◐ | properties | `crates/properties` (20,911 LOC / 53 files — **the largest domain crate in the ledger**); router `crates/properties/src/inbound/axum_router.rs:115-180`; schema `crates/macro_db_client/migrations/20251030100000_init_properties_schema.sql:5-178`; toolset `crates/properties/src/inbound/toolset/` | The EAV domain surface (storage direction already fixed by **D2/2a**). **19 endpoints in four groups**: `/definitions` (+`/{id}`, `/{id}/options`, `/{id}/options/{option_id}`), `/tags` (+`/tags/promote`, `/tags/merge` — tag lifecycle is first-class), `/entities/{entity_type}/{entity_id}` (+`/{property_id}`, `/options/{option_id}`, `/options/bulk`, `/entities/bulk`, `/options/bulk`), `/entity_properties/{id}`. **Bulk is pervasive** — four of the 19 are bulk paths, which is a load-bearing shape for grid/kanban editing, not an optimization. **9 agent tools** (`set_entity_property`, `bulk_set_entity_property_options`, `get_entity_properties`, `list_tags`, `create_tag`, `edit_tag`, `delete_tag`, `tag_color`). Domain carries its own `activity/` and `events/` trees — the side-effect pipeline. 3 tables (`property_definitions`, `property_options`, `entity_properties`) + 2 enums: `property_data_type` (9: BOOLEAN, DATE, NUMBER, STRING, SELECT_NUMBER, SELECT_STRING, ENTITY, LINK) and `property_entity_type`. Publishes to `macro.properties`. | Keep | Semantics kept exactly per **D2/2a**; values on the entity record; filter-index layer first-class (**D1/1a**). Surface = RPC namespace under **R3** preserving the four groups and, critically, the **bulk shapes** (a per-item RPC loop is not a faithful recreation of grid editing). Side-effect pipeline gets **pattern-3 treatment (D3/3a)** per the D2 rider — property writes fan out to activity + `macro.properties` consumers, so intent record + in-DO alarm + idempotent consumers. 9 tools → Gatekeeper session APIs (frozen ai_toolset). **The D2 entity-type-canonicalization rider is blocking and now has exact evidence:** `property_entity_type` holds **10** values (CHANNEL, CHAT, DOCUMENT, PROJECT, THREAD, USER, then COMPANY/TASK `20251128000000_add_system_properties.sql:3-4`, CALL_RECORD `20260709192942:2`, CALENDAR_EVENT `20260726023229:3`) against `EntityType`'s **16** — and `THREAD`/`TASK` exist here with **no `EntityType` variant** because both are document facets. Canonicalization cannot be settled without deciding whether thread and task are entities (see `audits/documents-audit.md` §F). Effort: large. | — |
| ✔ | crm | `crates/crm` | Companies/contacts CRM — **audited 2026-08-19**: mounted at `/crm` in DSS; email-traffic-derived (populate/depopulate off `email_links`); domain-keyed companies per team; EAV Stage/Owner/Revenue (companies only, contacts have none); global Apollo-backed domain directory; hidden/email_sync/killswitch machinery. Full audit: `audits/crm-audit.md`. | Keep | DO/D1 | **Keep, in the pilot (2026-08-19).** What the new CRM actually contains is decided by David + agent at design time from what the source really does. |
| ✔ | call | `crates/call` | Calls (LiveKit) | ~~Drop~~ | LiveKit stays external; call domain on DO/D1 | **Keep (2026-08-19)** |
| ☐ | favorites | `crates/favorites` | Favorites/stars | — | Cheap DO row | — |
| ✔ | reminders | `crates/reminders` | Reminders | ~~Drop~~ | DO alarms / kernel scheduler | **Keep (2026-08-19)** |
| ☐ | foreign_entity | `crates/foreign_entity` | External-entity mirror (GitHub etc.) | — | TBD | — |
| ☐ | webhook | `crates/webhook` | Webhook ingestion | — | Workers routes | — |
| ☐ | bots | `crates/bots` | Bot registry | — | Gatekeeper/agent identity model | — |
| ☐ | github | `crates/github` | GitHub integration | Keep (verifier path) | Gatekeeper | — |
| ✔ | calendar_events / cal | `crates/calendar_events`, `crates/cal` | Calendar (sync coupled to email accounts) | ~~Drop~~ | Workers sync + DO/D1 | **Keep (2026-08-19)** |
| ✔ | sync_service (domain) | `crates/sync_service` + `services/sync-service` | Loro CRDT sync (already CF) | — | Lift as-is | **Lift (2026-08-19)** — see §3 CF-services ruling |
| ☐ | DSS-native: activity, pins, recents, history, annotations, saved-views, entity-access | `services/document_storage_service` | Cross-entity chrome | — | Per-item rows if kept | — |

## 2. Backend domains — DCS composition root (`/cognition`)

| St | Capability | Old source | What it is | Provisional | Proposed CF target | Verdict |
|---|---|---|---|---|---|---|
| ✔ | chat | `crates/chat` | Chat threads/messages + streaming | Keep | Faithful UX over kernel sessions | **Kernel runs, old UX on top (2026-08-19)** — chat experience recreated as surfaces over kernel sessions |
| ✔ | agent | `crates/agent` | Agent runtime | Replaced | CF-OS kernel agent loop | **Kernel is the one agent runtime (2026-08-19)** |
| ✔ | ai_tools / ai_toolset | `crates/ai_tools`, `crates/ai_toolset` | Tool defs; **frozen ai_toolset invariant** | Keep frozen | Gatekeeper session APIs | **Semantics recreated as Gatekeeper session APIs, mapped piece-by-piece factually from source (2026-08-19)** |
| ☐ | memory | `crates/memory` | Agent memory | — | Context/DO storage | — |
| ☐ | import | `crates/import` | Import pipelines | — | TBD | — |
| ☐ | onboarding | `crates/onboarding` | Onboarding flows | — | Likely killed | — |
| ☐ | ai_usage | `crates/ai_usage` | Usage metering | — | AI Gateway analytics | — |
| ☐ | ai_projections | `crates/ai_projections` | AI-derived projections | — | TBD | — |
| ◐ | mcp_client | `crates/mcp_client` | MCP client — audited 2026-08-19: Streamable-HTTP only via rmcp, per-user servers, AES-GCM creds, 3-strategy OAuth (pre-reg/CIMD/DCR), searchable tool catalog (schemas never in prompt), CRUD at `/mcp/servers*` in DCS. See `audits/connectivity-layer-audit.md` §A1. | Replaced | `gatekeeper-mcp` (+ mcp-shared covers most of this already) | — |
| ☐ | streaming/completions (native) | DCS root | `POST /stream/chat/message` etc. | Keep | Kernel streaming | — |

## 3. Standalone services & processes

| St | Capability | Old source | What it is | Provisional | Proposed CF target | Verdict |
|---|---|---|---|---|---|---|
| ✔ | authentication_service | `services/authentication_service` | Real multi-tenant auth (`/auth`, ~79 endpoints): sessions, signup/login, OAuth, teams, invites, permissions; FusionAuth backend; Stripe webhooks ride on it | ~~Replaced by Access~~ | Workers + DO/D1; identity backend chosen at design time | **Rebuild real auth Cloudflare-native (2026-08-19).** FusionAuth stays dead; Access is not the auth model. |
| ✔ | connection_gateway | `services/connection_gateway`; shared types `crates/connection_gateway_models/src/lib.rs:1-62`; publisher clients `crates/connection_gateway_client/src/client/{email,calendar}.rs`; protocol schemas `apps/web/src/lib/service-clients/service-connection/openapi.json` | WebSocket fan-out — WS upgrade at literal `GET /` (`src/api/connection/mod.rs:34`), JSON protocol (track_entity/stream_events, carries AI stream + email refresh events). **Event types enumerated 2026-08-19 (research pass) for the C1 kernel-session design.** *Transport:* 3 HTTP paths — `GET /track/{entity_type}/{entity_id}` (the WS upgrade), `POST /message/send/{entity_type}/{entity_id}`, `POST /batch_send`. *Client→server* (`ToWebsocketMessage`, 2 variants): `track_entity` — carries `TrackAction` = `open`\|`ping`\|`close`, i.e. **presence with an explicit heartbeat**; and `stream_events` — subscribe to AI streams for an entity. *Server→client:* an entity-addressed envelope with a **free-form `message_type: String`** plus JSON payload (`UniqueMessage`/`SendMessageBody`), so the type set is defined by publishers, not by an enum. Types found at the pin: **`refresh_email`** (`connection_gateway_client/src/client/email.rs:15`), **`refresh_calendar`** (`client/calendar.rs:15`), **`user_tracking_change`** (presence fan-out), **`StreamEvent`** = `created`\|`closed` (AI stream lifecycle, keyed by `StreamId`, payloads as `StreamItem{id,payload}`), and **`UploadFolderStatusUpdate`** = `completed`\|`partially_completed`\|`failed`\|`unknown` (the projects-row folder-upload progress channel). Delivery is receipted: `MessageReceipt{user_id, delivery_count, active}`. Addressing uses the full 16-variant `EntityType`. **Note the two shapes are different problems:** presence/tracking and stream lifecycle are session-native; `refresh_email`/`refresh_calendar`/upload-status are **cache-invalidation pokes** ("something changed, refetch"), which is a different design question for the kernel session. | Replaced | DO hibernatable WebSockets; `route-reconciliation.md` §5 proposes supersede-by-kernel-`/api`-session (ruling C1). Design inputs now available: the 2 client→server verbs, the 5 server→client type families above, the `open/ping/close` presence contract, and the receipt shape. The free-form `message_type` should become a **closed union** in the kernel session events — the string was the source of the enumeration difficulty. `document.interaction` (`audits/documents-audit.md` §C) belongs with these session events rather than the D3 durable outbox. | **Superseded by kernel `/api` session push (2026-08-19, ruling C1)** — its event types become kernel session events at domain design time; no dedicated `/ws` service |
| ✔ | email_service (company mailbox) | `services/email_service` | Mailbox (`/email`), **24** `email_*` tables live at pin (audit corrected from 26), Gmail push sync (watch→GCP Pub/Sub→webhook), two-phase Gmail-API send w/ undo (no SMTP), Redis backfill counters, delegation + shared-inbox promotion. Full audit: `audits/company-mailbox-audit.md`. GCP Pub/Sub stays a hard dependency. | ~~Drop (Instantly instead)~~ — framing corrected 2026-08-19 | Workers + Queues (sync), DO/D1 (threads), R2 (attachments) | **Keep, IN the pilot — full faithful recreation incl. send (2026-08-19)** |
| ✔ | **Agent connectivity layer** (new — replaces the "Instantly read-only" framing) | new concept; seams: `gatekeeper-mcp`, kernel session APIs; old analogues `crates/mcp_client`, `crates/import` (gather/staging ledger — strongest analogue), `crates/foreign_entity`, `features/integrations`. Full audit: `audits/connectivity-layer-audit.md` (9-gap delta; no Instantly connector exists in either codebase; old catalog = hardcoded FE constant) | Composio-style MCP + API linking so agents pull external data into the workspace (Instantly = first source) | — | Gatekeeper connectors + MCP catalog | **Build as the P1 outreach centerpiece (2026-08-19, per David's clarification)** |
| ☐ | notification_service | `services/notification_service` | Notifications (`/notification`) | Drop | — | — |
| ✔ | contacts_service | `services/contacts_service` | **Research correction (2026-08-19 audit): NOT CRM** — a user↔user connections graph (`contacts_connections(user1,user2)`, SQS-fed from channel membership + auth events; `crates/contacts/src/inbound/http.rs:217-245`). The CRM has no dependency on it. See `audits/crm-audit.md` §A3. | Keep (CRM) | Standalone user-connections graph, CF-native | **Re-ruled (2026-08-19, batch E): keep as its own capability, in the pilot** — rebuilt CF-native as a standalone user↔user connections graph (mention/share-suggestion feeder), independent of CRM; supersedes the wrong-premise "keep with CRM" verdict |
| ☐ | static_file_service | `services/static_file_service` | File serve (`/static-file`) | Replaced | R2 + Workers | — |
| ☐ | unfurl_service | `services/unfurl_service` | Link unfurl | — | Worker fetch | — |
| ☐ | image_proxy_service | `services/image_proxy_service` | Image proxy | — | Workers/Images | — |
| ◐ | search_processing_service | `services/search_processing_service` (10,165 LOC); consumers `services/search_processing_service/src/inbound/kafka_consumer/{call,channel,chat,document,email,project,property}.rs`; internal API `src/api/internal/{backfill,delete_document,extract_sync}.rs`; jobs `src/domain/jobs.rs` | **Not a Lambda — a long-running Kafka consumer**, and the real indexing path (`search_upload_handler` is a small EventBridge side-job; see `audits/lambda-batch-families-audit.md` §C). One consumer module per entity type — **7**: call, channel, chat, document, email, project, property — matching `search_service`'s 7 searchable types. Also exposes an internal HTTP surface: `/backfill` (re-index), `/delete_document`, `/extract_sync` (pull text for sync-service-backed docs — the `document.sync_content_updated` path from `audits/documents-audit.md` §C). This is the consumer half of the **14-topic `macro.*` Kafka bus** (`macro.documents`, `.projects`, `.properties`, `.chats`, `.channels`, `.email`, `.calls`, `.teams`, `.bots`, `.mentions`, `.soup`, `.webhooks`, `.activity_events`, `.com`). | Defer | Kafka → **Cloudflare Queues**, one consumer per entity type, idempotent per **D3/3a** with poison-pill mark-and-skip (re-indexing the same entity twice must be a no-op — it already is, by index-by-id). Backfill is a bulk job → DO with alarm under **D4/4a**, not a dispatcher. The `macro.*` topic list is the **event-bus contract for the whole rebuild**, not just search — it is the single most reusable artifact from this row. **Rule with `search_service`** — one system, two halves. Effort: medium; the substrate decision is shared with `search_service`. | — |
| ☐ | scheduled_action | `services/scheduled_action` (verify) | Scheduled jobs | Replaced | Kernel scheduler / DO alarms | — |
| ☐ | convert_service | verify path | Document conversion | — | TBD | — |
| ◐ | mcp_service + mcp_auth_proxy | `services/mcp_service`, `services/mcp_auth_proxy` (verified) | Macro-as-MCP-server (first-party toolset to external agents) + an OAuth 2.1 broker that exists **because FusionAuth lacks DCR** (`mcp_auth_proxy/README.md:1-6`) — substrate-motivated; FusionAuth is dead. See `audits/connectivity-layer-audit.md` §A2. | Replaced | `gatekeeper-mcp`; the auth-proxy role dissolves with the auth rebuild | — |
| ✔ | sync-service (deployable) | `services/sync-service` (Rust/WASM, DO+D1, 18 routes, WS) | Collaborative-editing sync — already Cloudflare | — | Lift as-is (WASM exception to the no-Rust rule) | **Lift all four CF services (2026-08-19).** Integration requirement: their routes must be reconciled into the unified CF-OS route model — the old build conflict was these services syncing against AWS-side routes; now route/service alignment is a first-class design task of the rebuild. |
| ✔ | lexical-service / ai-editing-worker | CF Workers in repo | Editor AI — already Cloudflare | — | Lift as-is | **Lift (2026-08-19)** — same route-reconciliation requirement |
| ✔ | coding-agent-worker | ~~CF Worker in repo (TS)~~ **Research corrections (2026-08-19): EMPTY at the pin**, and a full history/all-refs search of both repos found **no source ever committed anywhere**; the lockfile (`name: daytona-bun-hello` — Bun + Hono + Daytona SDK + Ink CLI, zero Cloudflare deps) was a swept-in local prototype artifact and **was never a Cloudflare Worker**. The commit that added it delivered `crates/agent_runtime_protocol` (WS/ACP server half, Rust). See `route-reconciliation.md` §4. | ~~Agent runtime worker — already Cloudflare~~ (mislabel from a hedged platform-canvas doc line) | — | ~~Lift~~ nothing to lift | **Re-ruled (2026-08-19, route ruling A3): dropped from the lift set** — the lift set is three services (sync, lexical, ai-editing); supersedes the "Lift" verdict, which had no object. Future intent tracked in the row below. |
| ☐ | Coding-agent capability (future) | Reference only: `crates/agent_runtime_protocol` (Rust WS/ACP server half) + the dropped worker's bun.lock revealing the intended design (Bun + Hono + Daytona sandboxes + Zed agent-client-protocol + Ink CLI) | Sandboxed coding-agent runtime — never built in Neuwave | — | If ever wanted: new scope designed on the kernel's own agent runtime, not a lift | **Marked future-only (2026-08-19, ruling A3)** — not pilot scope; no old system exists to recreate |
| ☐ | analytics-proxy | verify path | PostHog proxy | Replaced | OS feature-flags/analytics stance | — |
| ✔ | transcription (LiveKit sidecar) | verify path | Call transcription | ~~Drop~~ | TBD at design time | **Keep with calls (2026-08-19)** |
| ◐ | Lambda/batch families (**exactly 20 handlers + 1 ECS worker, 7 families**) | Every crate in `services/*` linking `lambda_runtime`/`lambda_http` (enumeration method: `audits/lambda-batch-families-audit.md` §H); schedules in `infra/stacks/**` `scheduleExpression` | **The inventory hole is closed — the count is exact, not "~20".** Ingestion (5): `document_upload_finalizer_handler`, `docx_unzip_handler`, `upload_extractor_lambda_trigger`+`_handler`, `document_text_extractor`. Search (1): `search_upload_handler`. Email (4): `email_refresh_handler` `rate(1 hour)` — re-arms expiring Gmail `users.watch`, i.e. **push sync silently dies without it**; `email_scheduled_handler` `rate(1 minute)`; `email_sfs_delete_handler` `cron(0 8 * * ? *)`; `email_suppression_handler` (**SNS from SES** bounce/complaint → suppression list). Retention (6 + ECS): `deleted_item_poller` `rate(4 hours)` (>30-day purge), `delete_chat_handler` (SQS), `organization_retention_trigger` `rate(1 day)`+`organization_retention_handler` (SQS), `user_link_cleanup_handler` `rate(8 hours)`, `worker_trigger` `rate(1 hour)` → **`sha_cleanup_worker`** (ECS task, **Redis** `bucket:sha-delete` work set). Media (2): `call_recording_preview_handler` (S3, **ffmpeg**), `image_optimizer`. AI (1): `ai_projections_refresh_handler` on **3 cadence tiers** (6h/1d/3d). Security (1): `dataloss_prevention_handler` (S3, daily) — **scans and deletes user content**. Full audit incl. per-handler triggers: `audits/lambda-batch-families-audit.md`. | Never mapped | Per family, not per handler. **Most of these do not port — they dissolve:** under **D4/4a** the four trigger→handler pairs collapse into one DO with an alarm (the split is a 15-minute-Lambda artifact), and the two 1-minute polls (`email_scheduled_handler`, plus the reminder dispatcher at `infra/stacks/cloud-storage-service/reminder-dispatch-queue.ts:60`) are exactly the "no ported dispatchers" case — per-item DO alarms replace them. Ingestion → R2 event notifications + Queues, idempotent per **D3/3a**, keyed on document id + sha; it is the same build as the `documents` row's `pending`→`ready` content-state machine. Only the Gmail `watch` re-arm is inherently periodic and must stay so. **Four things need David, not design:** (a) this row should become ~7 rows attached to their domains — audit §G1; (b) **DLP has no ledger row** and deleting user content on policy is a product decision; (c) **Redis** appears as infrastructure with no CF successor named (every use found is a queue or counter → DO state under D3/D4, but say so as a ruling); (d) **ffmpeg has no Workers-native successor** — Container, Media Transformations, or drop call previews. Effort: spread across families; individually small-to-medium. | — |

## 4. Frontend surfaces — routes & splits

From EF §1–2 (27 routes, 28 registered splits; 24 dev-only splits excluded —
collective row at bottom). The split-layout model itself (`/*splits` encoding
alternating `{type}/{id}` pairs) is its own row: it is the old shell's core
navigation idea and the shell plan flagged it as a conflict with CF-OS's
simpler routing.

| St | Capability | Old source | What it is | Verdict |
|---|---|---|---|---|
| ✔ | Split-layout engine | `apps/web/src/components/app/split-layout/`, `Root.tsx:223` | Multi-pane `{type}/{id}` navigation model — the shell's spine | **Recreate faithfully as the new app's shell, on CF-OS's frontend (2026-08-19).** Supersedes the shell plan's Gatekeeper-App-vs-custom-shell question. |
| ✔ | Soup list engine (SoupView) | `apps/web/src/features/next-soup/` | The unified list engine: filters, sorting, presets, sidebar; backs 10 of the splits | **Recreate faithfully; data via native RPC not GraphQL (2026-08-19)** |
| ◐ | `home` | `features/home` (EF :53) | Chat-first landing view with composer | — |
| ◐ | `inbox` | `features/next-soup` (EF :55) | Unified inbox list | — |
| ◐ | `tasks` + `task-compose` | `features/next-soup` (EF :64), `features/block-md` (:75) | Task list + composer — the Work-tab heart (SUP-493/495) | — |
| ◐ | `agents` | `features/next-soup` (EF :61) | Agents/automations list | — |
| ✔ | `mail` + `email-compose` | `features/next-soup` (EF :62), `features/block-email` (:74) | Email list + composer | **Keep — mailbox ruled keep-in-pilot (2026-08-19)** |
| ◐ | `documents` / `files` / `folders` | EF :63/:68 | Files and folder lists | — |
| ✔ | `channels` + `channel-compose` + `non-member-channel` | EF :65/:73/:72 | Channel list, composer, join prompt | **Keep — channels ruled keep-full (2026-08-19)** |
| ✔ | `companies` (CRM view) | `features/next-soup` + `features/companies` (EF :67) | CRM saved views | **Keep — CRM ruled keep-in-pilot (2026-08-19)** |
| ◐ | `search` | EF :69 | Search results list | — |
| ✔ | `calendar`, `reminders`, `calls`, `activity` | EF :56–58, :66 | Flag-gated secondary views | **Keep all four (2026-08-19)** |
| ◐ | `settings` (12 active tabs, 3 groups) | `features/settings`, `settingsTabsConfig.tsx:48` (EF §6) | Account/Billing/Appearance/Team/Tags/CRM/Connections/MCP/Bots/Admin… | — |
| ◐ | Command menu / launcher | `features/command/CommandMenu.tsx`, `Launcher.tsx` | Cmd-K command surface | — |
| ✔ | Auth screens (login/signup/invites) | `features/auth`, `team-invitations`, `channel-invitations` | Auth UI | **Keep — real-auth ruling (2026-08-19)** |
| ◐ | `getting-started`, onboarding (`setup`), paywall | `features/getting-started`, `setup`, `onboarding`, `paywall` | First-run and billing chrome | **Parked to end (2026-08-19)** — something different planned; document primitives from source as reference |
| ◐ | `import-linear` + integrations | `features/integrations/` | Linear import, MCP setup | — |
| ◐ | Entity layer + property system + sharing + favorites | `features/entity`, `features/property`, `features/sharing`, `features/favorites` | Cross-cutting UI infrastructure behind blocks/lists | — |
| ◐ | Dev-only splits (24) | EF §2 dev lists | Debug/playground pages | — (default: not recreated) |

## 5. Block types (16 concrete + aliases)

From EF §3; definitions at `apps/web/src/features/block-*/definition.ts`,
registry `apps/web/src/lib/core/block.ts:50`. Aliases: `csv`→code;
`task`/`snippet`/`skill`→md (so Task is an md-block flavor — matters for the
task model design). `write` is virtual; `unknown` is the fallback.

| St | Block | Old source (definition) | Verdict |
|---|---|---|---|
| ◐ | `md` (+ task/snippet/skill aliases) | `features/block-md/definition.ts:26` | — |
| ◐ | `chat` (AI chat) | `features/block-chat/definition.ts:18` | — |
| ✔ | `channel` | `features/block-channel/definition.ts:6` | **Keep — channels ruled keep-full (2026-08-19)** |
| ✔ | `email` | `features/block-email/definition.ts:6` | **Keep — mailbox ruled keep-in-pilot (2026-08-19)** |
| ✔ | `company` / `contact` (CRM) | `features/block-company/definition.ts:6`, `block-contact/definition.ts:6` | **Keep — CRM ruled keep-in-pilot (2026-08-19)** |
| ◐ | `project` (folder) | `features/block-project/definition.ts:13` | — |
| ◐ | `code` (+ csv) | `features/block-code/definition.ts:12` | — |
| ◐ | `pdf` / `image` / `video` | `block-pdf/definition.ts:15`, `block-image/definition.ts:14`, `block-video/definition.ts:52` | — |
| ◐ | `canvas` | `features/block-canvas/definition.ts:15` | — |
| ◐ | `automation` | `features/block-automation/definition.ts:6` | — |
| ◐ | `pr` (GitHub PR) | `features/block-pr/definition.ts:5` | — |
| ✔ | `call` | `features/block-call/definition.ts:15` | **Keep — calls ruled in (2026-08-19)** |
| ◐ | `unknown` (fallback) | `features/block-unknown/definition.ts:11` | — |

## 6. Cross-cutting invariants (from the original plan's "Do not break" list)

Each needs an explicit ruling: preserved in the recreation, or consciously
dropped. See `original-linear-plan-review.md`.

**Ruled 2026-08-19 (Q20): all five preserved as binding design invariants.**
The `ai_toolset` freeze applies to its semantics as recreated in Gatekeeper
session APIs (Q18).

| St | Invariant | Verdict |
|---|---|---|
| ✔ | Soup/Block/Split/Entity/Team/Channel nouns | Preserved (2026-08-19) |
| ✔ | Frozen `ai_toolset` | Preserved — semantics carried into Gatekeeper session APIs (2026-08-19) |
| ✔ | Share-permission semantics (cross-ref SEC-1/2/3 holes, SUP-474) | Preserved — with the SEC holes fixed, not recreated (2026-08-19) |
| ✔ | Project = Folder | Preserved (2026-08-19) |
| ✔ | One Task database | Preserved (2026-08-19) |

## 7. Data model

From SH. **Key correction to the concept docs:** the "four Postgres databases"
are one physical database — 198 live tables, one migration stream at
`crates/macro_db_client/migrations/` (267 files), logical grouping only by
table prefix + client crate, with real cross-domain FKs. Design patterns that
shaped the old system and need a deliberate adopt/reject ruling: polymorphic
`entity_type`/`entity_id` pairs as universal glue (10+ tables, no FK),
transactional outbox tables, lease-based job claiming. Also: DynamoDB
(bulk-upload requests), Redis (cache + email backfill state), S3 blobs
(sha-addressed), client-side SQLite cache — and **two schemas already on D1**
(`services/sync-service/database/user-peer-mapping`, `services/ai-editing-worker`
edit_traces). One-file schema reference incl. all enums:
`basic_schema_for_testing.sql` (test snapshot carried by five workers).
No live data migrates (ruling 8) — these rows decide which *shapes* the new
D1/DO typed-storage design adopts.

| St | Table group | Old source (prefix / SH section) | Size | Verdict |
|---|---|---|---|---|
| ◐ | Identity, teams, membership | MacroDB group | part of 154 | — |
| ◐ | Documents + versions + annotations | MacroDB group | " | — |
| ◐ | Projects (folders) | MacroDB group | " | — |
| ◐ | Sharing / ACL | MacroDB group (cross-ref SEC-1/2/3) | " | — |
| ◐ | AI chat, insights, projections | MacroDB group | " | — |
| ◐ | Properties (EAV) | MacroDB group | " | — |
| ✔ | CRM (companies/contacts) | MacroDB group | " | **Adopt shapes — CRM ruled keep-in-pilot (2026-08-19)** |
| ✔ | Calls/voice, calendar | MacroDB group | " | **Adopt shapes — both ruled keep (2026-08-19)** |
| ◐ | GitHub, bots, webhooks, import, reminders, activity | MacroDB group | " | — |
| ✔ | Email (`email_*`) | 26 tables | — | **Adopt shapes — mailbox ruled keep-in-pilot (2026-08-19)** |
| ✔ | Comms (`comms_*`) | 7 tables | — | **Adopt shapes — channels ruled keep-full (2026-08-19)** |
| ◐ | Notifications | 11 tables | — | — |
| ✔ | Polymorphic entity glue pattern | 10+ tables; canonical type `model-entity` (56 dependent crates) | pattern — **reviewed 2026-08-19**: domain-motivated ontology, substrate-shaped encoding; options 1a/1b/1c in `pattern-review.md` §1 | **Ruled 1a (2026-08-19): adopt the ontology, replace the encoding** — `Entity=(type,id)` universal; entities in DOs/typed-storage; entity registry (existence + tombstones); designed materialized-index layer for cross-entity lists (required); per-type access policy stays code. Rider: settle TEXT/UUID id format before building glue. |
| ✔ | EAV property system pattern | properties tables; 18 system keys incl. task Status/Assignees | pattern — **reviewed 2026-08-19**: custom props domain-motivated, system-fields-as-EAV substrate-motivated; the query half is the kernel's one genuine gap; options 2a/2b/2c in `pattern-review.md` §2 | **Ruled 2a (2026-08-19): adopt semantics, replace storage** — definitions/options/tagged-values/system-key semantics kept exactly; values live on the entity record (single-writer DO); materialized-index layer for list filtering is a first-class design task. Riders: settle entity-type canonicalization first (TASK/DOCUMENT dual-namespace bug); property-write side effects become cross-DO effects needing pattern-3 treatment. |
| ✔ | Outbox + lease-claim job patterns | migrations (`20260725014930` et al.) | patterns — **reviewed 2026-08-19**: both ~purely substrate-motivated; kernel already has DO-native idioms (intent+alarm outbox; DO-as-lease); keep external-mutation fencing; options 3a/3b + 4a/4b in `pattern-review.md` §3–4 | **Ruled 3a + 4a (2026-08-19): adopt the disciplines, not the tables** — outbox → intent record + alarm inside the DO, idempotent consumers, poison-pill mark-and-skip; leases → DO single-writer + alarms replace claim/renew/release and polling dispatchers; external-mutation fencing + idempotency keys kept as DO-local state; multi-job DOs use the recompute-shared-alarm discipline. |

**Pattern-review workstream (ordered by David 2026-08-19, Q21):** David leans
*adopt*, but each pattern must first be reviewed by an agent against the
source to determine **why it exists** — domain-motivated (the product needs
it) vs. substrate-motivated (a Postgres/AWS/old-agent workaround). Each
pattern then gets a per-pattern adopt/replace proposal mapped explicitly onto
Cloudflare behavior (DO single-writer, alarms, Queues), so we never import a
system that works one way while the new substrate expects it to behave
another. David rules per pattern after that review.
| ◐ | Already-D1 schemas (sync peer-map, edit_traces) | `services/sync-service`, `services/ai-editing-worker` | 2 | — |
