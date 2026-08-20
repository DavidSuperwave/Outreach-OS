# ADR-009 — Channels, notifications, and realtime delivery

- Status: Proposed (Draft — owner decides; **OD-3 gate cleared**)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

> **Status note (Ruled 2026-08-20, see `../06-owner-decisions-needed.md`
> OD-3):** the branch is selected — **notifications are kept: in-app (kernel
> session push) + email digests in pass 1; mobile push deferred until a
> native client exists**. The stale provisional "Drop" at ledger row 75 is
> overruled; this ADR's recommended branch (Decision 3's no-push phasing: a
> `push` port kept unimplemented, device-registration semantics parked, no
> APNS/FCM/SNS dependency in pass 1) is the one built. The ledger row's dated
> verdict transcription rides the OD-5 batch session.

## Context

Verified exact at Neuwave @ `9f7a26b` (`reports/01-plan-gap-review.md` §2.4):

- **19 notification types** (22 metadata structs,
  `crates/model_notifications/src/metadata.rs`); 7 of 19 are GitHub's;
  user-visible copy lives in Rust `format_title` implementations.
- **3 egress channels** behind one state machine
  (`crates/notification/src/domain/service/egress.rs`): WebSocket (via
  connection_gateway), mobile push (AWS SNS platform endpoints ios/android/
  **iosvoip** for CallKit), batched email digests with unsubscribe codes and
  per-channel dedupe. Delivery gated by a last-online checker (push only when
  not live on the socket).
- **11 notification tables** (preferences, mutes, receipts, device
  registrations, email-sent/unsubscribe machinery).

**Load-bearing open question:** the `notification_service` ledger row
(research/nuewave-longtail @ `13c2847`, merge-ledger row 75) still carries a
stale provisional **"Drop"** with an **empty verdict slot** — "the largest
unruled capability in the ledger" — while every producer domain
(channels, mailbox, CRM, calls, calendar, reminders, GitHub) is ruled keep.
Q19's default-keep implies the opposite of the stale Drop. This is OD-3, and
this ADR is explicitly conditional on it.

Realtime substrate: route ruling **C1** supersedes `connection_gateway` with
kernel `/api` session push; the gateway's protocol facts (free-form
`message_type` envelope; `track_entity` presence with open/ping/close;
`refresh_email`/`refresh_calendar`/`user_tracking_change`/`StreamEvent`/
`UploadFolderStatusUpdate` types found at the pin) are the behavior inventory.

## Source and ruling constraints

- C1 ruling (2026-08-19): kernel session push replaces the gateway.
- 3a/4a rulings: idempotent consumers; DO single-writer + alarms for digest
  batching (no polling dispatchers).
- Mobile push has no kernel analogue and no in-repo native client (WP-010
  D7/K6); interacts with OD-9 (native scope) and deferral C3.
- 05-MAP parity proof: "idempotent notification appears once and unread state
  reconciles."

## Decision

**Proposed (structured so OD-3 selects a branch, not a redesign):**

1. **One notification authority**: a per-user notification DO (fits the
   kernel per-user DO idiom) owning the notification log, read/unread state,
   preferences, mutes, and per-item unsubscribes — the semantics of the 11
   tables, not their shapes. Producers emit typed notification intents on the
   event stream; the authority ingests idempotently (event-id keyed).
2. **Typed catalog**: the 19 types become a closed, versioned TypeScript
   catalog; titles/copy move from code-adjacent `format_title` into catalog
   template functions in the wrapper (still code, per source behavior, but in
   one governed module). GitHub's 7 types ride the GitHub domain's build.
3. **Egress, phased:**
   - **In-app/realtime (pass 1)**: delivery over kernel `/api` session push
     (C1) to the shell; unread badge reconciliation from the authority.
   - **Email digests (pass 1)**: digest batching as DO alarms per user
     (replacing the batch state machine), unsubscribe codes preserved; egress
     through the platform email path chosen by the mailbox domain design.
   - **Mobile push (deferred — ruled 2026-08-20 via OD-3)**: push is deferred
     until a native client exists; the egress interface keeps a `push` port
     unimplemented, device registration tables' semantics are parked, and no
     APNS/FCM/SNS dependency enters pass 1.
