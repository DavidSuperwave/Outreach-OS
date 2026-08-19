# Domain audit — Lambda / batch families (the inventory hole)

> Created 2026-08-19 by the **research pass** (highest-leverage row 6 of 6).
> Status: research only. **No verdict** — the ledger row stays `◐` until
> David rules. Pointers: `[NW]` = `DavidSuperwave/Neuwave` @
> `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`; `path:line` from the clone
> root. Rulings D3/3a (outbox = intent record + alarm, idempotent
> consumers, poison-pill mark-and-skip) and D4/4a (DO single-writer +
> alarms, no ported claims/dispatchers) are cited, never re-argued.
>
> **This closes the known inventory hole.** `cloud-handoff.md` §7 records
> "~20 queue/Lambda workers never extracted". The count is exact:
> **20 Lambda crates** (every one depending on `lambda_runtime` /
> `lambda_http`) plus **1 long-running ECS worker**, in **7 families**.
> Enumeration method in §H — it is mechanical and repeatable, so this list
> is complete for *crates*, not necessarily for *deployed functions*.

## A. The complete handler inventory

Trigger column is read from the event type each crate deserializes; schedule
from the CDK stack that creates the rule.

| # | Handler | Trigger | Schedule | Family |
|---|---|---|---|---|
| 1 | `document_upload_finalizer_handler` | S3 → EventBridge (SQS adapter locally) | event-driven | Ingestion |
| 2 | `docx_unzip_handler` | S3 | event-driven | Ingestion |
| 3 | `upload_extractor_lambda_trigger` | EventBridge | — | Ingestion |
| 4 | `upload_extractor_lambda_handler` | SQS | — | Ingestion |
| 5 | `document_text_extractor` | SQS + EventBridge | — | Ingestion |
| 6 | `search_upload_handler` | EventBridge | — | Search |
| 7 | `email_refresh_handler` | EventBridge | `rate(1 hour)` | Email |
| 8 | `email_scheduled_handler` | EventBridge | `rate(1 minute)` | Email |
| 9 | `email_sfs_delete_handler` | EventBridge | `cron(0 8 * * ? *)` | Email |
| 10 | `email_suppression_handler` | **SNS** (SES bounce/complaint) | event-driven | Email |
| 11 | `deleted_item_poller` | EventBridge (+ Kafka types present) | `rate(4 hours)` | Retention |
| 12 | `organization_retention_trigger` | EventBridge | `rate(1 day)` | Retention |
| 13 | `organization_retention_handler` | SQS | — | Retention |
| 14 | `user_link_cleanup_handler` | EventBridge | `rate(8 hours)` | Retention |
| 15 | `delete_chat_handler` | SQS | — | Retention |
| 16 | `worker_trigger` | EventBridge | `rate(1 hour)` | Retention |
| — | `sha_cleanup_worker` | **not a Lambda** — `#[tokio::main]` ECS task started by #16 | — | Retention |
| 17 | `call_recording_preview_handler` | S3 | event-driven | Media |
| 18 | `image_optimizer` | Lambda request (`LambdaRequest`) | on-demand | Media |
| 19 | `ai_projections_refresh_handler` | EventBridge ×3 rules | `rate(6 hours)` / `rate(1 day)` / `rate(3 days)` | AI |
| 20 | `dataloss_prevention_handler` | S3 | `rate(1 day)` | Security |

Pointers for the schedules (all under `[NW] infra/`):
`stacks/email-service/refresh_lambda.ts:116`,
`stacks/email-service/scheduled_lambda.ts:113`,
`stacks/email-sfs-delete-handler/sfs_delete_lambda.ts:114`,
`stacks/deleted-item-poller/lambda.ts:119`,
`stacks/organization-retention/organization-retention-trigger.ts:111`,
`stacks/authentication-service/user-link-cleanup-lambda.ts:93`,
`stacks/sha-cleanup/index.ts:87`,
`stacks/dlp-handler/dlp-handler.ts:126`,
`stacks/document-cognition-service/ai-projections-refresh-trigger.ts:18-20`.

One more scheduled rule sits outside `services/`:
`stacks/cloud-storage-service/reminder-dispatch-queue.ts:60` —
`rate(1 minute)` reminder dispatch. It belongs to the already-ruled
**reminders** row (Keep, 2026-08-19), and under D4/4a it is exactly the
"no ported dispatchers" case: a per-reminder DO alarm replaces the
minute-poll queue entirely. Flagged here so the reminders build does not
inherit a dispatcher by accident.

## B. Family 1 — Ingestion (5 handlers)

The upload path is a chain, not a single function: bytes land in S3, a
finalizer promotes the document row, format-specific handlers fan out
(`docx_unzip_handler` builds the BOM — see the documents audit §B1 for the
`DocumentBom`/`BomPart` tables), archives get expanded by a
trigger+handler pair, and `document_text_extractor` writes
`DocumentText`/`DocumentTextParts` for search and AI.

