# Domain audit — the standalone services (notification · static-file · unfurl · image-proxy · scheduled-action · convert · analytics-proxy)

> Created 2026-08-19 by the **research pass (long tail)**. Status: research
> only. **No verdict** — every row stays `◐` until David rules. Pointers:
> `[NW]` = `DavidSuperwave/Neuwave` @
> `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`; `path:line` from the clone root.
> Rulings D3/3a, D4/4a, R3, C1, C2 are cited, never re-argued.
>
> **Three headlines.**
> **(1)** `notification_service` is the largest unruled capability in the
> ledger — **9,703 non-test LOC**, 19 notification types, three egress
> channels — and its provisional "Drop" predates the rulings that keep
> channels, mailbox, CRM, calls, reminders and GitHub, *every one of which
> produces notifications through it*.
> **(2)** There is a **second hard substrate gap** beside ffmpeg:
> `convert_service` embeds **LibreOffice** (Collabora core + MS core fonts) and
> is what produces `DocumentContentLocation::ConvertedPdf` in the `documents`
> row. Two of the seven services here have no Workers-native successor.
> **(3)** Exactly **six Cloudflare Workers exist at the pin** — the three
> lifted ones plus `analytics-proxy` and two channel bots. The lift ruling
> (A3) named three; the other three were never considered. `coding-agent-worker`
> has **no wrangler config at all**, which corroborates A3 by a method the
> earlier pass did not use (§G).

---

## A. notification_service

**Source:** `services/notification_service` (2,032 LOC — a thin shell) over
**`crates/notification`** (61 files; **9,703 non-test LOC**) and
`crates/model_notifications`, `crates/notification_db_client`,
`crates/graphql_notification`. **~22 endpoints** (EB §6), **11 tables**
(SH §4).

### A1. The type catalog — 19 notification types

`[NW] crates/model_notifications/src/metadata.rs` declares 22 metadata structs
and **19 `const TYPE_NAME` values**, which are the wire contract and the unit
of per-type user preference (`user_notification_type_preference`):

`ai_response`, `call_started`, `channel_mention`, `channel_message_reply`,
`channel_message_send`, `commented_on_document`, `document_mention`,
`github_pr_check_run`, `github_pr_comment`, `github_pr_mention`,
`github_pr_review`, `github_pr_status_changed`, `github_review_requested`,
`inbox_reauth_required`, `mentioned_in_document_comment`, `new_email`,
`reminder`, `replied_to_document_comment_thread`, `task_assigned`.

Read that list against the ruled ledger: **7 of the 19 are GitHub**, 3 are
channels, 3 are document comments, and one each are email, reminders, calls,
tasks, and AI. Every producing domain is ruled **keep**. Each type also
implements `NotificationTitle::format_title` — the user-visible copy lives in
Rust, not in a template store, so it ports as content.

### A2. Three egress channels, one state machine

`[NW] crates/notification/src/domain/service/egress.rs:64` — the egress
service composes queue, repository, **websocket**, **mobile (APNS/FCM)**,
**email**, rate limiter, state machine, and a **digest batcher**:

- **WebSocket** → connection_gateway (superseded by **C1** kernel session push).
- **Mobile push** → **AWS SNS platform endpoints**
  (`outbound/sns_endpoint.rs`, `outbound/mobile.rs`), device registrations in
  `notification_user_device_registration` (ios / android / **iosvoip**). The
  VoIP variant (`domain/service/voip.rs`) exists for CallKit — it is coupled
  to the ruled-keep calls row.
- **Email digest** — `outbound/digest_batcher.rs` +
  `domain/models/email_notification_digest/`, with `notification_email_sent`
  and `channel_notification_email_sent` as dedupe state, and an
  unsubscribe-code table for one-click opt-out.

Delivery is gated by a **last-online checker** (`outbound/last_online_checker.rs`)
— push only when the user is not live on the WebSocket — and by a
**rate limiter** (`domain/models/rate_limit.rs`, `outbound/rate_limit.rs`).
Successes record an **SNS message id** into `notification_message_receipt`.

