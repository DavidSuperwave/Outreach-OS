# WP-010 — Plan falsification and gap review

Date: 2026-08-20. Author: WP-010 review agent (first pass).
Status: complete for this pass; coverage limits stated in §1.3 and per-claim.

## 1. Methodology and coverage

### 1.1 Pins verified

| Source | Expected (02-BASELINE / manifest) | Observed | Match |
|---|---|---|---|
| Implementation worktree (Outreach-OS main) | `dec12f2df3d205965838526076b910cdb8a845ce` | `dec12f2df3d…` (clean tree) | YES |
| `cloudflare-os` submodule | `bf7f762d7fa73553284d731ab6a978d3ea17be24` | `bf7f762…` (initialized; commit dated 2026-08-05) | YES |
| Neuwave reference | `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` | `9f7a26b…` (clean tree, read-only) | YES |
| Planning branch `merge/nuewave-docs` | `8c3cf7a4e3c25ada27bb89850964702d07a34988` | `8c3cf7a…` (inspected via `git show`, never checked out) | YES |
| Research branch `research/nuewave-longtail` | `13c2847543326f8c2ce8485b26a1c1f0520cfa1b` | `13c2847…` (inspected via `git show`) | YES |

Branch relationship established: `research/nuewave-longtail` is a strict superset
of `merge/nuewave-docs` for planning content (adds `dss-native-chrome-audit.md`,
`standalone-services-audit.md`; newer `merge-ledger.md`, `roadmap.md`,
`merge/README.md`). All ledger citations below use the research branch.

**The closed decision ledger** (G-001 resolved): the canonical ledger is
`docs/plans/nuewave-native/merge/merge-ledger.md` on `research/nuewave-longtail`
@ `13c2847`, together with dated `Ruled:` lines in
`merge/route-reconciliation.md` and `merge/pattern-review.md` and the eight
rulings in `merge/README.md`. It exists **only on the planning branches** — it
is not present in the implementation baseline at `dec12f2`. Ledger state at the
pin: 101 rows — 43 `✔` ruled with dates, 57 `◐` researched with **empty
verdicts**, 1 `☐` glyph inconsistency (coding-agent future row). Two standing
deferrals: **B** (auth mount) and **C3** (`/.well-known`/native links).

### 1.2 Method

For every material claim: (a) locate the claim in a package doc or planning
doc; (b) resolve its cited source pointer at the verified pin; (c) for counts
and negatives, re-derive the number/absence with an independent repo-wide
mechanical method (grep/AST-adjacent counting over `crates/`, `services/`,
`apps/`, `infra/`, migrations, wrangler configs, OpenAPI specs) rather than
re-reading the citation; (d) mark
`verified | corrected | unverified | incomplete | owner-dependent`.

### 1.3 Coverage statement (honest limits)

- **Covered**: all 16 rows of `11-GAP-RISK-REGISTER.md`; the scope/authority
  claims of `01-AUTHORITY-AND-SCOPE.md`; the architecture premises of
  `04-TARGET-CLOUDFLARE-ARCHITECTURE.md`; the compatibility estimates of
  `06-API-RPC-COMMAND-COMPATIBILITY.md`; the migration premises of
  `08-DATA-MIGRATION-AND-CUTOVER.md`; the build order of `10-DELIVERY-PLAN.md`;
  the merge ledger's ruled and researched rows (sampled: every row named in the
  WP-010 mandatory gap list, plus every row carrying an exact count or a
  negative claim); both endpoint inventories (sampled); `schema-harvest.md`
  table arithmetic (fully re-derived); both research audits' headline numbers;
  the six-Worker census; the Lambda census; the frontend route/split/block
  registries; kernel primitive existence in `cloudflare-os` at `bf7f762`.
- **Sampled, not exhaustively re-derived**: per-crate LOC figures (re-derived
  exactly for `entity_access` only; others trusted as order-of-magnitude);
  per-endpoint tables in `endpoint-inventory-backend.md` (structure and 3
  service sections checked, not all 857 lines); hotkey registration sites
  (mechanical CSV + file census only — full dynamic expansion is WP-020 scope).
- **Not verifiable from repos** (owner-dependent): whether any production/live
  data exists (ruling 8's premise); SEC-1/2/3 hole details (Linear-sourced,
  SUP-474); Cloudflare OS upstream velocity (no network); source object counts
  for migration (no DB access); the provenance of the package's four
  "deliberate exceptions" (see §4, CON-2).
- **Tools**: mechanical greps can miss dynamically-constructed strings,
  macro-generated code (handled case-by-case: `FileType`, topics macro), and
  build-script surfaces. Where a count method has a known ±, it is stated.

## 2. Claim-by-claim table

Verdict key: **V** verified · **C** corrected · **U** unverified ·
**I** incomplete · **OD** owner-dependent. All Neuwave paths at `9f7a26b`;
ledger = `merge/merge-ledger.md` @ research branch `13c2847`; package docs at
`dec12f2` + this worktree.

### 2.1 Authority, scope, ledger

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| A1 | A closed decision ledger with owner verdicts exists and governs scope | 01-AUTHORITY §1; G-001 | Located on branches; counted rows/verdicts | **V** (location) / **C** (closure) | Ledger exists but is **not closed**: 57 of 101 rows have empty `Verdict:` slots; only 43 dated rulings. It also lives only on planning branches, not the implementation baseline. |
| A2 | Default ruling: keep-faithful unless explicitly killed/parked (Q19) | 01-AUTHORITY; ledger header | Read ledger header + roadmap status log | **V** | merge-ledger.md:17-23; roadmap.md status log (ruling pass 1) |
| A3 | Explicit kills: graphql_soup, FusionAuth, AWS substrate; parked: business chrome | 01-AUTHORITY §Scope | Ledger rows | **V** | merge-ledger.md:19,37 (graphql_soup killed 2026-08-19), :71 (auth rebuilt, FusionAuth dead), README ruling 2 (nothing keeps running on AWS), :117 (parked) |
| A4 | Four deliberate exceptions are prior owner rulings (MCP server in pilot; ungoverned OpenAI proxy; seven-source search; self-hosted converter) | 01-AUTHORITY §Deliberate exceptions | Grep both branches for these rulings | **OD** | **Not traceable to the ledger at the observed pins.** The corresponding rows (`mcp_service+mcp_auth_proxy` ledger:83, `streaming/completions` :65, `search_service` :38, `convert_service` :82) all carry empty verdicts, and the audits recommend the opposite direction for two of them (proxy = "one clear kill candidate"; converter = container/API/drop options). Treated per instruction as controlled owner decisions made outside the recorded ledger; they must be written into the ledger with dates (see OD-2). |
| A5 | Harvest rules supersede clean-room; tripwires = no Macro branding, no Rust reuse; three-service WASM lift carve-out | merge/README ruling 1 | Read both docs; check supersession markers | **V** | merge/README.md:15-32; roadmap.md §2 marked SUPERSEDED |
| A6 | Branding tripwire is real (macro-* assets exist in source) | G-015; 07-UI-UX | `find apps/web -name 'macro-*'` | **V** | `apps/web/public/macro-favicon.svg`, `apps/web/src/components/icon/macro-logo.svg`, `macro-logo-badge.svg`, `macro-google.svg`, +more |

