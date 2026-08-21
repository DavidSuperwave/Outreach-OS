# Domain specification — Task vertical slice (N6 / SUP-553)

## Verdict and source evidence

Hard gate. OD-7: task = document + facet `task` + TASK property bundle. OD-1 Branch A:
migration fixture = seed typed ids + identity-mapping dry run (no Postgres load).
WP-040. Freezes the four contracts: typed ids, receipts, envelope, projection ownership.
Nothing in Wave 4 / N10 until this slice's 11 requirements and gates 1–8 pass.

## User journeys

`c` then `t` opens the task-compose popover. Create writes an authoritative document with
facet `task`, drains the outbox, Soup lists the row, a live subscriber sees the delta, status
/ priority / assignee edits append `property_changed` facts. Reload rebuilds the list from
the outbox. Revoke denies a subsequent mint so the row cannot be listed.

## Invariants

No Task entity type. Handlers take receipts. Query never mints. Projection is rebuildable.
Duplicate idempotency keys are no-ops. Poison publishes are marked-and-skipped.

## Storage and indexes

Authoritative document map on `TaskSliceDurableObject` SQLite (survives eviction).
N3 outbox lives in the same snapshot. N4 lists family is projected to D1 `entity_row`
(OD-27), tenant-scoped (never unfiltered DELETE). Live subscribers attach via DO
hibernation WebSockets on `/subscribe` plus cursor replay, using short-lived,
single-use tickets minted by the authenticated `TaskSessionApi` (never the kernel
session token in the URL). Command identities invoke
`TaskApi` mutations through `runSliceCommand` / `bindSliceCommands`. Poison publishes
are marked-and-skipped on the DO outbox. In-process maps remain the unit-test core.

The frozen N4 D1 DDL remains the v1 baseline. N6 applies additive, idempotent
list-schema migrations for `status`, `priority`, normalized JSON
`assignee_ids`/`tags`, and tenant-scoped `entity_access_index` lookup. Existing
rows receive null/empty defaults and are then reconciled from each tenant's
authority/outbox; rollback is drop-and-rebuild of these derived tables, not an
authority migration.


## RPC/API contract

Typed `TaskApi` / `TaskSessionApi` capability (ADR-002). Not added to kernel `api.ts`.
No Instantly send/activate methods.
Every browser mutation carries a stable operation id, mapped server-side to
`RequestContext.idempotencyKey`; the browser retains that id after a transient
failure so retrying the same create/edit/status/priority/assignee/done action is
a no-op, while a distinct user action receives a fresh id.

Kernel `PublicApi` stays on Workshop `/api` (unpatched). The wrapper origin composes beside it:
the custom React shell as HTML for the 27-route map, Cap'n Web `TaskDomainApi` on `/domain`
(`authenticate(token)` → `openTenant` / `openDefaultTenant` → `TaskSessionApi`), and live
subscribe on `/subscribe`. Actor is minted from the kernel session + Team DO membership.
Client `x-neuwave-actor` / REST `POST /rpc` are rejected. Browser hydrate
(`/assets/outreach-shell.js`) calls `PublicApi.login` / `createAccount`, then
`bootLiveTaskSession` (token key `authToken`). Authenticated `GET /tasks`
(Bearer + `x-neuwave-tenant`) SSRs the Soup list from the same session. Poisoned outbox
rows surface as `TaskSessionApi.listAlerts()` / `operator.alerts` (gate 8 proof). Compose
submit is `submitTaskCompose(session, title)`. Local origin may set `LOCAL_KERNEL_API=true`
to serve login/createAccount over the kernel User DO when Workshop is unbound.

## Commands and UI surfaces

15 identities: `global.create`, `create-menu.task`, `launcher.task`,
`command-menu.open-category.tasks`, `go-to.tasks`, `soup.tab-1`, `soup.open`,
`soup-entity.{mark-done,mark-not-done,rename,properties,tags,priority,assignee,status}`.
React: `TaskWorkspace` / `TaskComposePopover` / `TaskList` on the N5 shell.

## Tests and parity fixtures

`packages/task-slice/src/slice.test.tsx` — mapping dry run, create/edit/list/status, live
subscription replay, rebuild+poison, idempotency, SEC-1/cross-tenant, 15 commands including
`c`+`t`, SSR surface.

`packages/task-slice/__tests__/task-do.test.ts` — Miniflare DO + D1: eviction, RPC stub,
cursor reconnect, D1 rebuild, idempotency, SEC-1.

## Failure modes and rollback

`AuthzError` / missing receipt. Projection rollback = drop + `rebuildProjection()`.
The authority snapshot and a generation-stamped pending-delivery marker commit
atomically after a recovery alarm is scheduled. Producer-send or D1 failures leave
the marker/alarm for serialized, idempotent recovery; successful enqueue/projection
clears only its own generation. Transient queue-consumer DO/D1 failures retry
instead of ACKing.