### A3. Three worker loops

`inbound/ingress_worker.rs` (fan-out: event → per-recipient rows),
`inbound/worker.rs` (egress), `inbound/push_notification_event_worker.rs`,
plus `inbound/notification_events_listener.rs`. There is also an
**AI tool surface** (`inbound/ai_tool/mod.rs`) — agents can raise
notifications.

### A4. Why the provisional "Drop" is now load-bearing

The ledger's `Provisional` column says *Drop*. That predates the 2026-08-19
rulings. As of today the notification producers that are ruled **keep** are:
channels (full), mailbox (in pilot), CRM, calls, calendar, reminders,
documents/tasks, GitHub. Dropping the notification domain does not remove
work — it relocates it, because "mention someone in a channel and they find
out" is a channels requirement, not a notifications feature. **This is a
ruling David needs, and it is not a small one:** it is the difference between
one 9.7k-LOC domain and a notification concern spread across eight domains.

*(Presented as a dependency fact. The verdict is David's.)*

---

## B. static_file_service — and a hole in the schema harvest

**Source:** `services/static_file_service` (1,966 LOC), 6 endpoints per mount,
mounted **twice**: at `/api` (JWT user auth, the `/api` prefix exists purely
for CloudFront routing) and `/internal` (service-key) —
`[NW] services/static_file_service/src/api/mod.rs:75-92`.

**The finding: SFS metadata is in DynamoDB, not Postgres.**
`[NW] services/static_file_service/src/config.rs:22` —
`static_file_service_dynamodb_table_name`; every handler goes through
`service::dynamodb::client::DynamodbClient`. `schema-harvest.md` §6 records
DynamoDB only for `BulkUploadRequest`. So there is **at least one more
DynamoDB table that was never harvested**, and it holds the metadata for every
static file in the product (name, content type, `extension_data JSONB`,
upload state).

**Lifecycle** is the same pending→ready state machine as `documents`:
`PUT /api/file` returns a presigned S3 upload URL and an id; the browser
uploads directly; an **S3 event** calls `mark_uploaded(file_id)`
(`[NW] services/static_file_service/src/api/event/s3_create.rs:19`). That
handler explicitly skips CloudFront image-optimizer derivative keys
(`file/{uuid}/format=webp,width=300`, `:7-10`) — which is where the
`image_optimizer` Lambda's output lands (`audits/lambda-batch-families-audit.md` §F).

**Couplings:** email attachments (`email_attachments_sfs`, `email_sfs_mappings`,
and the `email_sfs_delete_handler` Lambda that GCs orphans —
lambda audit §D); chat attachments (`ChatAttachment.entity_type='static_file'`);
`EntityType::StaticFile` is one of the 16 canonical variants.

**Route collision:** SFS owning `/api/file/*` is collision #1 in
`route-reconciliation.md` §7 and dies with the R3 model.

---

## C. unfurl_service and image_proxy_service — two proxies, one substrate problem

**unfurl_service** (1,446 LOC): `GET /unfurl?url=`, `POST /unfurl/bulk`,
`GET /proxy`, `/health`. Parses OpenGraph/Twitter meta tags into a card
(`src/unfurl/mod.rs`, keys like `property:og:title`, with `og:site_name` as a
title fallback). 8s request / 3s connect timeouts
(`[NW] services/unfurl_service/src/main.rs:24-25`).

**image_proxy_service** (1,160 LOC): `GET /proxy`, `/health`. **It does not
transform images.** It is a pass-through fetch with a 10 MB cap
(`[NW] services/image_proxy_service/src/api/proxy/mod.rs:26`), 15s timeout
(`:33`), manual redirect following (max 5), a spoofed browser User-Agent
(`:43`), and `Cache-Control: public, max-age=31536000, immutable` on the way
out (`:195`). Its purpose is hotlink/CORS/referrer laundering for remote
images (notably inline email images), not resizing.

### C1. The shared blocker: SSRF defence is implemented by DNS resolution

Three separate services independently implement the same guard — resolve the
hostname, reject private/loopback/link-local addresses, then fetch:

| Service | Guard |
|---|---|
| unfurl | `assert_not_internal` (`[NW] services/unfurl_service/src/http_safety/mod.rs:91`) → `is_private_ip` (`:109`) |
| image-proxy | `tokio::net::lookup_host` (`[NW] services/image_proxy_service/src/api/proxy/mod.rs:260`) |
| webhook | `validate_resolved_endpoint_url` (`[NW] crates/webhook/src/outbound/http_validator.rs:157`) → `is_blocked_ip` (`:243`) |

**Workers have no DNS-resolution API.** A Worker cannot resolve a hostname and
then decide whether to fetch it, and `fetch()` resolves at request time, so
the check-then-use pattern is not portable at all. Every user-supplied-URL
fetch in the rebuild — unfurl, image proxy, **outbound webhooks**, and any
connector that takes a user-entered endpoint — inherits this. Options exist
(egress via a proxy/binding that enforces policy, a hostname allowlist, an
external resolver, or accepting the exposure) but they are a **design decision
David should make once, for all four surfaces**, not per row. This is the
long tail's equivalent of the ffmpeg finding: a substrate gap, not a port.

---

## D. scheduled_action — "automation" is a scheduled chat

**Source:** `services/scheduled_action` (2,464 LOC), 7 endpoints (EB §12),
tables `scheduled_action` + `action_execution_record` (SH §1.8).

- **`ActionKind` has exactly one variant: `Agent`**
  (`[NW] services/scheduled_action/src/domain/models.rs:53`). `AgentTask` is
  `{model, prompt, user_prompt}` (`:58`). The `task JSONB` column is
  open-ended, but nothing else was ever built.
- **Execution creates a real Chat.**
  `[NW] services/scheduled_action/src/outbound/inprocess_executor/agent_task.rs`
  builds a chat row, then runs the full `all_tools` AgentLoop with the user's
  `memory` injected, and notifies on completion. So an automation is
  indistinguishable from a chat the user did not type — which is exactly why
  the frontend shows automations inside the **`agents`** view
  (EF §2, tab `automations`) and gives them the `automation` block.
- **Scheduling** is cron (6/7-field) + IANA timezone → `next_run_at`
  (`domain/models.rs:18-38`).
- **Dispatch is the weakest D4 tier.**
  `[NW] services/scheduled_action/src/outbound/pg_polling_dispatcher.rs:20,24`
  — batches of 10, a 30s floor per loop, and claiming by atomic conditional
  UPDATE with a stale-or-unclaimed filter; the file's own comment (`:22-30`)
  explains it exists to let peer instances share a backlog. **D4/4a** rules
  this exact shape out: per-action DO alarms replace both the poll and the
  claim.
- Live updates go out via `outbound/conn_gateway_live_updates.rs` → **C1**.
- **Overlap:** `route-reconciliation.md` §7-19 already marks
  `scheduled_action` as functionally overlapping the kernel's
  `gatekeeper-scheduler`.

---

## E. convert_service — the second hard substrate gap

**Source:** `services/convert_service` (1,365 LOC), 3 endpoints, all internal:
`POST /internal/convert`, `POST /internal/backfill/docx`, `/health`
(EB §13).

- **It embeds LibreOffice.**
  `[NW] services/convert_service/Cargo.toml:45` pins
  `rs-libreoffice-bindings` (a `macro-inc` git dependency), and
  `[NW] docker/Dockerfile.convert_service:38-40` downloads
  **Collabora Online `core-co-25.04` assets** and the image accepts the
  **MS core-fonts EULA** so DOCX renders with the right metrics.
- **The job is bucket→bucket:** `ConvertRequest {from_bucket, to_bucket,
  from_key, to_key}` (`[NW] crates/model/src/convert/mod.rs:5-14`), also
  drivable as `ConvertQueueMessage` with a `job_id`.
- **What depends on it:** this is the producer of
  `DocumentContentLocation::ConvertedPdf` — the legacy mapping
  `Docx → ConvertedPdf` in `audits/documents-audit.md` §B2. Kill conversion
  and DOCX documents lose their viewer path; keep it and the rebuild needs a
  container with fonts.
- **No Workers-native successor.** Same class as `ffmpeg` in
  `audits/lambda-batch-families-audit.md` §F/§G4: Cloudflare **Containers**,
  an external conversion API, or drop DOCX rendering. It should be ruled
  **with** the documents content-location model, not alone.

---

## F. analytics-proxy — already a Cloudflare Worker

**Source:** `services/analytics-proxy` — Hono, `wrangler.jsonc`, **zero AWS
dependency**. Two proxy prefixes:

- **`/i/ph`** → `https://us.i.posthog.com`
  (`[NW] services/analytics-proxy/src/index.ts:21`). It renames PostHog's
  recorder script to `runtime.js` on the browser-facing path
  (`:26`) specifically because *"privacy filter lists block the upstream
  filename"* (`:23-25`) — i.e. deliberate ad-blocker evasion for session
  replay. Worth surfacing as a product/privacy decision, not plumbing.
- **`/i/otlp/v1/traces` and `/i/otlp/v1/logs`** → per-signal Datadog OTLP
  intakes, with the server-side `DD_API_KEY` injected by the Worker so the
  browser never holds it (`:8-19`, `:35-41`).

`route-reconciliation.md` §7-20 already resolves the path question (`/i/*` is
collision-free and can stay as-is). What is new here is that **this is
already a Worker** — the row is not "port a service", it is "keep, adjust
config, and decide whether PostHog and Datadog are the observability stack
for Outreach-OS at all". Note the kernel's own stance on
feature-flags/analytics is the competing option recorded in the ledger.

---

## G. The Cloudflare-Worker census at the pin

Enumeration method: every `wrangler.*` file in the repo, excluding
`node_modules`. Result — **six**:

| # | Worker | Ledger status |
|---|---|---|
| 1 | `services/sync-service` (`wrangler.toml`, + `wrangler.docker.toml`) | ✔ lifted (A3) |
| 2 | `services/lexical-service` (`wrangler.jsonc`) | ✔ lifted (A3) |
| 3 | `services/ai-editing-worker` (`wrangler.toml`) | ✔ lifted (A3) |
| 4 | `services/analytics-proxy` (`wrangler.jsonc`) | ☐ row — **never recognized as already-CF** |
| 5 | `services/bots/anthropic-status-bot` (`wrangler.jsonc`) | **no row** |
| 6 | `services/bots/stripe-payment-bot` (`wrangler.jsonc`) | **no row** (a "side note" in `business-chrome-primitives.md` §1.5) |

Two consequences:

1. **`coding-agent-worker` has no wrangler config.** Ruling A3 dropped it from
   the lift set on the basis that no source was ever committed. The absence of
   a wrangler file is an independent, one-command confirmation by a different
   method: it was never configured as a Worker either.
2. **Three already-Cloudflare Workers sit outside the lift ruling.** They are
   small and none is load-bearing, but "the lift set is three services" is
   true of the *ruled* set, not of the repo. The two bot workers are also the
   only working examples of the channel-bot webhook contract
   (`x-macro-bot-token` + `x-macro-bot-scope` → `POST /channels/{id}/webhook`),
   so they are reference material for the `bots` row whatever their verdict.

### G1. And one thing that is not a service at all

`services/websocket-service` (listed as a non-Rust deployable in
`endpoint-inventory-backend.md`) is a **23-line Bun echo server** on port
6969 that replies `"ping"` to every message
(`[NW] services/websocket-service/src/index.ts`). It is a scaffold, not a
capability — same class of artifact as the empty `coding-agent-worker`.
**It should not get a ledger row or a Linear issue.** Recorded here so the
scope-map pass does not manufacture one.

---

## H. Findings that need David rather than more research

1. **notification_service's provisional "Drop" is stale** (§A4). Eight ruled-keep
   domains produce notifications through it. Drop / keep / reduce-to-in-app is a
   real ruling with a 9.7k-LOC swing.
2. **SSRF-by-DNS has no Workers equivalent** (§C1) and affects four surfaces at
   once (unfurl, image proxy, outbound webhooks, connector endpoints). One
   ruling should cover all four.
3. **LibreOffice is a second hard substrate gap** (§E), and it gates the DOCX
   half of the documents content model. Rule it with `documents`, alongside
   ffmpeg.
4. **A second DynamoDB table was never harvested** (§B) — SFS file metadata.
   `schema-harvest.md` records only `BulkUploadRequest`. The harvest is
   incomplete for non-Postgres stores; the same is already true of Redis
   (lambda audit §G3).
5. **Three already-CF Workers are outside the lift ruling** (§G), and one
   listed "service" is a 23-line stub that should never become scope (§G1).
6. **`scheduled_action` overlaps `gatekeeper-scheduler`** and its only action
   kind is "run an agent" (§D) — so the row may be "kernel scheduler + a saved
   prompt", not a service port.

## I. Coverage

**Read:** for each of the seven services — the `src/` file tree and per-file
LOC, the router/mount file, and the config file. Specifically:
`crates/notification` full non-test file tree (46 modules) and
`domain/service/egress.rs:1-140`; `crates/model_notifications/src/metadata.rs`
struct index and all 19 `const TYPE_NAME` values plus the
`GithubPr*`/`Channel*`/`NotificationDocumentSubType` enums;
`services/static_file_service/src/{config.rs, api/mod.rs, api/file/mod.rs,
api/event/s3_create.rs, model/api.rs}`;
`services/unfurl_service/src/{main.rs:20-30, http_safety/mod.rs}` and
`src/unfurl/mod.rs` tag-extraction region;
`services/image_proxy_service/src/api/proxy/mod.rs:20-60,110-200,250-270,380-420`;
`services/scheduled_action/src/domain/models.rs:1-110`,
`outbound/pg_polling_dispatcher.rs:1-40,130-195`,
`outbound/inprocess_executor/agent_task.rs:1-30`;
`services/convert_service/{Cargo.toml, src/api/convert.rs head}`,
`crates/model/src/convert/mod.rs`, `docker/Dockerfile.convert_service:1-50`;
`services/analytics-proxy/src/index.ts:1-110`;
`services/websocket-service/src/index.ts` in full; every `wrangler.*` path in
the repo; `endpoint-inventory-backend.md` §§6,8–13 and `schema-harvest.md` §4
for endpoint and table counts.

**Not read:** every handler body in all seven services — behavior is taken
from route registrations, config, type definitions, and module docs, **not**
verified against handler logic. Specifically unread:
`crates/notification` `domain/service/ingress.rs`, `device/`, `voip.rs`,
`push_notification_event/`, all four worker loops' bodies, the digest batcher
and rate-limiter implementations, `graphql_notification`, and
`notification_db_client` (so **fan-out recipient resolution — who gets a
notification — is unmapped**, which is the most product-relevant unknown in
§A); `unfurl` bulk handler and cache behavior (**no cache layer was found,
but absence was not proven**); `image_proxy` transform absence is asserted
from the module's own doc and constant set, not from an exhaustive read;
`scheduled_action` repo SQL and `tokio_dispatcher.rs`; `convert_service`
conversion body beyond the LibreOffice binding import (**so the exact input
and output format set is not established** — DOCX→PDF is inferred from the
`ConvertedPdf` content location and the `/internal/backfill/docx` route);
`analytics-proxy` beyond line 110; the SFS DynamoDB client and its item
schema (**so the unharvested table's columns are still unknown**).

**Not verified:** that all seven services are deployed at the pin — this is an
inventory of source. Deploy configuration under `infra/` was read only for the
Lambda schedules in the earlier audit, not for these services.