### 2.2 Entity access / authorization core (G-004)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| B1 | `entity_access` = 62 files, 6,448 non-test LOC, 13,519 test LOC (68% tests) | dss-native-chrome audit; ledger:50 | Independent `find`+`wc` split by test files | **V (exact)** | 62 `.rs` files; 19,967 total LOC; non-test = 6,448; test = 13,519 (`crates/entity_access/`) |
| B2 | 14 typed axum extractors (`EntityAccessReceipt<L>`) | ledger:50 | List non-test extractor modules | **V** | `crates/entity_access/src/inbound/axum_extractors/`: bot, call, channel, chat, document, entity_body, entity_permission, foreign_entity, history, pin, project, reminder, team, thread = 14 |
| B3 | 13 per-entity-type access-query modules | ledger:50 | List query modules | **V** | `crates/entity_access/src/outbound/pg_access_repo/queries/`: call_access, call_channel, channel_membership, channel_role, channel_users, chat_access, crm_company_access, crm_contact_access, document_access, foreign_entity_access, project_access, team_access, thread_access = 13 |
| B4 | Earlier scoping misclassified entity access as chrome; it is the authorization core every kept domain depends on | G-004; audit | Confirmed by B1-B3 scale + extractor use across services | **V** | as above; receipts are compile-time obligations in handlers |
| B5 | SEC-1/2/3 share-permission holes live in this crate's tests; ruled "fixed, not recreated" | ledger:158; roadmap | Repo search for SEC-1/2/3 markers | **U / OD** | Ruling verified (ledger §6, Q20 2026-08-19). Hole specifics come from Linear SUP-474, which is outside both repos; not independently verifiable here. WP-020 must extract the concrete test semantics. |
| B6 | Favorites read-side gap: add requires `EntityAccessReceipt<View>`, listing re-checks nothing | ledger:42 | Read `crates/favorites/src/domain/service.rs:100-113` | **V** | `list_favorites` passes straight to repo, no receipt |

### 2.3 Soup / lists / materialized index (G-005)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| C1 | Soup crates exist as the list/feed engine; graphql_soup is the wire layer | ledger:36-37 | `ls crates` | **V** | `crates/soup`, `crates/graphql_soup`, `crates/soup_realtime`, `crates/models_soup` |
| C2 | Ruling 1a: adopt Entity=(type,id) ontology; entity registry + tombstones + **required** materialized-index layer; per-type access policy stays code | ledger:193; pattern-review §1 | Read dated ruling | **V (ruling)** | merge-ledger.md:193 "Ruled 1a (2026-08-19)" |
| C3 | EAV-style cross-entity filtering is the kernel's one genuine storage gap | roadmap (merge review pass); pattern-review §2 | Kernel typed-storage inspected (user.ts collections; no cross-DO query plane) | **V (inference confirmed)** | `cloudflare-os/packages/workshop-backend/src/user.ts:151-220` typed collections are per-DO; no cross-entity index primitive found in `packages/` |
| C4 | Soup/search substrate are one architectural slot to be designed together | ledger:38 | Consistency check vs D1/1a ruling | **V (as proposal)** | ledger:38 "Rule with search_processing_service — one system" (verdict still empty → OD-5) |

### 2.4 Notifications (G-009)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| D1 | Exactly 19 notification types (22 metadata structs) | ledger:75; standalone audit §A | `grep -c 'const TYPE_NAME'` / `grep -c '^pub struct'` | **V (exact)** | `crates/model_notifications/src/metadata.rs`: 19 TYPE_NAME consts, 22 structs |
| D2 | Three egress channels: WebSocket, mobile push (APNS/FCM via SNS, incl. iosvoip/CallKit), batched email digests | ledger:75 | Read egress service struct + outbound modules | **V** | `crates/notification/src/domain/service/egress.rs` (`websocket`, `mobile`, `email`, digest state machine); `crates/notification/src/outbound/mobile.rs` (voip) |
| D3 | 11 notification tables | ledger:75; schema-harvest §4 | Re-derived live-table set | **V (exact)** | channel_notification_email_sent, notification, notification_email_sent, notification_email_unsubscribe, notification_email_unsubscribe_code, notification_message_receipt, notification_user_device_registration, user_mute_notification, user_notification, user_notification_item_unsubscribe, user_notification_type_preference |
| D4 | ~22 endpoints (19 spec ops) | EB §6 | OpenAPI method count + `.route(` census | **V (approx, as stated)** | `packages/sdk/specs/notification.json`: 17 paths / 19 methods; 20 `.route(` registrations |
| D5 | GitHub alone produces 7 of the 19 types | ledger:47,75 | Type-name census in metadata.rs (github_pr_*/github_review_requested) | **V** | 7 github-prefixed TYPE_NAMEs of the 19 |
| D6 | Provisional "Drop" verdict is stale and load-bearing: every producer domain is ruled keep | ledger:75 | Cross-check producer rulings | **V** | channels/mailbox/CRM/calls/calendar/reminders keep-rulings all dated 2026-08-19; notification row verdict itself **empty** → OD-3 |
| D7 | Mobile push has no kernel analogue; SNS does not come along | ledger:75 | Kernel package census | **V (inference)** | No push/APNS/FCM module in `cloudflare-os/packages/*` at bf7f762 |

