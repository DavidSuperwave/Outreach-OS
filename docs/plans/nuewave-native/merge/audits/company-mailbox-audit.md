# Domain audit — Company mailbox (email)

> Created 2026-08-19 by the merge-review pass (workstream 3, audit 3 of 3).
> Ruled 2026-08-19: "Keep, IN the pilot — full faithful recreation
> including send." Proposed substrate per ledger: Workers + Queues (sync),
> DO/D1 (threads), R2 (attachments). This audit is factual; the design
> comes later. Pointers: `[NW]` = Neuwave clone @ `9f7a26b`; `path:line`
> from the clone root. Verdicts are David's.
>
> **Ledger correction:** 24 live `email_*` tables at the pin, not 26 —
> the base schema created 17, later migrations added 10 and dropped 3
> (plus adjacent `document_email`, `mobile_welcome_email`).

## A. Endpoints

Deployable: `services/email_service` (axum, ECS) nesting `/email`,
`/gmail`, `/internal`, `/calendar` (`src/api/mod.rs:52-72`). "Hex" routers
live in `crates/email/src/inbound/axum/`. Convention: mutating
single-inbox routes carry `X-Email-Link-Id` middleware (default = primary
inbox); reads union across all accessible inboxes
(`crates/email/src/inbound/axum/axum_impls.rs:26,97-129,199-222`).

