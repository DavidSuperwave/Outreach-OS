# Domain specification — Channels + messages + realtime (N9 / SUP-557)

## Verdict and source evidence

Wave 4a core domain. Ruled keep (2026-08-19) for the full messaging surface.
05-MAP row 7: two users + one agent exchange ordered messages and reconnect
safely. Gateway `/track/{type}/{id}` is an internal JSON **presence query**
(01 §2.10 J18), not the WS upgrade — C1 kernel session push is the socket
plane (ADR-009). Channel-bot contract semantics preserved, wire headers renamed per the
OD-24 amendment (owner ruling, 2026-08-20): `x-neuwave-bot-token` /
`x-neuwave-bot-scope` (formerly `x-macro-bot-*`), `mbot_<12-hex>_<64-hex>`
(ledger:46, S7 kept). Bots are
principals with scoped credentials; mention-triggered agents are kernel
sessions, not a new runtime. No Instantly send/activate. No N11 mailbox /
Gmail send. No kernel patches.

## User journeys

`c` then channel compose (`create-menu.channel`) writes an authoritative
channel; Soup lists it. Two members and one bound bot/agent subscribe,
post in total order, disconnect, and resume from last seq with
replay-then-`ready()` (no loss, no duplication). A DM is a channel flavor.
A thread reply sets `parentId` on the same log. Presence open/ping/close
answers GET `/track/channel/{id}`. An external poster uses the bot webhook
(`x-neuwave-bot-token`); the wrapper does **not** send mail.

## Invariants

Per-channel total message order. Membership changes serialize on the same
writer as appends ("posted after being removed" is impossible). Reconnect
replays seq > cursor then `ready()`. Bot ownership is user XOR team
(`owned` CHECK). Poster auth is human session XOR bot token. Handlers take
receipts (comment to post). Query never mints. Projection is rebuildable.
Duplicate idempotency keys are no-ops. Mention trigger is at-most-once per
`(message id, bot id)`. Closed realtime event union (ADR-009).

## Entities and identifiers

- `channel` (`chn_`) — includes DM as flavor `dm`.
- `channel_message` (`msg_`) — log row; thread = `parentId` on the same type.
- `bot` / `bot_token` — wrapper-local; principal id **is** the `mbot_` token
  (authz channel_membership exception). Not a registry EntityType.

`CHANNEL` / `CHAT` remain canonical `EntityType` variants (ADR-003). Email
`email_thread` is N11.

## Authority and consistency

In-process `ChannelMessageLog` stands in for **one DO per channel**:
append-only seq, serialized membership, fan-out. `ChannelsSlice` holds the
map of logs. Presence is a separate in-process store (KG-5 wrapper), not a
second WebSocket service. Bot identity lives on the creating user/team
authority (XOR owner). Physical Durable Objects are a later lift of this
shape.

## Storage and indexes

N3 `STORAGE_OWNERS` rows: `channel_message_log` (DO), `channel_members` (D1
projection), `channel_presence` (wrapper presence). Soup `channels` list is
last-activity from the outbox. Message bodies stay on the log (not Soup
item type `channel_message`).

## RPC/API contract

Typed `ChannelsApi` (ADR-002). Not added to kernel `api.ts`. Consumes
PresenceSubscriber `{init, add, remove}` plus subscription-replay. Bot
ingress is `/hooks/channels/{id}` (C2 HTTP exception) authenticated by
`x-neuwave-bot-token`. No send/activate Instantly methods. No mailbox send.

Closed realtime union: `message` | `message_edited` | `message_deleted` |
`presence` | `ready`.

## Commands and UI surfaces

16-row freeze in `CHANNEL_COMMAND_IDS` (incl. `channel.find` /
`channel.find-input` two-scope loop). Chrome parity: `create-menu.channel`,
`create-menu.channel-message`, `go-to.channels`, `launcher.channel`,
`command-menu.open-category.channels`. Email `thread.*` 9 stay N11.
React: `ChannelWorkspace` / compose / find / message log / presence strip
on Shell path `/channels` (split `channel`).

## Authorization matrix

Channel receipts via `channel_membership` / `channel_role` / `channel_users`.
Members comment; bots comment via bound `mbot_` token (documented
exception). Membership gates visibility. Cross-tenant mint denies.
Unauthenticated webhook poster is token + channel binding only.

## Events, jobs, retries, and replay

Topic `channels`. Activity `messaged` / membership participant actions.
Replay from outbox. Poison publishes marked-and-skipped. Mention keys are
idempotent. Retries per ADR-005.

## External providers

None in N9. The two CF bot workers (anthropic-status-bot, stripe-payment-bot)
remain living header-contract references (G-019 / S7 option i). They are
not lifted into this wrapper. Instantly is out of scope. Mail send is N11.

## Migration and reconciliation

OD-1 Branch A: shapes + fixture mapping dry run from seven `comms_*` tables
(`wrote=false`). No Postgres load. Per-channel replay by old sequence is
the Branch B path and is not executed here.

## Tests and parity fixtures

`packages/channels/src/slice.test.tsx` — mapping dry run, row-7 ordered
exchange + reconnect, DM + thread, presence `/track` replacement,
bot token/header contract and no send-mail, bot XOR vs human, membership
serialize, idempotency + Soup list, 16-command freeze, SSR ChannelWorkspace,
STORAGE_OWNERS rows.

## Observability/SLOs

Append p95 and reconnect resume success are the load-bearing SLOs (gates 4,
10). This node records seq + presence lastSeen; soak tests are later.

## Failure modes and rollback

`ChannelsError` / `AuthzError` / missing receipt / XOR violations.
Projection rollback = drop + `rebuildProjection()`. Wrapper rollback =
previous package; kernel untouched. Bot webhook ingress is per-token.

## Open decisions

- **OD-5 residue** — github rows ◐; two CF bot workers stay contract
  references, not inlined.
- Physical channel DOs + hibernation (shape is frozen here).
- Full thinking→edit kernel agent loop (N10 sessions).
- Mention → N18 notification fan-out.
- Reconnect load/soak (release gate 10).
- Non-member join prompt UX (`non-member-channel` split exists on N5).