### 2.5 Search (G-010)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| E1 | Search covers exactly 7 indexed entity types; backend is OpenSearch; search_service does query+enrichment, not indexing | ledger:38 | List per-entity handlers + consumers; `ls infra/stacks` | **V** | `crates/search_service/src/api/search/{call_record,channel,chat,crm_company,document,email,project}.rs` = 7; `services/search_processing_service/src/inbound/kafka_consumer/{call,channel,chat,document,email,project,property}.rs` = 7 consumer modules; `infra/stacks/opensearch` exists |
| E2 | "Seven-source search" (package phrasing) means seven external/query sources | 01-AUTHORITY §exceptions; 05-MAP; G-010 | Same as E1 | **C** | The number seven is the count of **indexed entity types in one OpenSearch index** (enriched from Postgres), not seven search providers/sources. Package wording invites over-building a "query router over provider sources" (04-TARGET table repeats this). Rewrite the requirement as "7-entity-type coverage contract + ranking/freshness parity". |
| E3 | The `macro.*` Kafka bus is 14 topics and is the event-bus contract for the rebuild | ledger:80; roadmap finding (4) | Read canonical registry `crates/macro_event_topics/src/lib.rs` | **C** | Registry declares **13** topics: 12 product (`macro.bots/calls/documents/soup/projects/properties/teams/channels/email/webhooks/mentions/chats`) + `macro.example` (test/example). **`macro.com` is not a topic** (it is the cookie/host domain in `services/authentication_service/src/api/utils.rs:66`); **`macro.activity_events` is not a topic** (UUIDv5 namespace bytes at `crates/activity/src/domain/models.rs:40`). Activity events flow via the DB fact log, not a bus topic, at this pin. |

### 2.6 Static files, unfurl, image proxy, SSRF (G-006, G-007)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| F1 | Static-file metadata lives in DynamoDB, not Postgres; second unharvested non-Postgres store | ledger:77; standalone audit | Read config + handler imports; grep schema-harvest | **V** | `services/static_file_service/src/config.rs` (`static_file_service_dynamodb_table_name`); every handler uses the DynamoDB client; `schema-harvest.md:364` records DynamoDB only for `BulkUploadRequest` |
| F2 | SSRF defence is DNS-resolution-based in three places and unportable to Workers as-is | ledger:45,78,79; standalone audit §C1 | Read all three guards | **V** | unfurl: `services/unfurl_service/src/http_safety/mod.rs:91-115` (`lookup_host` + `is_private_ip`); outbound webhooks: `crates/webhook/src/outbound/http_validator.rs` (`validate_resolved_endpoint_url`, `is_blocked_ip`); image proxy: `services/image_proxy_service/src/api/proxy/resolver.rs` (custom reqwest DNS resolver filtering private IPs — note: this one is a *connect-time* filter, slightly stronger than check-then-use; the Workers gap is the same) |
| F3 | image_proxy does not transform images; it is a streaming CORS/hotlink laundering fetch; resizing is the separate `image_optimizer` Lambda | ledger:79 | Read proxy module; Lambda census | **V** | `services/image_proxy_service/src/api/proxy/mod.rs`; `services/image_optimizer` in Lambda census |
| F4 | unfurl has no cache layer (absence claim) | ledger:78 | Repo-wide grep `cache` in unfurl service + crate | **V (re-run)** | zero matches in `services/unfurl_service/src`, `crates/unfurl/src` |
| F5 | `/proxy` path collision between unfurl and image proxy | ledger:78-79; route-reconciliation §7 | Route greps | **V** | `services/unfurl_service/src/api/proxy/mod.rs` and `services/image_proxy_service/src/api/mod.rs:48` both mount `/proxy` |

### 2.7 Converter and media substrate (G-008)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| G1 | convert_service embeds LibreOffice via `rs-libreoffice-bindings` pinned `056a40d`, Collabora `core-co-25.04` assets, MS core-fonts EULA | ledger:82 | Read Cargo.toml + Dockerfile | **V** | `services/convert_service/Cargo.toml` (git dep rev `056a40ddfac…`); `docker/Dockerfile.convert_service` (core-co-25.04-assets.tar.gz download; fonts EULA acceptance) |
| G2 | ffmpeg has no Workers successor; used by call-recording previews | ledger:90; roadmap | Repo-wide ffmpeg grep | **V** | only `services/call_recording_preview_handler/src/ffmpeg.rs` (+event.rs, lib.rs) |
| G3 | Converter is the producer of `DocumentContentLocation::ConvertedPdf` and must be ruled with the documents content model | ledger:82 | Read content enum | **V** | `crates/documents/src/domain/content.rs:26-38` — 5 locations: ObjectStorage, SyncService, DocxBomParts, ConvertedPdf, Unknown |

### 2.8 Lambda/batch, workers census, already-CF services (G-011 adjacent)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| H1 | Exactly 20 Lambda handler crates + 1 ECS worker | ledger:90; lambda audit | `grep -l lambda_runtime|lambda_http services/*/Cargo.toml` | **V (exact)** | 20 crates (list matches audit's 7 families exactly); `services/sha_cleanup_worker` = the ECS worker |
| H2 | Exactly six Cloudflare Workers at the pin; three outside the lift set; coding-agent-worker has no wrangler config | ledger:88; standalone audit §G | Repo-wide `wrangler.*` census | **V (exact)** | `services/{lexical-service,ai-editing-worker,sync-service,analytics-proxy}`, `services/bots/{anthropic-status-bot,stripe-payment-bot}` = 6; lift set = sync/lexical/ai-editing → outside = analytics-proxy + 2 bots; no wrangler file under `services/coding-agent-worker` |
| H3 | coding-agent-worker is EMPTY at the pin (negative claim, ruling A3 premise) | ledger:86; route-reconciliation §4 | `ls -la` + full-tree find | **V (re-run)** | directory contains exactly one file: `bun.lock` (60,627 bytes); no source, no config |
| H4 | analytics-proxy is already a CF Worker; renames PostHog recorder to `runtime.js` to evade privacy filter lists | ledger:88 | Read src/index.ts | **V** | `services/analytics-proxy/src/index.ts:23-26` (comment + `POSTHOG_RECORDER_PROXY_SCRIPT_NAME = 'runtime.js'`) |
| H5 | `services/websocket-service` is a ~23-line Bun echo stub that must not become scope | roadmap long-tail log | `wc -l` | **V** | `services/websocket-service/src/index.ts` = 23 lines |
| H6 | Redis is load-bearing infra with no named CF successor | ledger:90(c) | Cargo.toml census | **V** | 22 crates/services reference redis (stream transport, backfill counters, cancellation pub/sub, sha-delete work set) |