`document_upload_finalizer_handler` is the one crate already written to a
ports-and-adapters shape with **two transport adapters** normalizing to one
domain event (`[NW] services/document_upload_finalizer_handler/src/main.rs:1-8`,
`app.rs`, `ports.rs`, `runtime.rs`). That is the cheapest port in the whole
set — the domain half is transport-agnostic already.

CF-native shape under D3/3a: R2 event notifications → Queues, with the chain
as idempotent consumers keyed on document id + sha. The `pending` → `ready`
transition in `DocumentContentLocation` (documents audit §B2) is the state
machine these handlers drive, so this family and the `documents` row are one
build, not two.

## C. Family 2 — Search (1 handler + the real indexer)

`search_upload_handler` is EventBridge-triggered
(`[NW] services/search_upload_handler/src/handler.rs`), but it is **not**
the main indexing path. The indexer is `search_processing_service` — a
long-running **Kafka consumer** with one consumer module per entity type:
`call`, `channel`, `chat`, `document`, `email`, `project`, `property`
(`[NW] services/search_processing_service/src/inbound/kafka_consumer/`,
10,165 LOC). See the `search_service` / `search_processing_service` ledger
rows.

## D. Family 3 — Email (4 handlers)

- **`email_refresh_handler`** (`rate(1 hour)`) — re-arms Gmail
  `users.watch` push subscriptions, which expire; takes a subset of
  subscribed users each run so the daily requirement is spread hourly
  (`[NW] services/email_refresh_handler/README.md`). This is the keep-alive
  the company-mailbox audit's Gmail push architecture depends on — without
  it, push sync silently dies. **GCP Pub/Sub stays a hard dependency**
  (already recorded on the email row).
- **`email_scheduled_handler`** (`rate(1 minute)`) — polls
  `scheduled_messages` for rows whose `send_time` has passed and publishes
  to the send worker queue. Under D4/4a this is a per-message DO alarm, and
  the minute-poll disappears.
- **`email_sfs_delete_handler`** (`cron(0 8 * * ? *)`) — deletes orphaned
  `email_attachments_sfs` rows where `attachment_id IS NULL`, i.e. GC for
  the static-file service. Couples to the `static_file_service` row.
- **`email_suppression_handler`** (SNS) — subscribes to **SES** bounce and
  complaint notifications for the `macro.com` identity and adds addresses to
  the suppression list. Note this is SES *receiving deliverability
  feedback*, distinct from the Gmail-API send path in the mailbox audit:
  the old system had **two** email egress-adjacent substrates. For an
  outreach product, bounce/complaint suppression is a compliance-relevant
  capability, not incidental plumbing — worth its own attention when this
  row is ruled.

## E. Family 4 — Retention & cleanup (6 handlers + 1 ECS worker)

| Handler | What it does |
|---|---|
| `deleted_item_poller` | Every 4h, sweeps users' items and queues anything soft-deleted >30 days for hard delete — documents and chats (`README.md`) |
| `delete_chat_handler` | SQS consumer that performs the chat delete |
| `organization_retention_trigger` | Daily; emits per-org events for orgs with retention settings (`OrganizationRetentionPolicy` table) |
| `organization_retention_handler` | SQS consumer that performs the org-scoped cleanup |
| `user_link_cleanup_handler` | Every 8h, deletes in-progress account links older than 24h (`in_progress_email_link`, `in_progress_user_link` tables) |
| `worker_trigger` | Hourly; starts the ECS task below |
| `sha_cleanup_worker` | Long-running ECS task; deletes S3 objects listed in a **Redis** `bucket:sha-delete` set |

Two structural notes:

1. **The trigger→handler split is an AWS artifact.** Four of these are a
   scheduled fan-out Lambda paired with a queue-consumer Lambda purely
   because Lambda has a 15-minute ceiling. D3/3a and D4/4a collapse that
   pair into one DO with an alarm and a work list. The *policies* are the
   scope; the pairs are not.
2. **`sha_cleanup_worker` is the one piece that does not fit the pattern**
   — it is an ECS task with **Redis** as its work queue, and it implements
   the GC half of the sha-keyed content addressing described in the
   documents audit §B1. It must be ruled together with the version model:
   if versions stop being sha-addressed, this worker has no successor; if
   they stay, something has to GC unreferenced content in R2.

`deleted_item_poller` deserializes Kafka types as well as EventBridge
(`KafkaEvent` present in its source), so it may have a second, event-driven
path — **not confirmed**; treat the "poller" framing as the verified half.

## F. Families 5–7 — Media, AI, Security (4 handlers)

- **`call_recording_preview_handler`** (S3) — generates thumbnails from call
  recordings, and it shells out to **ffmpeg**
  (`[NW] services/call_recording_preview_handler/src/ffmpeg/`). Workers
  cannot run ffmpeg; this is the one handler in the set with **no
  Workers-native successor**. It belongs with the already-ruled
  calls/transcription rows and needs an explicit substrate decision
  (Container, Media Transformations, or drop previews).
