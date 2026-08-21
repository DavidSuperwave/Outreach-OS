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
hibernation WebSockets on `/subscribe` plus cursor replay. Command identities invoke
`TaskApi` mutations through `runSliceCommand` / `bindSliceCommands`. Poison publishes
are marked-and-skipped on the DO outbox. In-process maps remain the unit-test core.


## RPC/API contract

Typed `TaskApi` capability (ADR-002 pattern). Not added to kernel `api.ts`. No Instantly
send/activate methods.

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
