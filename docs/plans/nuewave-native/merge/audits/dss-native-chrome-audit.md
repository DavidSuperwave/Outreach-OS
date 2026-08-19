# Domain audit — DSS-native chrome (activity · pins · recents · history · annotations · saved-views · entity-access)

> Created 2026-08-19 by the **research pass (long tail)**. Status: research
> only. **No verdict** — the ledger row stays `◐` until David rules.
> Pointers: `[NW]` = `DavidSuperwave/Neuwave` @
> `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`, `[CF]` = the `cloudflare-os`
> submodule; `path:line` from each clone root. Facts from code at the pin
> only. Rulings D1/D2/D3/D4, R3, C1/C2 are cited, never re-argued.
>
> **Headline for the ledger:** this row reads like chrome and is not. Six of
> the seven names are genuinely small. The seventh — **`entity_access`** — is
> the platform's **authorization core**: 62 files, **6,448 non-test LOC plus
> 13,519 lines of tests**, 13 per-entity-type access queries and 14 typed
> request extractors. It is the concrete, running form of what **D1/1a** ruled
> ("per-type access policy stays code"), and it is a hard prerequisite of every
> other kept domain, not a chrome item. Sizing this row as one line will
> mis-scope it exactly the way `documents` was mis-scoped. See §H.

## A. What the row actually contains

| # | Sub-capability | Old source | Non-test size | Endpoints (EB) |
|---|---|---|---|---|
| 1 | **entity-access** | `crates/entity_access` (+ `entity_access_management`, `entity_access_db_utils`) | **6,448** LOC / 62 files | 1 public (`GET /entity/{entity_type}/{entity_id}/permissions`) — the rest is in-process |
| 2 | **annotations** | `services/document_storage_service/src/api/annotations/` (9 files) | 1,611 LOC | 8 |
| 3 | **activity** | `crates/activity` + DSS `api/activity/` | 893 + 102 LOC | 1 |
| 4 | **saved-views** | `services/document_storage_service/src/api/saved_views.rs` + `crates/saved_views` | 307 + 235 LOC | 5 |
| 5 | **pins** | DSS `api/pins/` (5 files) | 258 LOC | 4 |
| 6 | **history** | DSS `api/history/` (4 files) + `crates/frecency` | 249 + 4,450 LOC | 3 |
| 7 | **recents** | DSS `api/recents/` (2 files) | 64 LOC | 1 |

Adjacent and reached through the same rows: `user_document_view_location/`
(205 LOC, 3 endpoints), `threads/` (219 LOC, 1 endpoint), `instructions/`
(162 LOC, 2 endpoints). Endpoint counts cross-check
`endpoint-inventory-backend.md` §2 "DSS service modules (misc)".

## B. entity-access — the authorization core

### B1. Shape

`[NW] crates/entity_access/src/lib.rs:1-26` states the contract: given a user,
an entity id, and an `EntityType`, return an access level. Three layers:

- **domain** — `models.rs` (659 LOC), `ports.rs` (507), `service.rs` (635).
- **outbound** — `pg_access_repo/mod.rs` (526) dispatching to **13 per-type
  query modules**: `document_access.rs`, `project_access.rs`,
  `chat_access.rs`, `thread_access.rs` (248 LOC — the largest),
  `channel_membership.rs`, `channel_role.rs` (172), `channel_users.rs`,
  `call_access/mod.rs`, `call_channel.rs`, `crm_company_access.rs`,
  `crm_contact_access.rs`, `foreign_entity_access.rs`, `team_access.rs`.
- **inbound** — **14 typed axum extractors** (`bot`, `call`, `channel`,
  `chat`, `document`, `entity_body`, `entity_permission`, `foreign_entity`,
  `history`, `pin`, `project`, `reminder`, `team`, `thread`) that turn "this
  handler needs Edit on a document" into a compile-time obligation.

