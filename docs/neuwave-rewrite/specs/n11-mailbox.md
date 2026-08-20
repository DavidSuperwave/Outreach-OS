# Domain specification — Company mailbox + email (N11 / SUP-559)

## Verdict and source evidence

Wave 4b. Ruled keep (2026-08-19) for the full mailbox surface including send
(the old "Drop — Instantly instead" framing is corrected). 05-MAP row 8:
read/sync one thread and execute an approved write with an audit trail.
Gmail-API send (no SMTP). GCP Pub/Sub push sync with checkpoints is a hard
dependency (J12). 23 live `email_*` tables are the OD-1 design reference
(corrected count, 01 §2.9 I3). EmailThread is first-class Soup type
`email_thread` (OD-7). Instantly send/activate/start remain forbidden; Gmail
send is this node. No kernel patches.

## User journeys

Connect a Gmail account (in-memory adapter locally). Pub/Sub push
(`/hooks/gmail/{accountId}`) applies history, stores the cursor, and skips
duplicate message ids. Soup lists the `email_thread`. Opening `/mail` or
`/inbox` reads the thread. Compose submits a send intent; approve then apply
hands the write to `users.messages.send` and appends ActivityLog `sent`.

## Invariants

Send is submit → approve → apply; apply without approve is denied. No SMTP.
No live Gmail in this wrapper (in-memory provider). Instantly writes are not
on `MailApi`. Sync is resumable from the last history-id checkpoint.
Duplicate history records are no-ops. Handlers take receipts (edit to send,
view to read). Query never mints. Projection is rebuildable. Delegation never
widens access beyond granted mailboxes (`thread_access` + inbox delegates).

## Entities and identifiers

- `email_thread` (`eth_`) — first-class registry / Soup type. THREAD property
  alias maps here (ADR-003).
- Wrapper-local: `email_account`, mailbox, message, attachment (N14),
  suppression, scheduled send, sync checkpoint. Provider ids (Gmail
  message/thread ids) are foreign keys.

## Authority and consistency

In-process `MailboxSlice` stands in for **one DO per connected account**:
serialized cursor, undo/send queue, watch bookkeeping. Thread/message storage
is D1-shaped maps written only by the account consumer. Physical Durable
Objects are a later lift of this shape.

## Storage and indexes

N3 `STORAGE_OWNERS` rows: `email_thread` (D1), `mailbox_sync_checkpoint` (DO).
Soup Mail split is last-activity from the `email` outbox. Message bodies stay
on the account store (not a Soup item type).

## RPC/API contract

Typed `MailApi` (ADR-002). Not added to kernel `api.ts`. Methods: connect,
list inbox, get thread, apply Pub/Sub push, submit/approve/apply send.
Ingress `/hooks/gmail/{accountId}` (C2 HTTP exception). No Instantly
send/activate/start. No SMTP. Provider adapter is in-memory
`InMemoryGmailProvider` (`users.messages.send` / `users.history.list`).

## Commands and UI surfaces

34-row freeze in `MAILBOX_COMMAND_IDS` (`email.*` 25 + `thread.*` 9).
`email.reply-all-opt` (opt+r) stays dormant (`commandEnabled` false) unless
the owner rules otherwise (OD-23). Chrome parity: `create-menu.email`,
`launcher.email`, `go-to.mail`, `go-to.inbox`. React: `MailboxWorkspace` /
inbox list / thread view / compose on Shell paths `/mail` (split `email`)
and `/inbox` (split `inbox`), via browser-safe `mailbox/browser` exports.

## Authorization matrix

Mailbox-scoped receipts via `thread_access` (owner, shares, inbox delegates,
`email_links`). Members with edit may submit/approve/apply send. Cross-tenant
mint denies. Unauthenticated Pub/Sub ingress is account-binding only.

## Events, jobs, retries, and replay

Topic `email`. Activity `created` / `messaged` / `sent`. Replay from outbox.
Poison publishes marked-and-skipped. Duplicate Gmail message ids skipped.
Retries per ADR-005. Cursor replay = re-pull history from last checkpoint
(provider is source of truth; not executed against live Gmail here).

## External providers

| Provider | Posture |
|---|---|
| Gmail API | Send + history. In-memory adapter; no live calls; no SMTP. |
| GCP Pub/Sub | Push sync ingress `/hooks/gmail/*`. Checkpointed. |
| Instantly | Forbidden on this node (reads live on N10). |

## Migration and reconciliation

OD-1 Branch A: shapes + fixture mapping dry run from 23 `email_*` tables
(`wrote=false`). No Postgres load. Prefer re-sync over ETL when data exists
(reconnect and rebuild from provider history). Undo-window state never
migrates.

## Tests and parity fixtures

`packages/mailbox/src/slice.test.tsx` — mapping dry run, row-8 read/sync +
approved write with audit trail, duplicate skip, SMTP/live/Instantly
forbidden, 34-command freeze with dormant opt+r, SSR MailboxWorkspace on
`/mail` and `/inbox`, STORAGE_OWNERS rows.

## Observability/SLOs

Approved-write audit (gate 3) and checkpoint resume (gate 4) are the
load-bearing proofs. This node records history id + ActivityLog `sent`.

## Failure modes and rollback

`MailboxError` / `AuthzError` / missing receipt / apply-before-approve.
Projection rollback = drop + `rebuildProjection()`. Wrapper rollback =
previous package; kernel untouched. Provider adapter has no network.

## Open decisions

- Physical per-account DOs + undo-window alarm (shape is frozen here).
- OD-23: keep or drop dormant `opt+r` reply-all.
- Watch re-arm cron vs per-account alarm.
- Bounce/complaint suppression consumer (SES-equivalent).
- Attachment bytes on N14 R2.
- Mention → N18 notification fan-out.