- **`POST /email/init`** (`api/email/init.rs:193`) — runs on *every*
  authentication. Registers the Gmail push watch, upserts `email_links`,
  and handles three connect paths: cross-user delegation
  (`macro_user_links` edge onto another user's inbox), self-link
  bootstrap, and same-user data-source link. `force_share=true` retries a
  409 `SharedInboxConflict` and **promotes a mailbox connected by two
  users into a shared inbox with its own minted FusionAuth user**
  (:442-500). Dedupes concurrent backfills via partial unique index;
  enqueues backfill Init; publishes `link_connected` (:638-740).
- **Threads** (`api/email/threads/`): cursor-paged previews per view
  (`Inbox|Sent|Drafts|Starred|All|Important|Other|user:<label>`,
  `crates/email/src/domain/models/preview.rs:31-45`) with filter AST and
  optional team-scoped CRM expansion (:20-27); get thread/messages;
  seen/archived; thread labels; assign thread to Project.
- **Messages**: `POST /email/messages` (send — §D); batch label modify
  (≤10, DB then gmail-ops queue, `labels.rs:277-294`); batch/single get.
- **Drafts**: DB-only drafts (never mirrored to Gmail drafts;
  `crates/email/src/domain/service/draft.rs:24-55`); attachment upload to
  S3 `draft/{draft}/{attachment}`; forwarded-attachment refs; scheduled
  sends (GET/PUT/DELETE over `email_scheduled_messages`).
- **Labels**: create (Gmail then DB), delete (queued op), list.
- **Contacts**: typeahead over the trigger-maintained search index;
  block/unblock sender (Gmail filter via gmail-ops); list blocked.
- **Filters**: sender/domain importance overrides (`email_filters`) —
  feed the Important/Other split and `is_signal`.
- **Attachments**: `GET /{id}` resolves the owning inbox across accessible
  links and serves a presigned CloudFront/S3 URL, fetching from Gmail into
  a temp S3 key on miss (`api/email/attachments/get.rs:60-160`);
  attachment→Document id via `document_email`.
- **Links**: list, health-check, delete, resync. **Backfill**: job
  list/get/active/cancel. **Settings**: per-link signature (+ on
  replies/forwards). **Sync**: disable.
- **`POST /gmail/webhook`** — GCP Pub/Sub push for Gmail watch; verifies
  the Google-signed JWT (with key-rotation retry), looks up link by
  email, enqueues incremental-sync op (`api/gmail/webhook.rs:19-72`).
- **`POST /calendar/notifications`** — Google Calendar watch webhook
  (token-checked, re-arms sync) + calendar mutation router gated on
  `calendar_sync_enabled`.
- **`/internal/*`** — service-to-service reads + backfill control + user
  deletion (`api/internal/mod.rs:14-31`).

## B. Tables (24 live `email_*`, `crates/macro_db_client/migrations/`)

Base `20251030154634_email_db_schema.sql`; core graph FK→`email_links`
CASCADE:

- **email_links** — one row per connected Gmail mailbox: `macro_id`
  (owner), `fusionauth_user_id` (identity holding the OAuth grant),
  address, provider (enum, GMAIL only), `is_sync_active`, `needs_reauth`/
  `last_sync_error_at`, generated `is_primary`.
- **email_threads** — per-link: provider_id (unique per link), denorm
  `inbox_visible`, `is_read`, latest inbound/outbound/non-spam ts,
  `project_id` FK→Project, `is_signal`, `has_calendar_attachment`.
- **email_messages** — provider ids, thread FK, history id, internal ts,
  snippet/subject, `from_contact_id`, flags (read/starred/sent/draft/
  attachments), `body_text` + `body_html_sanitized` + `body_macro`,
  `headers_jsonb`, `global_id` (RFC Message-ID), `replying_to_id` self-FK.
- **email_message_recipients** (TO/CC/BCC + name), **email_contacts**
  (per-link address book), **email_labels** + **email_message_labels**,
  **email_gmail_histories** (PK link → latest history id — the sync
  cursor), **email_sync_tokens** (People API), **email_user_history**
  (frecency), **email_settings**, **email_filters**,
  **email_contact_search_index** (maintained by 5 plpgsql triggers,
  20260311…), **email_scheduled_messages** ((link,message) PK, send_time,
  sent, `processing` claim flag — the send outbox).
- Attachments: **email_attachments**, **email_attachments_drafts** (sha,
  s3_key), **email_attachments_fwd**, **email_attachments_sfs**,
  **email_sfs_mappings**; `document_email` links attachments→Documents.
- Backfill: **email_backfill_jobs** (status enum, lease-fenced
  `init_lease_token/expires`), **email_backfill_init_outbox**,
  **email_backfill_completion_outbox** (transactional outboxes with
  published_at + effects lease —
  `20260725014930_calendar_entities.sql:346-377`).
- **email_links_history** (audit + deletion_reason),
  **email_link_google_scopes** (granted scopes + monotonic grant_version).
- Dropped at pin: `email_attachments_macro`; and — key migration
  **`20251111151333_email_backfill_redis.sql`** — `email_backfill_messages`
  + `email_backfill_threads` dropped with 8 job counters, comment: "we now
  use redis to track backfill progress instead of postgres."
- Calendar coupling: `calendar_accounts.email_link_id` UNIQUE FK;
  `calendar_event_sources` can be `email_ics`-sourced (referencing email
  link/thread/message/attachment); `calendar_backfill_jobs.email_link_id`.

## C. Sync architecture

- **Auth:** OAuth grants live in **FusionAuth**; the email service fetches
  Gmail access tokens from the auth service, cached in Redis
  (`util/redis/access_token.rs`); revoked grants flip `needs_reauth` and
  enqueue a NotifyReauthRequired link-manager message; scope grants
  fenced by `grant_version`.
- **Push, not polling:** `/email/init` registers a Gmail watch
  (`crates/gmail_client/src/watch.rs:9-78`; handles the
  one-channel-per-mailbox 400 by stop+retry). GCP Pub/Sub pushes to
  `/gmail/webhook` → SQS. Watches expire, so the **email_refresh_handler
  Lambda** (EventBridge hourly) enqueues Refresh per active link
  (hash-bucketed % 24), HealthCheck probes, and nightly unused-link
  deletion (`services/email_refresh_handler/src/handler.rs:20-60`).
- **Incremental sync** (`services/email_service/src/pubsub/inbox_sync/`):
  compare pushed history_id vs stored; sync labels; `history.list` since
  stored id; **advance the stored history_id first** (dedup); fan out
  per-message Upsert/Delete/UpdateLabels ops onto the same queue
  (`operations/gmail_message.rs:20-144`). `upsert_message` fetches the
  full message, sanitizes HTML, maps inline images to SFS, updates thread
  metadata, fans out CRM populate ops, and sends push notifications for
  new inbound mail (`operations/upsert_message.rs:672-742`).
- **Rate limiting & retry:** Redis sliding-window limiter per
  (link, Gmail operation) (`util/redis/rate_limit.rs`); **two-tier
  queues** — the primary worker moves rate-limited work to a retry queue;
  the retry worker leaves retryables on the queue for SQS redelivery,
  preventing head-of-line blocking (`inbox_sync/process.rs:149-201`).
  Same pattern for gmail-ops. Errors classified Retryable vs NonRetryable.
- **Initial backfill** (`crates/models_email/src/email/service/backfill.rs:66-124`):
  Init → ListThreads (batches of 500; first pass is a **priority pass**:
  CATEGORY_PERSONAL threads + last 200 sent messages seeding contacts) →
  BackfillThread → BackfillMessage (per-recipient CRM populate fanout) →
  UpdateThreadMetadata → BackfillAttachment (attachment becomes a Macro
  Document) → FinalizeBackfill. **Progress counters live in Redis** hashes
  incremented by Lua scripts (`util/redis/backfill.rs:19-231`); durability
  shell = the two outbox tables with lease tokens, drained by
  `calendar_outbox::run` (crash after publish can duplicate; consumers
  idempotent by job id).
- **Workers** (one ECS binary,
  `src/bin/pubsub_workers/pubsub_workers.rs:74-450`): inbox_sync(+retry),
  gmail_ops(+retry), backfill (N workers, dedicated pool), scheduled
  (send executor), sfs_uploader/sfs_deleter, link_manager
  (Refresh/HealthCheck/NotifyReauthRequired/DeleteLink/DeleteUser),
  crm_cleanup, contacts, notification ingress, calendar outbox drain.
  Lambdas: email_refresh_handler, email_scheduled_handler,
  email_sfs_delete_handler, email_suppression_handler (SNS suppression).
- **Realtime:** `cg_refresh_email` pushes refresh events through the
  Connection Gateway WS to owner + delegates (`pubsub/util.rs:138-150`);
  Kafka publishes domain events (message_send_queued/message_sent/
  link_connected/ThreadsReindexRequested).

## D. Send path — Gmail API, two-phase with undo window (no SMTP anywhere)

1. `POST /email/messages` → `send_message_impl`
   (`crates/email/src/domain/service/send.rs:24-61`): insert the message
   row with `send_time = now + undo_delay`, upsert
   `email_scheduled_messages`, enqueue with SQS delay = undo+2s, publish
   `message_send_queued`. The FE shows "Undo" for the window; cancel =
   unschedule.
2. Scheduled worker (`pubsub/scheduled/process.rs:18-331`): claims via the
   `processing` flag, guards already-sent/future/processing, fetches
   token, builds `In-Reply-To`/`References` from the parent's stored
   headers (`util/gmail/send.rs:10-56`), attaches draft attachments from
   S3 + forwarded attachments fetched live from Gmail, then **Gmail API
   `users/me/messages/send`** with a base64url RFC-822 message and
   `threadId` (`crates/gmail_client/src/messages.rs:235-315`). On success,
   one transaction marks scheduled row sent + message non-draft with
   provider ids + thread metadata; then `message_sent` + S3 draft cleanup.
3. "Send later" uses the same tables; the **email_scheduled_handler
   Lambda** (cron) sweeps overdue unsent drafts as backstop
   (`services/email_scheduled_handler/src/handler.rs:10-60`).

## E. Frontend (`[NW] apps/web`)

- **Email block** (`features/block-email/`): thread view with collapsed
  messages, participants, reply/reply-all/forward, attachment pills, side
  panel. Block type `email`, live tracking on (`definition.ts`).
- **Compose** (`component/compose/Compose.tsx`): To/Cc/Bcc with typeahead
  + mention→Cc, rich body + toolbar, debounced draft autosave,
  **From-inbox selector** (multi-inbox), per-link **signatures**,
  **schedule send/unschedule** (:581-610), server-driven undo window,
  attachments + forwarded attachments, mobile drawer.
- **Mail list** = the Soup feed (`features/next-soup/`): cursor-paged
  infinite queries, view tabs from filter presets, email filter chips
  (drafts/no-drafts/has-calendar-invite/has-attachment/attachment types),
  date/entity/project grouping, selection + hotkeys, actions incl.
  mark-sender-important/noise, block sender, mark unread, move-to-project,
  share, reminders.
- **Search**: OpenSearch — email threads indexed by
  search_processing_service consuming Kafka email events
  (`services/search_processing_service/src/inbound/kafka_consumer/email.rs`).
- Query layer `lib/queries/email/` (thread/draft/link/settings/sync/
  backfill-progress/attachment); `crates/graphql_email` exposes
  labels/links/settings/sync-status + thread mutations to GraphQL.

## F. Cross-domain touchpoints

- **CRM:** every synced/backfilled message fans out per-address CRM
  populate; deletes fan out depopulate; team join/leave triggers bulk
  (de)populate. See `crm-audit.md` — the CRM is downstream of this
  pipeline.
- **Calendar:** hard-coupled — calendar accounts key on email links,
  calendar backfill rides the email backfill queue/outbox, ICS
  attachments become calendar event sources, the calendar watch webhook
  lives in this service, calendar OAuth scopes are captured during
  `/email/init`.
- **Documents:** attachments become Documents via DSS (`document_email`).
- **Projects:** threads assignable (`email_threads.project_id`).
- **Notifications + realtime:** new-mail notifications to owner +
  delegated primaries; Connection Gateway refresh events.
- **Sharing:** mailboxes are per-user by default; access extends via
  `macro_user_links` delegation edges
  (`crates/email/src/outbound/email_pg_repo/link.rs:135-170`) and
  shared-inbox promotion (minted user both connectors delegate over).
  CRM-scoped previews may expand to team links after the precheck.
- **Identity:** FusionAuth everywhere (grant custody, `macro|{email}`
  ids) — FusionAuth is ruled dead, so custody must move (§I-1).

## G. What CF-OS already provides

Workers+DO only — no Postgres/SQS/Redis/S3/Kafka in-kernel; D1/Queues/
Vectorize available to wrapper Workers but unused by the OS. Relevant:
gatekeeper contract (OAuth, observation/action discipline, per-account
sessions), `gatekeeper-email` + router `email()` for **inbound** Email
Routing (dormant without a zone), the External Message Gateway
(inbound-message→agent injection), scheduler gatekeeper, typed-storage,
KV/R2 binding, built-in sharing. Explicitly absent: any mailbox product,
cross-workspace inbox feed, search index, notification center.

## H. Factual delta to build

Effectively everything in §§A–F is net-new wrapper-side: Gmail OAuth +
token custody (nearest kernel primitive: a gatekeeper account session);
watch registration + hourly renewal (→ scheduler/alarms); the Pub/Sub
webhook Worker with Google JWT verification; history-id incremental sync;
the fan-out pipeline with two-tier retry and per-(link,op) rate limiting
(→ Queues + DO state; Queues lack SQS-style per-message visibility
tuning); backfill orchestration incl. priority pass and counters
(→ DO counters); the 24-table model (→ D1/DO SQLite — the
trigger-maintained contact search index and partial/trgm indexes have no
D1 equivalent); two-phase send with undo + scheduled-send sweep
(→ delayed Queue message or DO alarm); draft/forwarded attachment
storage (→ R2); bidirectional label ops; delegation/shared-inbox model;
signatures; preview views + filters; notifications/realtime (→ workspace
subscriptions or the custom shell); CRM/calendar/document/search fan-outs
if those domains are kept.

## I. Open design questions for David

1. **Token custody:** FusionAuth held the Gmail grants and is dead. Where
   do refresh tokens live — a gatekeeper account DO, or a new wrapper
   vault? (Interacts with the auth rebuild and the connectivity layer.)
2. **Rate limiting + two-tier retry on Cloudflare Queues** — no
   per-message visibility timeout; a DO-based limiter/claim design is
   needed. Accept redesign or simplify semantics?
3. **D1 vs per-mailbox DO SQLite for threads:** Postgres partial/trgm/GIN
   indexes and triggers don't port; per-link DO shards break the
   cross-inbox union reads the Soup mail list depends on. Pick a shape.
4. **Delegation/shared-inbox:** does the kernel collaborator model
   subsume `macro_user_links` + shared-inbox promotion, or is a wrapper
   ACL needed?
5. **Undo-send:** delayed Queue message vs DO alarm; who owns the
   `processing` claim.
6. **Attachments:** the old system never bulk-stores message attachments
   (fetch-on-demand from Gmail + temp cache). Replicate with R2-as-cache,
   or fully mirror to R2?
7. **Search and CRM fan-outs in pilot scope?** (Capability map says
   search is "not v1"; CRM is ruled in — its populate source is this
   pipeline.)
8. **GCP stays:** Gmail watch only pushes to GCP Pub/Sub — a GCP project
   remains a hard external dependency regardless of substrate. Accept, or
   consider polling (worse) at design time.

## J. Coverage

Read at the pin: every route registration under
`services/email_service/src/api`, entrypoints, inbox_sync (process +
gmail_message + upsert notification hooks), backfill (dispatch, redis
state, operation enum), scheduled worker + gmail_client send/watch,
link_manager ops, calendar_outbox headers, all email migrations (base in
full + every ALTER touching `email_*`), the email crate hex routers +
send/draft services + link repo SQL, graphql_email surface, infra stacks,
frontend block-email tree + compose + next-soup filters/actions +
queries/email, and the CF-OS capability map. Not read line-by-line:
`upsert_message.rs` full body (~700 lines; hooks verified by grep),
crm_cleanup and gmail_ops op bodies, email_suppression_handler internals,
the calendar_events crate, email_db_client query modules beyond
user_history/link — behavior inferred from names, enum docs, call sites.
