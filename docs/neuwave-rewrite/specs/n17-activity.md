# Domain specification — Activity / frecency / recents / favorites (N17 / SUP-564)

## Verdict and source evidence

Wave 4c ranking node. ADR-005 activity rides the N3 fact log (not a bus
topic; `activity_events` is a UUIDv5 namespace). OD-21 froze the closed
10-action vocabulary and frecency constants as parity fixtures (J10/J11).
OD-19 ruled: **no automated retention/deletion job** — do not build one.
Favorites listing already filters through receipts on N4 (SEC-1). Visible
"recents" **is** frecency; `GET /recents/deleted` is the only recents HTTP
leftover and is named, not served, here (trash restore is N7). 05-MAP row
12: same activity stream yields stable recents/favorites ordering. No
Instantly send/activate. No kernel patches. Wrapper-only: N3
`ACTIVITY_ACTIONS` / `ActivityLog` and N4 `FavoritesIndex` are imported,
not duplicated.

## User journeys

A domain write records an activity fact (`created` / `opened` / …). Replay
of the same `(action, entityType, entityId, actorId, occurredAt)` is a
no-op (uuidv5 id). An unknown action is poison: counter++, skip. The actor
opens `/activity` and sees **my-activity** (self keyset) plus **frecency
recents** (score desc, `entityId` tie-break). Opening an entity with a
View receipt shows **entity-activity**. Pinning a row requires View; the
favorites list re-checks receipts and hydrates titles from Soup; fractional
reorder; cap 500. Favorites emit no facts.

## Invariants

Closed 10-action vocabulary imported from control-plane; renaming a variant
is a storage migration. Activity ids are uuidv5 over namespace+content.
Frecency: `score = 0.7×frequency + 0.3×recency`, decay `0.1/hour`, last 10
events, computed **lazily at read** — no cron decay job. Frequency =
`count(last 10 involving entity)/10`. Recency = `exp(-0.1 * hoursSinceLast)`.
Recents **is** that ranking; there is no second recents engine. Favorites
cap 500 + fractional order; add requires View; listing re-checks receipts
(SEC-1). Query never mints receipts. Favorites publish no events. OD-19:
no retention/deletion API.

## Entities and identifiers

Activity facts, frecency scores, and favorite rows are **not** registry
entities. Fact id = `activityId(ACTIVITY_ID_NAMESPACE, content)` (uuid v5).
Favorites/pins/history would be per-user User-DO collections; this node
wraps in-process `FavoritesIndex`. Pins/History APIs are not built here.

## Authority and consistency

In-process `ActivitySlice` is the fact-log writer (queue-consumer shape).
`ActivityLog.append` is idempotent by `fact.id`. Frecency is a pure function
of the last-10 tail + a clock. Favorites wrap N4 `FavoritesIndex` (single
writer = the user). Physical D1 activity log + User-DO lanes are a later
lift of this shape.

## Storage and indexes

Intended N3 `STORAGE_OWNERS` rows (not added in this node — N3 freeze):
`activity_facts` (D1 fact log; rebuild = append-only replay),
`frecency_state` (User DO; rebuild = recompute from activity tail; never
ETL scores). Favorites storage already lives on N4. No retention table.

## RPC/API contract

Typed `ActivityApi` (ADR-002). Not added to kernel `api.ts`.

- `record` — closed vocab; poison skip
- `myActivity(actorId)` / `entityActivity(entityId, viewReceipt)`
- `recents(actorId)` / `score(actorId, entityId)` — frecency
- `addFavorite` / `removeFavorite` / `reorderFavorite` / `listFavorites` /
  `hydrateFavorites`
- `RECENTS_DELETED_HTTP = "/recents/deleted"` named leftover; **no handler**
- **No** purge / expire / retain / GC / deletion-job methods (OD-19)

No Instantly send/activate methods. Five downstream consumers
(soup / memory / ai_tools / email / channels) read `recents`/`score`; they
wire later.

## Commands and UI surfaces

0 new command rows. Parity: `N17_PARITY_COMMAND_IDS` =
`favorites.open.<favorite>`, `soup-entity.favorite` (already in N4's 59).
Chrome `go-to.activity` lives on N5. React: `ActivityWorkspace` on Shell
path `/activity` (`PATH_ROUTES`; panes `[{ type: "home", id: "_" }]`).
Surfaces: `activity.mine`, `activity.frecency`, `favorites.list`.
`browser.ts` is UI-only (no `node:crypto`).

## Authorization matrix

my-activity = self (actorId). entity-activity requires View on the entity
(`requireReceipt`; never mints). Favorites add requires View; listing
filters through receipts (SEC-1, already on N4). Recents ranking is
actor-scoped from facts the actor themselves generated.

## Events, jobs, retries, and replay

Activity consumes domain facts via `record` (10-action mapping). Frecency
consumes the fact tail at read time. Favorites emit nothing. Unknown
actions = poison (counter++, skip), never silent. Replay is uuidv5-safe.
**No cron decay job. No retention/deletion job (OD-19).**

## External providers

| Provider | Posture |
|---|---|
| Instantly | Out of scope. No send/activate. |
| Kernel | Untouched. No `cloudflare-os/` edits. |

## Migration and reconciliation

OD-1: no live data. Facts and frecency start empty (cold-start recents is
acceptable). If data exists later: append-only replay (idempotent);
favorites keyed ETL; frecency recomputes from the migrated tail (never ETL
scores).

## Tests and parity fixtures

`packages/activity/src/slice.test.tsx` — RFC 4122 uuidv5 vector + fact
idempotency; closed-vocab poison; frecency constants exact and fake-clock
numeric scores; last-10 window; same stream → stable recents (score desc,
entityId) including replay; my/entity surfaces never mint; favorites
cap/fractional/hydrate/receipt recheck and **no facts**; OD-19 no
delete-retention API; `/activity` in `PATH_ROUTES`; ActivityWorkspace SSR;
`browser.ts` has no `node:crypto`.

## Observability/SLOs

Poison / vocabulary-drift counter (`poisonCount`). Frecency is O(last-10)
per entity at read. Favorites listing is the N4 path (every-page; SEC-1).

## Failure modes and rollback

`ActivityError` (`denied`, `missing_receipt`, `poison`, `unknown_favorite`,
`cap`). Unknown actions skip. Wrapper rollback = previous package; kernel
untouched. Activity log is append-only (no destructive change).

## Open decisions

- Pins / History APIs deferred (not in the N17 must-build list).
- `GET /recents/deleted` remains a named leftover until N7 trash owns it.
- Physical D1 + User-DO lift of this in-process shape.
- N3 `STORAGE_OWNERS` rows for activity/frecency (N3 freeze; not edited here).
- Five-domain wiring of `recents`/`score` (N4/N9/N11/memory/ai_tools).