### 2.9 Data model, migrations, email tables (G-013 adjacent)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| I1 | One physical Postgres DB; one migration stream of 267 files; "four databases" is logical grouping only | ledger §7; schema-harvest | Count migrations; check cross-domain DDL | **V** | `crates/macro_db_client/migrations/` = 267 files; email/comms/notification tables all created in the same stream; cross-domain cascade migration exists (comms→notifications) |
| I2 | 198 live tables (202 CREATE − 4 created-then-dropped) | schema-harvest:19,383 | Full create/drop lifecycle re-derivation incl. schema-qualified names and .down.sql exclusion | **C** | 202 distinct CREATE TABLE names confirmed, but **8** (not 4) are created-then-dropped in forward migrations: Macrotation, UserItemAccess, document_task, email_attachments_macro, **email_backfill_messages, email_backfill_threads, email_contact_search_index, github_app_installation_team**. Mechanical live count ≈ **194**. (±: partitioned/dynamic DDL not observed; none found.) |
| I3 | 24 live `email_*` tables (mailbox audit's correction of the ledger's 26) | company-mailbox audit:10; ledger:73 vs ledger:190 | Same lifecycle method filtered to `email_` prefix | **C** | Mechanical count = **23** (the audit's 24 apparently still counts `email_contact_search_index`, created 2026-03-11 and dropped 2026-04-15). Ledger §7 row still says 26 — doubly stale. Not material to any ruling; fix the numbers. |
| I4 | Two schemas already on D1 (sync-service peer map; ai-editing edit_traces) | ledger §7 | Migration-dir census | **V** | `services/sync-service/database/user-peer-mapping/migrations`, `services/ai-editing-worker/migrations` |
| I5 | `basic_schema_for_testing.sql` carried by five workers | ledger §7 | find | **V** | delete_chat_handler, document_text_extractor, organization_retention_trigger, organization_retention_handler, sha_cleanup_worker |
| I6 | `EntityType` = 16 variants; `property_entity_type` = 10 values; THREAD/TASK exist only in the latter | ledger:39,50; roadmap finding (3) | Enum counts in source + migrations | **V (exact)** | `crates/model-entity/src/lib.rs:34` (16 variants); `20251030100000` initial 6 + COMPANY + TASK (`20251128000000:3-4`) + CALL_RECORD (`20260709192942`) + CALENDAR_EVENT (`20260726023229`) = 10; THREAD/TASK have no EntityType variant |
| I7 | 413 `FileType` variants → 18 viewer associations | ledger:33 | Macro-entry counts | **V (exact)** | `crates/model_file_type/src/lib.rs`: 431 macro tuples = 18 `define_file_associations!` + 413 `generate_file_types!` |

### 2.10 Domain rows sampled (positive + negative claims re-run)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| J1 | `/chat/completions` is a 47-line hardcoded non-streaming proxy to api.openai.com with platform key, `stream` forced false | ledger:65 | Read file | **V (exact)** | `services/document_cognition_service/src/api/completions.rs` = 47 lines; `OPENAI_CHAT_COMPLETIONS_URL` const; `stream=false` inserted |
| J2 | Favorites: cap 500; fractional sort_order; publishes no events | ledger:42 | Read service; grep kafka/event in crate | **V** | `MAX_FAVORITES_PER_COLLECTION = 500` (`crates/favorites/src/domain/service.rs:17`); zero kafka/topic references in crate |
| J3 | Webhook (outbound) delivery: max 5 attempts, backoff 30/60/120/300s; HMAC `x-macro-*` signing; `UNIQUE(webhook_id, event_id)` idempotency; row was mislabelled "ingestion" | ledger:45 | Read delivery.rs + migration | **V** | `crates/webhook/src/domain/delivery.rs:17-24` (`MAX_HTTP_ATTEMPTS=5`, `RETRY_DELAYS=[30,60,120,300]s`) |
| J4 | Bot token format `mbot_<12-hex-prefix>_<64-hex-secret>` | ledger:46 | Read tokens.rs | **V** | `crates/bots/src/domain/tokens.rs` (6 prefix bytes → 12 hex; 32 secret bytes → 64 hex) |
| J5 | GitHub webhook handles exactly 6 event types; unknown skipped | ledger:47 | Read enum + dispatch | **V** | `crates/github/src/domain/models/sync.rs:512-527` (PullRequest, IssueComment, PullRequestReview, PullRequestReviewComment, CheckRun, Installation, Unknown(String)) |
| J6 | Import: hardcoded 3-source enum pinned to hosted MCP URLs and fixed target entity types | ledger:60 | Read models.rs | **V** | `crates/import/src/domain/models.rs`: Linear→mcp.linear.app→task; Notion→mcp.notion.com→md; Slack→mcp.slack.com→channel |
| J7 | Memory: one blob per user; 24h stale-while-revalidate | ledger:59 | Read service.rs | **V** | `crates/memory/src/domain/service.rs:104` (`MAX_AGE = 24h`) |
| J8 | `AiFeature` enum = 10 values (complete AI-spend inventory) | ledger:62 | Read ports.rs | **V (exact)** | Chat, Memory, Automation, DynamicCompletionsApi, ChatRename, CallSummary, ChannelBot, AiProjection, AiEditing, Import |
| J9 | scheduled_action `ActionKind` has exactly one variant (`Agent`) — "automation = scheduled chat" | ledger:81 | Read models.rs | **V** | `services/scheduled_action/src/domain/models.rs:53-55` |
| J10 | Activity: closed 10-action vocabulary; renaming a variant is a storage migration; uuidv5 ids | ledger:50 | Read models.rs | **V** | `crates/activity/src/domain/models.rs:95-125`: Created, Edited, Opened, Deleted, Messaged, Sent, PropertyChanged, ParticipantAdded, ParticipantRemoved, CallStarted = 10; UUIDv5 namespace at :40 |
| J11 | Frecency: score = 0.7×frequency + 0.3×recency, decay 0.1/hour, last 10 events | ledger:50 | Read models.rs | **V (exact)** | `crates/frecency/src/domain/models.rs:199-205` (MAX_RECENT_EVENTS=10, RECENCY_DECAY_RATE=0.1, FREQUENCY_PERCENT=0.7) |
| J12 | Mailbox: Gmail-API send (no SMTP); GCP Pub/Sub push sync is a hard dependency | ledger:73; mailbox audit | Repo-wide smtp/pubsub greps | **V (re-run)** | smtp appears only as a provider domain string in `crates/email_utils/src/generic_email/mod.rs:95`; pubsub throughout `services/email_service/src` |
| J13 | mcp_auth_proxy exists because FusionAuth lacks DCR (substrate-motivated) | ledger:83 | Read README | **V** | `services/mcp_auth_proxy/README.md:1-3` |
| J14 | No Instantly connector exists in either codebase | connectivity audit; ledger:74 | Case-insensitive grep both repos | **V (re-run)** | Only adverb usages ("disappearing instantly", kernel UI copy). No connector, client, or config in Neuwave@9f7a26b or Outreach-OS@dec12f2 |
| J15 | contacts_service is NOT CRM — a user↔user connections graph; re-ruled keep-standalone | ledger:76; crm audit §A3 | Read audit's cited table/DDL | **V** | `contacts_connections(user1,user2)` with `CHECK(user1<=user2)` (crm-audit:63); re-ruling dated 2026-08-19 batch E |
| J16 | DSS routers double-mounted at root and `/dss` | ledger:33 | Read api/mod.rs | **V** | `services/document_storage_service/src/api/mod.rs:289-291` (`.merge(dss_router.clone()).nest("/dss", dss_router)`) |
| J17 | documents = 25 endpoints (22 hex + 3 DSS-native), 5 creation flavors, 15 tables, 8 events | ledger:33 | Method-registration counts | **I** | Hex router has 23 method registrations (`crates/documents/src/inbound/axum_router.rs`) vs claimed 22; DSS-native handlers confirmed present. ±1 discrepancies at this granularity are exactly what WP-020's exact ledger must settle; not premise-breaking. |
| J18 | connection_gateway: WS upgrade at `GET /`; `GET /track/{entity_type}/{entity_id}`; `POST /message/send/...`; `POST /batch_send` | ledger:72 | Read routers | **V / C (one label)** | Mounts verified (`api/mod.rs:22-23`, `connection/mod.rs:34`, `message/mod.rs`). **Correction:** `/track/{type}/{id}` is an **internal JSON presence query** (`entities/mod.rs`, `InternalOnly` extractor), not the WS upgrade; the upgrade is the literal `GET /`. The row states both; the "(the WS upgrade)" label on /track is wrong. |
| J19 | Server→client gateway event types are free-form strings; 5 type families found | ledger:72 | Spot-checked publishers | **V (sampled)** | `crates/connection_gateway_client/src/client/{email,calendar}.rs` (`refresh_email`, `refresh_calendar`); StreamEvent/UploadFolderStatusUpdate via cited models |

### 2.11 Frontend, routes, commands, native (G-003, G-011)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| K1 | 27 top-level routes registered in `ROUTES` at `apps/web/src/routes/Root.tsx:223` | EF §1 | awk/grep count | **V** | 26 `path:` entries + `LAYOUT_ROUTE` (`/*splits`) = 27 |
| K2 | Split registry: 28 always + 19 LOCAL_ONLY + 5 DEV_MODE_ENV = 52 registrations | EF §2 | `grep -c registerComponent` | **V (exact)** | `componentRegistry.tsx`: 52 `registerComponent(` calls |
| K3 | 16 concrete block types + aliases (csv→code; task/snippet/skill→md; write virtual) | EF §3; ledger §5 | Feature-dir census | **V** | 16 `block-*` dirs under `apps/web/src/features/` |
| K4 | Settings: 12 nav tabs in 3 groups at `settingsTabsConfig.tsx:48` + legacy URL-only slugs | EF §6 | Read config | **V** | `apps/web/src/lib/core/constant/settingsTabsConfig.tsx:48` (note the ledger row cites the wrong dir; EF has the correct path) |
| K5 | Command/hotkey inventory is distributed and dynamic; mechanical extraction is not final | 06-COMPAT; G-003 | Mechanical CSV + registration-site census | **V (premise)** / **I (inventory)** | `reports/generated/neuwave-hotkeys-mechanical.csv` = 264 rows; 64 files in `apps/web/src` register hotkeys; settings alone registers Tab/Shift+Tab/1-9/Escape in loops (`Settings.tsx:134-205` per EF). Exact expansion = WP-020. |
| K6 | Native/desktop reality: desktop shell (Tauri) is in-repo; mobile-native shells are not | G-011; EF header | find tauri; find ios/android | **V + C (nuance)** | `apps/web/tauri/src-tauri/tauri.conf.json` exists at the pin — the desktop shell **is harvestable**. No iOS/Android app source anywhere in the repo, while notification egress targets ios/android/**iosvoip** (CallKit) SNS endpoints — **mobile-native behavior cannot be fully harvested from this pin** (interacts with deferral C3 and OD-9). |
| K7 | Design tokens concentrated in an OKLCH-based CSS file | 07-UI-UX | grep oklch | **V** | `apps/web/src/index.css` (+ feature CSS) |

### 2.12 Kernel / Cloudflare OS (G-002, G-012)

| # | Claim | Source | Method | Verdict | Evidence |
|---|---|---|---|---|---|
| L1 | Kernel RPC surface ≈ 187 methods in `workshop-shared/src/api.ts`; exact count must be generated | 06-COMPAT | Mechanical parse + independent grep | **V (estimate bounded)** | `api.ts` = 2,904 lines; mechanical CSV = **181** method rows; independent grep = 181. "~187" is a fair estimate; exact disposition per method = WP-020 (multiline/generic signatures still need manual review, as the doc itself says). |
| L2 | Kernel primitives named in 04-TARGET exist (User DO, Overseer DO, gatekeeper fleet, gatekeeper-github/-mcp/-scheduler, typed storage, capnweb `/api`) | 04-TARGET; ledger cross-refs | Package census at bf7f762 | **V** | `packages/workshop-backend/src/{user.ts,overseer.ts}`; `packages/{gatekeeper-github,gatekeeper-mcp,gatekeeper-scheduler,typed-storage,router,workshop-shared}` |
| L3 | Cloudflare OS is pinned early-access software; upgrade burden is a live risk | G-012 | Submodule log | **V (partial) / OD** | Pin `bf7f762` dated **2026-08-05** (15 days before rewrite start). Upstream velocity/diff not checkable offline. Note: the planning branches carry a kernel patch (`patches/sup-536-openrouter-kernel.patch`) — kernel patching has already happened once in this program's history; the ADR+budget rule (04-TARGET §kernel-change budget) is not hypothetical. |
| L4 | Env/secrets inventory exists | G-implied; 08 stage 1 | Search all docs, both branches | **C (does not exist)** | No consolidated env/secrets inventory anywhere. Sizing evidence: 16 Cargo.tomls use `secretsmanager_client`, 2 use `remote_env_var`, 17 distinct direct `std::env::var` keys, plus typed `macro_config` structs per service; old custody = AWS Secrets Manager + Doppler (`infra/stacks/doppler-projects`, killed by roadmap). A real inventory requires harvesting every service's config struct — new gap-register row G-017 below. |

## 3. High-risk gap findings

1. **Entity access (G-004)** — confirmed exactly as audited (B1-B3). It is the
   largest test-encoded specification in the codebase (13.5k test LOC) and the
   only executable form of the share-permission invariant. Finding: the plan
   is right to sequence it first; nothing in the wave-4 sequencing of
   `10-DELIVERY-PLAN.md` conflicts, but WP-020 must extract the SEC-1/2/3 test
   semantics because the holes themselves are documented only in Linear (B5).
2. **Soup / materialized index (G-005)** — ruling 1a's "required
   materialized-index layer" is well-grounded: the kernel has no cross-entity
   query plane (C3), and Soup, favorites hydration (6-way join), search
   enrichment, and property filtering all converge on that one slot. Risk: the
   ledger proposes but does not yet rule the search/soup substrate unification
   (OD-5).
3. **Notifications (G-009)** — 19/3/11 numbers exact; the stale provisional
   "Drop" is the single most dangerous stale verdict in the old plans because
   Q19's default-keep now implies the opposite. Mobile push is the one
   component with no kernel analogue and no in-repo native client to test
   against (D7, K6).
4. **Static-file metadata (G-006)** — DynamoDB store confirmed unharvested;
   any migration/parity work is blocked on reading that table's live shape
   (owner/production access needed — object counts are owner-dependent).
5. **SSRF-by-DNS (G-007)** — three independent implementations confirmed; one
   shared ruling needed (OD-6). Note nuance: image-proxy's resolver-level
   filter is the strongest of the three; the parity bar should be
   "resolver-level or better", not "port the check-then-use pattern".
6. **Converter (G-008)** — LibreOffice pin, Collabora assets, and fonts EULA
   confirmed; plus ffmpeg as the second media-substrate gap. If the
   "self-hosted converter remains" exception stands (A4/OD-2), the realistic
   substrate is a Cloudflare Container and the exception must carry the
   boundary/threat/rollback documentation demanded by 01-AUTHORITY.
7. **Seven-source search (G-010)** — corrected framing (E2): 7 entity types,
   one OpenSearch index, Postgres enrichment. The golden-query parity gate in
   05-MAP is the right proof; the "query router over provider sources" phrasing
   in 04-TARGET should be fixed before it misleads an implementation agent.
8. **Native/desktop (G-011)** — new fact: the Tauri desktop shell is in-repo
   and harvestable; iOS/Android are not, while notification egress and auth
   flows (`tauri.localhost`, mobile welcome, iosvoip) prove native surfaces
   exist. Any "faithful recreation" claim for mobile must be scoped to what is
   observable (OD-9).
9. **Migration/source counts (G-013)** — premise conflict with ruling 8; see
   CON-1. Object counts unknowable from the repos; requires owner/production
   access either way.
10. **Env/secrets (L4)** — no inventory exists; new row G-017.
11. **Cloudflare OS upgrade burden (G-012)** — pin is recent but the program
    has already patched the kernel once on a planning branch (L3); the
    kernel-change budget needs to be enforced from wave 0, not wave 2.
12. **Already-CF workers outside the lift set** — exactly three (analytics-proxy
    + two channel bots). The two bots are the only working reference for the
    `x-macro-bot-token` webhook contract (ledger:46); they need an explicit
    disposition row so they are neither silently dropped nor accidentally
    treated as lift-set members.
13. **Exact kernel RPC surface (G-002)** — 181 mechanical methods at bf7f762;
    manual review of multiline/generic/callback signatures still required
    (WP-020). No premise break found in the ~187 estimate.

## 4. Contradictions vs the closed ledger

| ID | Contradiction | Authority resolution | Action |
|---|---|---|---|
| CON-1 | **Package migration workstream vs ruling 8.** `08-DATA-MIGRATION-AND-CUTOVER.md` (all 7 stages incl. dual-run, cutover, decommission), `10-DELIVERY-PLAN.md` wave-4 item 10, `12-DEFINITION-OF-DONE.md` ("Data is migrated and reconciled"), and G-013 all mandate live-data migration. The closed ledger's ruling 8 (merge/README.md:52-56, roadmap status log) says: **"schemas over, data doesn't — the four Postgres databases hold no live data."** | Owner ruling outranks package prose → as recorded, the migration/cutover/decommission workstream is built on a premise the ledger denies. But the ruling's own factual premise (no live data anywhere: Postgres, DynamoDB ×2, Redis, S3, OpenSearch, FusionAuth) is a production fact this review cannot verify. | **OD-1** — owner must confirm the no-live-data premise and then either shrink 08 to "schema adoption + seed + (if any) small export" or scope a real migration. Do not run WP-020+ migration profiling until answered. |
| CON-2 | **The four "deliberate exceptions" vs the ledger's empty verdicts.** 01-AUTHORITY presents MCP-server-in-pilot, ungoverned OpenAI proxy, seven-source search, and self-hosted converter as prior owner rulings. At the observed branch pins, the corresponding ledger rows are unruled, and the audits lean the other way on two (proxy = kill candidate; mcp_auth_proxy = dissolves with auth rebuild). No dated ruling text for any of the four exists on either branch. | Per instruction these are controlled owner decisions (presumably from a session after `13c2847`), and this review does **not** dispute them. But the ledger is the system of record and currently contradicts the package. | **OD-2** — record the four rulings in the ledger with dates; add the boundary/threat/observability/rollback documentation 01-AUTHORITY itself demands; correct "seven-source" phrasing (E2). |
| CON-3 | **Stale provisional verdicts vs Q19 default.** Old provisional drops still visible in ledger research columns: notification_service ("Drop"), call/reminders/calendar (struck-through "Drop", since ruled keep), email ("Drop — Instantly instead", corrected), channels ("keep-thin vs drop"). All are superseded by dated rulings or by the Q19 default, but the notification row has no dated verdict at all. | Ledger rulings + Q19 default win; the package's 05-MAP correctly lists notifications as kept. | **OD-3** — get an explicit dated verdict for notification_service (and its APNS/FCM consequence) rather than resting a large build on the default rule. |
| CON-4 | **Build order vs P1-centerpiece ruling.** The ledger rules the agent connectivity layer "Build as the P1 outreach centerpiece (2026-08-19)" (ledger:74); `10-DELIVERY-PLAN.md` sequences "agent connectivity, MCP, webhooks, automation" **8th** of 10 in wave 4. The package labels its order "a proposal", so this is a tension, not a violation — but an agent following 10-DELIVERY literally would invert the owner's stated product priority. | Owner ruling outranks the proposal. | **OD-4** — owner confirms whether outreach-first priority survives full absorption, and WP-030's build graph must encode the answer. |
| CON-5 | **"Closed ledger" framing vs 57 unruled rows.** The package repeatedly refers to "the closed decision ledger" and 05-MAP says the ledger "owns final keep/kill/defer verdicts". The ledger at the pin is research-complete but **verdict-incomplete** (57 ◐ rows, empty verdicts; B and C3 deferred). Q19's default-keep covers scope, but many rows carry proposal-level architecture questions the default does not answer (documents row split G1/G2/G3, DSS-native split N1/N2/N3, search substrate, DLP, Redis, ffmpeg, frecency/activity rows that don't exist). | Ledger as-is + Q19 default is the authority; the package overstates closure. | **OD-5** — batch-rule the 57 rows (or delegate specific proposal choices) before WP-030 freezes the build graph. |
| CON-6 | **Superseded old plans still on the branches.** `roadmap.md` §2 clean-room rules, §3 P0-P3 phasing, `platform-parity-map.md`, `shell-ux-rebuild-plan.md`, `original-linear-plan-review.md`, and the concept docs in `reference/platform-context/` are all pre-absorption or pre-harvest artifacts. All are explicitly marked superseded or covered by ruling 7 ("no verdict from concept-only docs survives on trust"), so they are not live contradictions — but they satisfy G-016's "agents may pick whichever plan is convenient" risk if handed to an agent uncurated. | Marked-superseded docs stay historical evidence only. | Keep G-016 open until WP-030 publishes the single conflict-resolution report; this section is its first input. |

Contradiction count: **6** (2 premise-level: CON-1, CON-2; 4 process/staleness:
CON-3..CON-6). Corrected factual claims: **7** (A1-closure, E2, E3, I2, I3,
J18-label, L4) plus 2 incomplete counts flagged (J17, D4-adjacent auth "~79").

## 5. Separated lists

### 5.1 Verified facts (load-bearing subset; all at pins §1.1)

1. entity_access: 62 files; 6,448 non-test / 13,519 test LOC; 14 extractors; 13 access-query modules.
2. 19 notification types; 22 metadata structs; 3 egress channels (WS, SNS mobile incl. iosvoip, email digests); 11 tables; 7 of 19 types are GitHub's.
3. Search: 7 indexed entity types; OpenSearch substrate; 7 matching indexing consumers; enrichment from Postgres.
4. Kafka topic registry: 12 product topics + macro.example (13 declared) — see corrected E3.
5. Static-file metadata in DynamoDB (unharvested); schema-harvest recorded DynamoDB only for BulkUploadRequest.
6. SSRF-by-DNS in unfurl + outbound webhooks + image-proxy (resolver-level).
7. convert_service embeds LibreOffice (rs-libreoffice-bindings @056a40d, Collabora core-co-25.04, MS fonts EULA); ffmpeg only in call_recording_preview_handler.
8. Exactly 20 Lambda crates + 1 ECS worker; exactly 6 CF Workers (3 in lift set, 3 outside); coding-agent-worker contains only a bun.lock.
9. `/chat/completions` = 47-line hardcoded OpenAI passthrough, stream forced off.
10. One physical Postgres DB, 267 migrations; 202 tables ever created, 8 dropped (mechanical live ≈194); 23 live `email_*` tables; 2 D1 schemas.
11. EntityType = 16; property_entity_type = 10; THREAD/TASK missing from EntityType; FileType = 413 (+18 associations).
12. Frontend: 27 routes; 28+19+5 split registrations; 16 blocks (+aliases); 12 settings nav tabs; OKLCH token file; Tauri desktop shell in-repo; no iOS/Android sources in-repo.
13. Kernel at bf7f762: 181 mechanically-parsed RPC methods in api.ts (2,904 lines); user/overseer DOs, typed storage, gatekeeper fleet incl. github/mcp/scheduler present.
14. Domain constants verified exactly: favorites cap 500 (no events; no read-side recheck); webhook 5×[30/60/120/300s] + HMAC + per-event idempotency; mbot token format; import's 3 hardcoded MCP sources; memory 24h; AiFeature ×10; ActionKind = {Agent}; activity 10-action closed vocabulary (uuidv5); frecency 0.7/0.3, 0.1/h decay, 10 events; Gmail-API send with no SMTP; GCP Pub/Sub dependency; contacts_connections user-graph table; mcp_auth_proxy's FusionAuth-DCR rationale; websocket-service 23-line stub; analytics-proxy recorder rename; macro-* brand assets present.

### 5.2 Inferences (stated as such, not facts)

1. The mechanical live-table count (194) and email-table count (23) use
   "latest forward CREATE vs latest forward DROP" ordering; exotic DDL would
   evade it (none was found).
2. Kernel "no cross-entity query plane" is an absence claim based on a package
   census at bf7f762; a deeper WP-020 pass over workshop-backend internals
   should confirm it.
3. The four deliberate exceptions most plausibly originate from an owner
   session later than the observed branch commits; treated as valid but
   unrecorded (CON-2).
4. The auth service's "~79 endpoints" is plausible (64 spec ops + internal/
   webhook/native routes) but was not exactly re-derived; EB itself flags it
   as approximate.
5. The documents-row endpoint arithmetic (22 hex vs 23 mechanical method
   registrations) is a granularity artifact, not a missing surface.

### 5.3 Recommendations

1. Fix the corrected numbers at their sources when docs are next touched:
   schema-harvest table math (198→194, dropped list of 8), ledger §7 email row
   (26→23), mailbox audit (24→23), ledger:80/roadmap "14-topic bus" (→12
   product topics; macro.com and macro.activity_events are not topics),
   ledger:72 /track label, ledger:114 settings-config path.
2. Rewrite "seven-source search" as "seven-entity-type search coverage
   contract" in 01-AUTHORITY, 04-TARGET, 05-MAP, G-010 before any search ADR.
3. WP-020 must include: (a) exact per-method RPC ledger incl. multiline
   signatures; (b) full dynamic hotkey expansion (64 registration files);
   (c) SEC-1/2/3 test-semantics extraction from entity_access tests;
   (d) env/secrets inventory harvested from every service's macro_config
   struct + secretsmanager/remote_env_var use + wrangler bindings (new G-017);
   (e) DynamoDB static-file table shape (needs owner/production access).
4. Treat image-proxy's resolver-level SSRF filter as the parity bar for the
   safe-fetch service design (G-007).
5. Add explicit ledger rows/dispositions for: frecency, activity-events
   vocabulary, DLP handler, Redis successor, ffmpeg/media, analytics-proxy
   stance, the two channel-bot workers, and the `documents`/`DSS-native`
   row splits — most are already flagged in the roadmap's "needs David" lists;
   they should not remain only in prose.
6. WP-030's build graph should encode CON-4's resolution and sequence
   entity-access + entity registry + index layer before any list-shaped
   domain, per §3.1-3.2.

### 5.4 Owner decisions needed

Summarized here; full mergeable entries in
`reports/notes/wp010-owner-decisions.md` (OD-1 … OD-10): (1) live-data/
migration premise; (2) record the four exceptions in the ledger + governance
docs; (3) notification verdict incl. mobile push; (4) connectivity-layer
build priority; (5) batch-ruling the 57 open rows + B/C3 deferrals;
(6) SSRF safe-fetch ruling; (7) entity-type canonicalization (TASK/THREAD);
(8) converter + ffmpeg substrate; (9) native/mobile scope; (10) kernel-patch
budget enforcement from wave 0.

## 6. Gap-register delta (template format)

```csv
id,status,severity,domain,claim_or_gap,evidence,impact,recommendation,owner_decision_needed,owner,next_action
G-001,resolved,high,governance,"Ledger located: merge/merge-ledger.md @ research/nuewave-longtail 13c2847 (+dated rulings in route-reconciliation.md, pattern-review.md, merge/README.md); not on implementation baseline","§1.1","Agents on main cannot see the ledger","Vendor the ledger (read-only copy) into the implementation repo or record branch+commit in AGENTS entrypoint",no,codex,copy-with-provenance in WP-020
G-002,open,high,rpc,"Kernel RPC mechanical count = 181 methods at bf7f762 (est. was ~187)","§2.12 L1","Estimate fine; per-method disposition still missing","Manual review of multiline/generic/callback signatures",no,codex,WP-020
G-004,validated,critical,authz,"entity_access numbers exact (62 files; 6,448/13,519 LOC; 14 extractors; 13 query modules); SEC-1/2/3 details only in Linear","§2.2","Authorization core; blocks all domains","Extract test semantics; design receipts subsystem first",no,codex,WP-020/WP-030
G-006,validated,high,files,"Static-file metadata confirmed in unharvested DynamoDB table","§2.6 F1","Migration/parity blind spot","Harvest table shape; needs production access",yes,David,grant access or rule it out-of-scope with OD-1
G-007,validated,high,security,"SSRF-by-DNS confirmed in 3 services; image-proxy uses resolver-level filter (strongest)","§2.6 F2","Workers cannot replicate check-then-use","One safe-fetch ruling covering unfurl/image/webhooks/connectors; resolver-level parity bar",yes,David,OD-6
G-009,validated,high,notifications,"19 types/3 egress/11 tables exact; provisional Drop stale; no dated verdict; mobile push has no kernel analogue and no in-repo native client","§2.4","Large build resting on default rule","Explicit verdict + push-channel decision",yes,David,OD-3
G-010,corrected,medium,search,"Seven-source = 7 indexed entity types on OpenSearch, not 7 providers","§2.5 E2","Mis-phrasing risks over-built query router","Fix wording in 01/04/05/G-010; golden-query parity stands",no,codex,doc fix + WP-030 search ADR
G-011,refined,medium,native,"Tauri desktop shell IS in-repo (apps/web/tauri); iOS/Android are NOT; iosvoip/CallKit egress exists","§2.11 K6","Mobile parity cannot be harvested from pin","Classify native behaviors; scope mobile explicitly",yes,David,OD-9
G-013,blocked,critical,migration,"Package migration workstream contradicts ruling 8 (schemas over, data doesn't; 'no live data')","§4 CON-1","Entire 08 workstream scope swings on one production fact","Owner confirms live-data premise",yes,David,OD-1 before any migration work
G-016,in-progress,high,governance,"6 contradictions catalogued (§4); superseded docs marked but present on branches","§4","Agents may follow stale plans","WP-030 single conflict report; this section is input",no,codex,WP-030
G-017,new,high,secrets,"No env/secrets inventory exists in any doc; old custody = AWS Secrets Manager + Doppler (both dead); 16 crates use secretsmanager_client","§2.12 L4","Deploys/parity will stall on unknown config surface","Harvest macro_config structs + bindings into an inventory",no,codex,WP-020
G-018,new,medium,ledger,"Kafka topic registry = 12 product topics (not 14); macro.com/macro.activity_events are not topics; table counts 198→194, email 26/24→23","§2.5 E3, §2.9 I2-I3","Event-bus contract and storage design start from wrong constants","Fix ledger/audit numbers at source",no,codex,doc fix
G-019,new,medium,scope,"Three already-CF workers outside lift set (analytics-proxy + 2 channel bots) have no disposition rows; bots are the only reference for the bot-webhook contract","§3.12","Silent drop or accidental lift","Add ledger rows",yes,David,batch ruling (OD-5)
```
