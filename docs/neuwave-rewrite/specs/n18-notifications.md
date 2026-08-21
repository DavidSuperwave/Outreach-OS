# Domain specification — Notifications (N18 / SUP-565)

## Verdict and source evidence

Wave 4c notifications node. **OD-3 RULED 2026-08-20**: notifications are kept
— in-app (kernel session push, C1) + email digests in pass 1; **mobile push
deferred** until a native client exists (OD-9 web-only pilot). The stale
provisional "Drop" at ledger:75 is overruled. ADR-009's no-push branch is the
one built: a `push` port kept unimplemented, device-registration semantics
parked, no APNS/FCM/SNS in pass 1.

Source pin is `crates/model_notifications/src/metadata.rs` (D1 exact: 19
`TYPE_NAME` consts, 22 structs; D5: 7 github-prefixed). Producers: channels
(N9), email (N11), GitHub via connectivity (N10). Digest/unread feeds consume
N17 later. Instantly is **reads only** globally — this package adds no
Instantly send/activate. No kernel patches.

Release gates: 4 (idempotent once-delivery), 5 (unread reconcile). 05-MAP
row 13.

## User journeys

A producer emits a typed `NotificationIntent`. The per-user authority
ingests it idempotently (notification id = uuidv5 of `(eventId, recipientId)`).
A duplicate appears once. If the recipient is live on the session, in-app
delivery records a session-push stand-in and push is skipped. Unseen items
batch into an email digest with an unsubscribe code. The recipient marks
seen / done / undone / delete; the unread badge is always `filter !seen`.
Per-type opt-out and entity mute are evaluated at delivery time. Mobile push
is not delivered (port throws `push_deferred`).

## Invariants

Exactly-once user-visible delivery per `(event, recipient)` — duplicate ingest
is a no-op. Unread count is derived, never stored independently. The 19-type
vocabulary is closed; `format_title` copy is frozen in tests. Suppression
(preference / mute / digest unsubscribe) is evaluated at delivery time, not
enqueue time. Push only when `sessionLive !== true` (and even then the port
throws). Device registration tables are parked. 0 direct command rows. This
package does not steal mailbox `/inbox`.

## Entities and identifiers

Notifications are **not** a registry `EntityType`. Wrapper-local records:

- `notification` — per recipient, typed, entity-linked. Id = uuidv5 of
  `(eventId, recipientId)` under the notifications namespace.
- `preference` — per-type opt-in (default on).
- `mute` — `MuteKey` `{ recipientId, entityId, type? }`; `entityId: "*"` is
  global mute.
- `digest_state` / unsubscribe code — per-user, deterministic uuidv5 of
  `unsub:{recipientId}`.
- `receipt` — per-channel delivery record (`in_app` | `email`; `push` never
  succeeds in pass 1).
- `device_registration` — parked.

Closed catalog (exact ids):

GitHub (7): `github_pr_opened`, `github_pr_merged`, `github_pr_closed`,
`github_pr_comment`, `github_review_requested`, `github_review_submitted`,
`github_mention`.

Product (12): `channel_mention`, `channel_reply`, `channel_send`,
`email_received`, `call_started`, `reminder_due`, `document_shared`,
`comment_added`, `task_assigned`, `agent_completed`, `automation_ran`,
`digest_ready`.

22 metadata structs = 19 type payloads + 3 shared envelopes
(`NotificationIntent`, `DigestWindow`, `MuteKey`).
`METADATA_STRUCT_COUNT = 22`.

## Authority and consistency

In-process `NotificationAuthority` keyed by `recipientId` stands in for
**one DO per user**. `NotificationsSlice` holds the map. Unread / seen / done
mutations and delivery dedupe serialize per recipient. Fan-out (one event → N
recipients) happens *before* this map. Physical Durable Objects + Queues are
a later lift of this shape. Kernel pin untouched.

## Storage and indexes

11 source tables (D3) map onto DO fields (OD-1 Branch A, no Postgres load):

`notification`, `user_notification`, `user_notification_type_preference`,
`user_mute_notification`, `notification_message_receipt`,
`notification_email_sent`, `channel_notification_email_sent`,
`notification_email_unsubscribe`, `notification_email_unsubscribe_code`,
`user_notification_item_unsubscribe`,
`notification_user_device_registration` (parked).

N3 `STORAGE_OWNERS` is not extended in this node (control-plane freeze for
parallel Wave 4c). Badge counts live on the per-user authority (derived).

## RPC/API contract

Typed `NotificationsApi` (ADR-002). Not added to kernel `api.ts`.