The extractors are why every other crate's routers take an `AccessSvc:
EntityAccessService` type parameter: authorization is a **request-extraction
concern**, not a call inside handlers. `favorites`, `foreign_entity`, `bots`,
`webhook`, `reminders`, `pins`, `history` all thread it through.

### B2. The access-level lattice

`models.rs` carries `AccessLevel` (View / Comment / Edit / Owner) plus
**capability marker types** — `ViewAccessLevel`, `CommentAccessLevel`,
`EditAccessLevel`, `OwnerAccessLevel`, `OwnerTeamRole`,
`OwnerParticipantRole`, `ViewOnly`, `ChannelViewOnly` — each implementing
`RequiredPermission`. A handler that asks for `EntityAccessReceipt<EditAccessLevel>`
cannot compile against a view-only check. Channel access additionally resolves
through `ParticipantRole` (Owner / Admin / Member).

The **receipt** type is the load-bearing idea: an extractor returns an
`EntityAccessReceipt<L>` that carries *both* the authenticated user and the
entity, and downstream services take the receipt rather than raw ids (see
`[NW] crates/favorites/src/domain/service.rs:79-102`, where `add_favorite`
takes a receipt and `add_favorite_with_established_access` is the explicit,
separately-named escape hatch for internal callers). That pairing —
"authorization already happened, and here is the proof" — is the single most
portable idea in the crate.

### B3. Test mass is the signal

**68% of the crate is tests** (13,519 of 19,967 lines). Nothing else in the
harvest is tested at that ratio. Two readings, both worth stating: the rules
are subtle enough to need it, and the test corpus is itself a specification
that a CF-native rewrite could be validated against.

### B4. Relationship to the ruled patterns

- **D1/1a** ruled the ontology kept and "per-type access policy stays code".
  This crate *is* that policy, already as code. The six per-type
  `*Permission` join tables (`audits/documents-audit.md` §E) plus
  `entity_access` (`[NW] crates/macro_db_client/migrations/20260331152752_add_entity_access_table.sql`)
  are its storage; the 13 query modules are its logic.
- The **SEC-1/2/3 holes** referenced by the ruled share-permission invariant
  ("preserved — with the SEC holes fixed, not recreated") land here, in these
  13 modules. This row is therefore where that invariant is discharged.

## C. activity — an append-only fact log with a closed vocabulary

`[NW] crates/macro_db_client/migrations/20260805180315_create_activity_events.sql:4`
creates one table and the migration comment states the design: *"One
append-only table of activity facts… Every activity surface is a query over
this table; no derived tables."*

- **Idempotent ids:** `id = uuidv5(source event id, ordinal)` — one broker
  event may yield several facts, and replays re-derive the same ids, so
  inserts are idempotent by construction (migration header, `:5-7`).
- **Two keyset indexes**, both with `id` as the tiebreaker: by `subject_id`
  and by `(entity_type, entity_id)` (`:21`, `:23`). Those are exactly the two
  surfaces — "my activity" and "this entity's activity".
- **Closed 10-variant vocabulary** (`[NW] crates/activity/src/domain/models.rs:102`):
  `Created`, `Edited`, `Opened`, `Deleted`, `Messaged`, `Sent`,
  `PropertyChanged`, `ParticipantAdded`, `ParticipantRemoved`, `CallStarted`.
  The doc comment above it is a storage contract: *"renaming a variant is a
  storage migration"*, enforced by a pinned codec test.
- **actor vs subject:** `actor_id` is who mechanically acted (prefixed
  principals `macro|…`, `bot|…`); `subject_id` is whose activity it is
  (`on_behalf_of ?? actor`, resolved at ingestion). Agent-run actions are
  therefore attributable to both the agent and the person — directly relevant
  to a product where agents act for users.
- **Fed by Kafka** (`crates/activity/src/inbound/kafka_consumer.rs`), with the
  *host service* declaring which topics via `declare_topics!` — the crate is
  transport-shaped but topic-agnostic.

This is the cleanest **D3/3a** fit in the long tail: idempotent consumer,
already keyed so replay is a no-op.

## D. history, recents, frecency — three names, one ranking system

- `UserHistory` (PK `userId,itemId,itemType`), `ItemLastAccessed`,
  `Pin`, `UserDocumentViewLocation` are the raw tables (SH §1.10).
- **`crates/frecency` (4,450 LOC)** is the ranking engine behind
  quick-access, recents, and mention/attachment ordering. Its constants are
  the whole algorithm (`[NW] crates/frecency/src/domain/models.rs:199-205`):
  `MAX_RECENT_EVENTS = 10` (only the last ten events per entity are kept),
  `RECENCY_DECAY_RATE = 0.1` per hour (exponential decay,
  `:308`), `FREQUENCY_PERCENT = 0.7` — so the score is
  `0.7 × frequency + 0.3 × recency` (`:314-315`).
- It is consumed by **soup, memory, ai_tools, email, channels** (per
  `Cargo.toml` deps) — i.e. frecency is not a chrome feature, it is a
  cross-domain ranking service. It has no ledger row of its own.

`recents` (64 LOC) is a single endpoint over deleted items
(`GET /recents/deleted`) and is not the recents users think of — that is
history + frecency. Worth stating so the row is not scoped by its name.

## E. annotations — the PDF geometry stack

Eight endpoints across `comments` and `anchors`
(`[NW] services/document_storage_service/src/api/annotations/mod.rs:31-68`),
over `Thread` / `Comment` / `ThreadAnchor` and the geometry tables
`PdfPlaceableCommentAnchor`, `PdfHighlightAnchor`, `PdfHighlightRect`,
plus `WebAnnotations` (SH §1.6). `ThreadAnchor.anchorTableName` is a
**polymorphic pointer with its own enum** (`anchor_table_name`) — a second,
smaller instance of the D1 glue pattern living inside one domain.

`audits/documents-audit.md` §D1 already records that this stack and the
`documents` row are the same build. Both rows should move together whatever
David decides.

## F. saved-views — three tiers, one opaque blob

- Server-side personal views: `saved_view(id, user_id, config JSONB)` +
  `excluded_default_view` (SH §1.10), 5 endpoints
  (`[NW] services/document_storage_service/src/api/saved_views.rs:26-30`).
- Team views: **not here** — they live in `team_crm_settings.team_views`
  (`audits/crm-audit.md` §B/§C), a ≤256 KB opaque JSON array.
- Share links: config base64url in the URL, no server state.

The `config` is opaque to the backend in all three tiers — the frontend owns
the schema. That is a migration hazard worth naming now: there is no
server-side view schema to port, so the new list engine's view model defines
it, and old saved views have no automatic translation. (No data migrates —
ruling 8 — so this is a *design* input, not a migration task.)

## G. Cross-cutting: what this row is really carrying

1. **Authorization** (entity-access) — prerequisite for every kept domain.
2. **An event-sourced activity spine** (activity_events) — already idempotent.
3. **A ranking service** (frecency) — consumed by five domains, unrowed.
4. **Per-user personalization state** (pins, history, view locations,
   saved views) — small, but it is the state that makes a workspace feel
   like *yours*, and it is entirely per-user, which makes it the most natural
   fit for the kernel's per-user DO (`[CF] packages/workshop-backend/src/user.ts:151-220`)
   of anything in the harvest.
5. **The annotation stack** — belongs with `documents`.

## H. Options for David (not a ruling)

- **N1 — split the row four ways:** `entity-access` (its own row, ruled
  first because everything depends on it), `activity` (+ the activity_events
  contract), `personalization` (pins/history/recents/view-locations/
  saved-views/frecency), and fold `annotations` into the `documents` row per
  `audits/documents-audit.md` §G.
- **N2 — split only `entity-access` out** and leave the rest as one chrome
  row.
- **N3 — keep one row** with the §A table as explicit sub-scope.

Two items additionally have **no ledger row today** and would need one under
any option: **`frecency`** (§D) and the **`activity_events` vocabulary as an
event contract** (§C) — the latter overlaps the `macro.*` topic list recorded
on the `search_processing_service` row.

## I. Open questions parked for design time

1. Does the **receipt** pattern (§B2) survive as the CF-native authorization
   shape, or does authorization become a DO-side check? The receipt only
   makes sense if there is a request-extraction layer to attach it to.
2. `entity_access`'s 13,519 lines of tests: port as a conformance suite for
   the rebuilt policy, or start clean? (It is the only executable spec of the
   sharing invariant.)
3. Is `frecency` a service or a per-user DO field? Five domains read it.
4. Do the three saved-view tiers survive, or does the new list engine define
   one view model? (§F — nothing translates automatically.)
5. `activity_events` is written by a Kafka consumer today. Under **D3/3a** the
   intent-record + alarm idiom replaces the bus — does activity ingest from
   the same per-domain intents, or does it stay a single fan-in consumer?
6. Actor-vs-subject (§C): does the new model keep the two-principal shape for
   agent actions? It is cheap now and expensive to retrofit.

## J. Coverage

**Read:** `crates/entity_access` file tree, per-file LOC, `lib.rs:1-33`,
`domain/models.rs` access-level/marker-type region (grep-level, `:16-283`),
the 13 query-module names and their LOC, the 14 extractor filenames;
`crates/entity_access_management/src/lib.rs:1-16`; `crates/activity` full
file tree, `domain/models.rs:95-175` (the `Action` enum and `to_columns`),
`inbound/kafka_consumer.rs` topic-declaration region;
`20260805180315_create_activity_events.sql` in full;
`crates/frecency/src/domain/models.rs:148-315` (score model and constants) and
its consumer `Cargo.toml` set; DSS `api/` module listing with per-module LOC
for all eleven native modules; `endpoint-inventory-backend.md` §2 for the
endpoint counts; `schema-harvest.md` §1.6/§1.10 for the tables.

**Not read:** every handler body in `annotations/`, `pins/`, `history/`,
`recents/`, `saved_views.rs`, `user_document_view_location/`, `instructions/`
— endpoint *behavior* here is taken from route names, the inventory, and
table shapes, **not** verified against handler logic; `entity_access`
`domain/service.rs` and `pg_access_repo/mod.rs` bodies (dispatch verified by
module names, the actual SQL per type unread — so **the per-type access
*rules* are not restated here**, only that they exist per type; the CRM ones
are separately documented in `crm-audit.md` §D10); all 13,519 lines of
entity_access tests; `crates/frecency` inbound/outbound adapters and its
write path (who emits `frecency_events` was not traced); `crates/saved_views`
body; the `anchor_table_name` enum's full variant list (two variants named
from `schema-harvest.md`, not re-verified in the migration).

**Not verified:** that `GET /recents/deleted` is the only recents surface —
the frontend may assemble "recent" from history + frecency queries, which was
not traced through `apps/web`. This audit is backend-only; cross-check
`endpoint-inventory-frontend.md` and
`reference/platform-context/ui-ux-component-catalog.md` before any UI scoping.
