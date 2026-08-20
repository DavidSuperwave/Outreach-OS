# Domain specification — Calendar + calls (N13 / SUP-560)

## Verdict and source evidence

Wave 4b domain. Ruled keep (2026-08-19) for calendar_events/cal, calls
(LiveKit external), and the transcription sidecar with calls. 05-MAP row 9:
one event/call opens from a Soup list and obeys access rules. Call-recording
PREVIEW is hostage to OD-8 (ffmpeg vs Media Transformations) and is **not**
built here — `preview()` throws `preview_unsupported`. Provider connectors
follow the N10 catalog/connect/mint/revoke pattern; the Google Calendar catalog
entry is local to this package (optional on N10 `CONNECTOR_CATALOG`). No
Instantly send/activate. No kernel patches. No `cloudflare-os/` edits.

## User journeys

Create a calendar event; Soup lists `calendar_event`. Open it from the list
with a view receipt; an outsider mint is denied. Connect the mail-coupled
Google Calendar connector and mirror provider events (`providerEventId`
keyed). Create a call; join via a LiveKit **handle stub** (no live room);
`call_started` is recorded; attach a transcript once; finalize the call
record (immutable afterward). Set a reminder; it fires exactly once.
`CalendarWorkspace` renders on Shell `/calendar` and `/calls`.

## Invariants

Provider remains authoritative for provider-sourced events (mirror semantics).
Call records are immutable after finalization. A transcript attaches to
exactly one call and inherits the call receipt (`transcriptInheritsCall`).
Reminders fire exactly once (per-item alarm shape; no 1-minute poll).
Access: calendar events are owner + explicit shares (`shareLattice`); calls
use `call_access` / `call_channel`. Projection is rebuildable. Duplicate
idempotency keys are no-ops. Preview is unsupported until N15. Instantly
writes do not exist on this API.

## Entities and identifiers

- `calendar_event` (`cal_`) — provider id keyed when mirrored.
- `call` (`call_`) — `CALL_RECORD` property type maps here (ADR-003).
- `reminder` (`rmd_`) — operational fold; scheduler ownership stays DO-alarm.
- `transcript` — wrapper-local sidecar id (`trn_`); not a registry EntityType.

`CALENDAR_EVENT` / `CALL_RECORD` remain canonical property-entity mappings.

## Authority and consistency

In-process `CalendarSlice` stands in for the **account-DO calendar lane**
(serialized provider cursor, same coupling as mail) plus **one DO per live
call** (join/leave/finalize). `TranscriptSidecar` is the in-memory ingest
stand-in (internal queue, not public HTTP). `LiveKitStub` mints room tokens
with `live: false`. Physical Durable Objects are a later lift of this shape.

## Storage and indexes

N3 `STORAGE_OWNERS` rows: `calendar_index` (D1 Soup/date-range), `calls_index`
(D1 Soup + search feed), `call_lifecycle` (DO), `transcript_sidecar` (DO
stand-in; R2 blobs later). Recording preview generation is not stored here
(OD-8).

## RPC/API contract

Typed `CalendarApi` (ADR-002). Not added to kernel `api.ts`. Surface:
create/edit/open/list events; create/join/open/list/finalize calls; mint
LiveKit handle; attach transcript; `preview()` unsupported; reminder
create/fire-once; provider connect + sync. No send/activate Instantly
methods. Closed activity actions used: `created` / `edited` / `opened` /
`call_started`. Topic `calls` (frozen 12-topic bus; calendar events ride the
same topic with `entityType: calendar_event`).

## Commands and UI surfaces

7-row freeze in `N13_COMMAND_IDS`: `calendar.view.day|week|month`,
`calendar.previous-period`, `calendar.next-period`, `calendar.today`,
`reminder-composer.escape`. Chrome parity: `go-to.calendar`, `go-to.calls`,
`go-to.reminders` (N5). React: `CalendarWorkspace` on Shell paths `/calendar`
(split `calendar`) and `/calls` (split `call`). Fixture pages `#calendar`
and `#calls`.

## Authorization matrix

Calendar events: owner + explicit shares. Calls: owner + shares + on-call
participants (`call_access`); channel-hosted calls also pick up
`call_channel`. Transcripts inherit the call receipt level. Cross-tenant
mint denies. Query never mints. Soup lists filter by view receipts.

## Events, jobs, retries, and replay

Topic `calls`. Activity `call_started` on join. Transcript attach is
idempotent by call id (second attach fails). Reminder fire is idempotent
once `fired`. Preview jobs are N15. Replay = outbox rebuild. Poison
publishes marked-and-skipped (ADR-005).

## External providers

| Provider | Posture |
|---|---|
| Google Calendar | N10-pattern connector in this package. Mirror sync. Shared gatekeeper with mail (`GATEKEEPER_GOOGLE`). |
| LiveKit | External. Handle stub only; no live SDK. |
| Instantly | Out of scope. `sendInstantly()` throws. |

## Migration and reconciliation

OD-1 Branch A: shapes + fixture mapping dry run from six calendar/call
tables (`wrote=false`). No Postgres load. Provider calendars re-sync; call
records/transcripts are product-owned (ETL later); previews regenerate, do
not migrate.

## Tests and parity fixtures

`packages/calendar/src/slice.test.tsx` — mapping dry run, row-9 open from
Soup + outsider deny, provider connector without Instantly writes, LiveKit
stub + attach-once transcript + preview unsupported, reminder fire-once,
7-command freeze, SSR CalendarWorkspace on `/calendar` and `/calls`,
STORAGE_OWNERS rows.

## Observability/SLOs

Calendar sync lag and call join success are later load-bearing SLOs (gates
2, 3, 5). This node records event/call version + transcript sha.

## Failure modes and rollback

`CalendarError` / `AuthzError` / missing receipt / preview_unsupported /
transcript_attached / call_finalized. Projection rollback = drop +
`rebuildProjection()`. Wrapper rollback = previous package; kernel untouched.

## Open decisions

- **OD-8** — ffmpeg vs Cloudflare Media Transformations for call-recording
  previews (N15). N13 stub throws.
- Recurring-event RRULE expansion (classic parity trap; field stored, not
  expanded).
- Physical account-DO lane shared with N11 mailbox.
- Live LiveKit rooms + `/hooks/livekit/*`.
- Reminder DST/timezone soak (IANA kept; fire-once is the freeze).