- **`image_optimizer`** (on-demand `LambdaRequest`) — S3 fetch + transform +
  response (`src/transform.rs`, `s3.rs`). Cloudflare Images / Image Resizing
  is a direct replacement; overlaps the `image_proxy_service` row, which
  should be ruled with it.
- **`ai_projections_refresh_handler`** — three EventBridge rules on
  **cadence tiers** (`high` 6h, `medium` 1d, `low` 3d,
  `[NW] infra/stacks/document-cognition-service/ai-projections-refresh-trigger.ts:18-20`),
  each firing the same handler with a `RefreshEvent` naming the cadence.
  The cadence tiering is the design content here, and it maps directly onto
  the `ai_projections` ledger row.
- **`dataloss_prevention_handler`** (S3, daily) — scans stored documents and
  **deletes offending objects from S3**, logging "unauthorized document
  storage access detected"
  (`[NW] services/dataloss_prevention_handler/src/handler.rs`). This is a
  destructive enforcement job. It is currently a `☐`-adjacent capability
  with no ledger row of its own — see §G.

## G. Findings that need a ledger decision

1. **This row is 7 rows, not 1.** Each family maps to a different existing
   ledger row (ingestion→documents, search→search_*, email→email_service,
   retention→its own, media→calls + image_proxy, AI→ai_projections,
   DLP→nothing). Ruling "Lambda/batch families" as one line will either
   over- or under-scope every one of them.
2. **DLP has no ledger row.** A daily job that deletes user content for
   policy violations is a product decision, not plumbing. It needs a row.
3. **Redis appears as infrastructure** (`sha_cleanup_worker` work set; the
   mailbox audit already records Redis backfill counters). There is no
   Redis in the CF target and no ledger row acknowledging it. Every Redis
   use found so far is a **work queue or counter** — both are DO state
   under D3/D4 — but that should be stated as a ruling, not assumed.
4. **ffmpeg has no Workers successor** (§F) — the only hard substrate gap
   in the set.
5. **Most schedules disappear rather than port.** Of 9 scheduled rules, the
   1-minute email poll and the 1-minute reminder poll are pure dispatcher
   patterns that D4/4a explicitly rules out porting; the retention sweeps
   are candidates for per-entity alarms rather than global scans. Only the
   Gmail `watch` re-arm (§D) is inherently a periodic external-API
   obligation that must stay periodic.

## H. Enumeration method (so this is checkable)

The 20 were found by `grep -rln 'lambda_runtime\|lambda_http\|aws_lambda'`
over `services/*/Cargo.toml` at the pin — every crate that links the Lambda
runtime. Triggers were read by grepping each crate's sources for the AWS
event types it deserializes (`SqsEvent`, `S3Event`, `EventBridgeEvent`,
`SnsEvent`, `KafkaEvent`, `LambdaEvent<_>`). Schedules were read from
`scheduleExpression` in `infra/stacks/**`.

This is complete for **crates that link the Lambda runtime**. It would miss
a deployed function written in another language, defined only in CDK, or
vendored outside `services/` — see §I.

## I. Coverage

**Read:** the `services/` directory listing (44 entries); every
`services/*/Cargo.toml` for Lambda-runtime deps; each of the 20 crates'
`src/` file listing and event-type greps; `README.md` for the 12 crates that
have one; module-level `//!` docs where present; all 14 `scheduleExpression`
occurrences under `infra/` with their stack paths; the `infra/stacks`
directory listing; `search_processing_service`'s full file tree and LOC.

**Not read:** every handler's business logic body — this audit maps
**trigger, cadence, and stated purpose**, not implementation. Specifically
unread: all of `handler.rs`/`main.rs` bodies beyond the greps quoted;
`image_optimizer/transform.rs`; `call_recording_preview_handler/ffmpeg/`;
`dataloss_prevention_handler/handler.rs` beyond the four quoted lines (so
**what DLP actually matches on is unknown**); `ai_projections_refresh_handler/refresh/`;
`organization_retention_handler/service`; `sha_cleanup_worker/process.rs`
and `service/`; the four services' own `migrations/` dirs
(`document_text_extractor`, `organization_retention_trigger`,
`organization_retention_handler`, `sha_cleanup_worker`) — **these are
additional tables not counted in `schema-harvest.md`, and they were not
harvested**; every CDK stack body beyond the schedule line; IAM, DLQ,
concurrency, and retry configuration (**so failure semantics are entirely
unmapped** — this matters directly for the D3/3a poison-pill rule);
`worker_trigger`'s ECS task definition; whether any deployed function exists
without a crate in `services/`.

**Not verified:** that all 20 crates are actually deployed at the pin. The
inventory is of source, not of live AWS functions.