- `ingest` / `list` / `unreadCount`
- `markSeen` / `markDone` / `undone` / `delete`
- `setPreference` / `mute` / `unmute`
- `setSessionLive` / `route` (ingest + egress, last-online gate)
- `flushDigest` / `unsubscribeDigest`
- HTTP unsubscribe links (`/hooks/unsubscribe/*`) named, not served here
  (C2 exception — leftover)

Egress ports:

- `inApp.deliver` — session-push stand-in, `channel: "in_app"`
- `digest.enqueue` / `flushDigest` — email stand-in, `channel: "email"`,
  unsubscribe code
- `push.deliver` — **throws `push_deferred`**

No Instantly send/activate methods. No SMTP. No APNS/FCM/SNS.

GitHub producer: `fromGitHubEvent(name, action?)` maps N10's six ingress
events (`PullRequest`, `IssueComment`, `PullRequestReview`,
`PullRequestReviewComment`, `CheckRun`, `Installation`) plus `mention` onto
the 7 GitHub types where applicable (`CheckRun` / `Installation` → null).

## Commands and UI surfaces

0 direct notification command rows (05-GRAPH §N18).
`N18_PARITY_COMMAND_IDS` is empty — inbox chrome (`go-to.inbox`) stays on N5
and mailbox N11. UI `data-command="notifications.mark-seen"` is fixture-only.

React: `NotificationWorkspace` / list / unread badge. Shell path `"/"`
(home split). Markers: `data-slice="notifications"`,
`data-surface="notifications.list"`, `data-unread-count`. Does **not** steal
`/inbox`. `browser.ts` is UI-only (catalog + commands + workspace; no
authority, egress, or crypto).

## Authorization matrix

Strictly self-scoped (recipient-only reads/writes). Producers must hold the
entity receipt that justifies notifying (mentioner could View — ADR-004;
carried on the event envelope later). Revoked entities degrade to a
permission-safe stub on render (not implemented in pass 1; fail-closed
default). Cross-user list is impossible: authorities are keyed by recipient.

## Events, jobs, retries, and replay

Consumes producer events from N9 / N11 / N10. Deterministic notification id;
per-channel receipts. Duplicate `(eventId, recipientId)` is a no-op.
Digest = per-user alarm stand-in (`flushDigest`); per-channel dedupe on
enqueue. Replay is safe. Poison: unknown GitHub events return null from
`fromGitHubEvent`. Push retries are not in pass 1.

## External providers

| Provider | Posture |
|---|---|
| Kernel `/api` session push (C1) | In-app stand-in only. Live websocket leftover. |
| Mailbox email path (N11) | Digest stand-in. No SMTP / Gmail send here. |
| Mobile push | Port throws `push_deferred`. No APNS / FCM / SNS. |
| Instantly | Out of scope. No send/activate. |
| GitHub (N10) | Type mapping only. Six ingress events + mention. |

## Migration and reconciliation

OD-1 Branch A: shapes + fixture mapping dry run for the 11 tables. No
Postgres load. Device registrations re-enroll later (parked). Digest/dedupe
state restarts cleanly (a window of duplicate-digest risk is accepted).
Unread/preference ETL is not in this node.

## Tests and parity fixtures

`packages/notifications/src/slice.test.tsx` — 19-type catalog length, 7
github prefix, `format_title` goldens for all 19, duplicate ingest once,
unread reconcile, preference suppresses delivery, `push` throws
`push_deferred`, digest unsubscribe, `fromGitHubEvent` covers 7 types,
NotificationWorkspace SSR on `/` without `/inbox`, 0 command rows, 11-table
dry run, no Instantly send, no APNS/FCM/SNS clients.

## Observability/SLOs

Delivery latency per channel (in-app p95 < 2s target, stand-in). Dedupe hit
counter (`created: false`). Digest send success (stand-in). Unread
reconciliation = `list().filter(!seen).length`. Push token failure rate is
N/A in pass 1.

## Failure modes and rollback

`NotificationsError`: `push_deferred`, `unknown_notification`,
`unknown_recipient`, `invalid_unsubscribe`, `unknown_type`,
`instantly_forbidden`, `device_registration_parked`. Egress channels are
independent: a bad digest path does not touch the log; push can stay
deferred forever. Wrapper rollback = previous package; kernel untouched.

## Open decisions

- Live kernel websocket session-push (C1) — stand-in receipts only.
- Live email digest SMTP / Gmail via N11 mailbox send path.
- Mobile push (APNS/FCM, no SNS) — deferred until a native client exists.
- N3 `STORAGE_OWNERS` row for `notification_authority` (control-plane not
  edited in this parallel node).
- HTTP `/hooks/unsubscribe/*` worker (C2).
- Agent-raised notifications on the frozen Gatekeeper ai_toolset surface.
- Revoked-entity permission-safe stub on render (ADR-004).