4. **Last-online gating** is preserved as behavior: presence from kernel
   session state decides socket-vs-push (or socket-vs-digest in the no-push
   branch).
5. **Channels/messaging realtime** (ordered channel message delivery,
   presence, AI stream events) rides the same session-push substrate; the
   gateway's free-form `message_type` envelope is replaced by a **closed,
   typed event union** — the enumerated pin-time types are the initial
   members; new types are ledgered additions (the free-form string set was
   producer-defined and is a compatibility trap, not a feature).

## Alternatives considered

1. **Recreate connection_gateway as a wrapper WS service.** Rejected by C1
   ruling; two socket planes to one client is the old topology.
2. **Drop notifications (honor the stale provisional).** Rejected: WP-010
   CON-3 shows the Drop predates the keep-rulings of every producer; dropping
   relocates the work into each domain (audit's analysis), it does not remove
   it.
3. **Per-domain notification fan-out (no central authority).** Rejected:
   unread/preference/mute semantics are cross-domain; 11-table evidence says
   the source treats it as one subsystem.

## Compatibility impact

- The 19-type catalog, preference/mute semantics, digest batching windows,
  and unread reconciliation are the parity surface.
- The typed realtime event union must cover every pin-time `message_type` or
  record an explicit disposition per event family (upload progress, email
  refresh, calendar refresh, presence, AI stream lifecycle — the AI stream
  events map onto the kernel's own chat/stream subscriptions where they
  already exist; see wp020 ledger's subscriber rows).

## State and authorization impact

- Authority: per-user notification DO; projections (badge counts in the index
  plane) derived only.
- Notifications embed entity references, not content: rendering re-resolves
  through receipts (ADR-004) so a revoked entity's notification degrades to a
  permission-safe stub. (Source behavior on this must be captured in the
  domain spec; fail-closed is the default.)
- Push tokens (if built) are secrets-adjacent: device registration storage is
  isolated in the authority; egress keys live in wrapper secret bindings.

## Migration and rollback

- OD-1 Branch A: no data. Branch B: notification history migrates per-user
  behind the identity mapping; digests/dedupe state restarts cleanly (a
  window of duplicate-digest risk is accepted and stated).
- Rollback: egress channels are feature-gated independently (in-app, digest,
  push); a bad channel rolls back without touching the authority log.

## Operational consequences

- No-push branch: zero external notification dependencies in pass 1.
  Push branch: APNS/FCM key custody, SNS-successor selection, and CallKit/
  VoIP semantics (iosvoip) enter scope — a large operational surface.
- Digest alarms fleet: per-user alarms are the 4a pattern; watch alarm-storm
  behavior on tenant-wide events.

## Tests and acceptance

- Idempotency: duplicate producer event → one notification; replay-safe.
- Unread reconciliation across two live sessions (05-MAP proof).
- Preference/mute matrix tests per type (19 × channels).
- Digest window test: N events → one digest email with correct dedupe and a
  working unsubscribe code.
- Realtime union: every event type schema-validated; unknown-type delivery is
  a test failure (closed union).

## Follow-up decisions

- **OD-3 — RULED 2026-08-20** (see `../06-owner-decisions-needed.md` OD-3):
  notifications kept — in-app + email digests; mobile push deferred until a
  native client exists. This ADR implements that branch; the ledger row's
  dated verdict transcription remains pending in the OD-5 batch.
- **OD-9 (existing)**: native/mobile scope decides whether push has a client
  at all; C3 deferral (app links) rides with it.
- Channel-domain message model (ordering keys, thread semantics) belongs to
  `reports/04-target-architecture-decisions.md`.
