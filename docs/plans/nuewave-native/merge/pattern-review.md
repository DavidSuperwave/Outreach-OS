# Pattern review — the four parked data patterns (Q21)

> Created 2026-08-19 by the merge-review pass (workstream 1 of
> `next-agent-prompt.md`), per David's order: for each pattern, determine
> from source *why it exists* (domain- vs substrate-motivated), map it
> onto Cloudflare behavior, and present per-pattern adopt/replace
> **options with failure modes — never verdicts**. David ruled he *leans
> adopt*; each section ends with the options he rules on (ruling batch D).
> Pointers: `[NW]` = Neuwave clone @ `9f7a26b`, `[CF]` = the
> `cloudflare-os` submodule; `path:line` from each root.
>
> **Source-doc correction:** `19_BUILD_HANDOFF.md`, `18_DECISION_RECORD.md`,
> `BUILD_STATUS.md` (named in `agent-brief.md` as the old team's decision
> docs) **do not exist in either repo**. The relevant in-source design
> document is `[NW] docs/PROPERTY_TARGET_ENTITY_TYPE_PLAN.md`.

---

## Pattern 1 — Polymorphic entity glue (`entity_type`/`entity_id`)

**What it is.** `(entity_type, entity_id)` column pairs as universal
cross-domain references, no FKs. Canonical carriers: `entity_access`
(generic ACL — `[NW] crates/macro_db_client/migrations/20260331152752:1-41`),
`entity_properties` (with the founding comment *"no foreign key
constraints since they're in different databases"* —
`20251030100000:119-121`; the "four databases" were a fiction, it's one
Postgres), comms attachments/mentions, favorites, activity, reminders,
notifications, frecency, webhooks, import, UserHistory/Pin. The platform
actively migrated *toward* the pattern (chat attachments converged onto it,
`20260430120001:1-27`).

**Load-bearing facts.**
- The canonical type is `[NW] crates/model-entity/src/lib.rs:34-68` — a
  16-variant `EntityType` enum + `Entity{type, id}`. **56 crates/services
  depend on it.** "Entity = (type, id)" is the platform's real ontology.
- The glue is **not uniform**: only Chat/Document/Project/EmailThread/Call
  live in `entity_access`; every other type resolves access by its own
  rule, centralized in code (`model-entity/src/lib.rs:73-101` with
  per-variant comments — CRM derives via team joins, calls via owning
  channel, calendar via inbox delegation).
- Cross-domain list views (Soup) depend on single-DB UNION queries +
  hand-tuned semi-joins over `entity_access`
  (`crates/soup/src/outbound/pg_soup_repo/expanded/dynamic.rs:1055-1065` —
  a materialized form was abandoned because it "pinned the worst plan").
- Integrity is aspirational: *"Polymorphism still rules out an FK; readers
  filter dangling rows"* (`20260729145833:10-16`), and a TEXT→UUID id
  migration is documented half-finished in the same file.

**Why it exists.** *Domain-motivated at core* — the product genuinely
attaches/favorites/mentions/notifies-about heterogeneous entities.
*Substrate-motivated in shape* — the no-FK column-pair encoding exists
because the schema pretended to be four databases and Postgres has no
union type. The costs (dangling refs, per-type access special cases,
planner fights) are substrate symptoms.

**Cloudflare mapping.** `(type, id)` maps naturally to a DO namespace +
id (typed stub lookup), optionally with a thin D1/registry table (id,
type, tenant, tombstone) for existence/deletion checks. The per-type
access policy should become explicit per-DO access methods — which is
what the code already is (`is_valid_entity_access_entity` is code, not
data).

**Failure modes if adopted blindly.**
- Cross-entity list views break: Soup's one-query "everything, filtered,
  ACL-gated" relied on single-DB joins; per-entity DOs make it
  scatter-gather and a naive D1 port loses the GIN indexes and planner
  control. A deliberate materialized index (per-user/team index DO — the
  kernel's own outputs-mirror pattern, `[CF] workshop-backend/src/user.ts:172-204`
  — or an event-maintained D1 projection) is required, not optional.
- Dangling references become permanent without tombstones or a deletion
  fan-out protocol; Neuwave leaked them and patched cascades reactively.
- Mixed TEXT/UUID ids: fix one id format **before** building the glue.

**Options for David (D1).**
- **1a — Adopt the ontology, replace the encoding (aligned with his
  lean):** keep `Entity=(type,id)` as the universal reference type;
  entities live in DOs/typed-storage; add an explicit entity registry
  (existence + tombstones) and a designed materialized-index layer for
  cross-entity lists; access policy per-type as code, as today.
- **1b — Adopt including a relational glue table** (D1 `entity_access` +
  glue rows): fastest schema port, but reimports every substrate symptom
  on a weaker database — the failure modes above land immediately.
- **1c — Replace with kernel-native references only** (no universal
  entity type; each domain references others ad hoc): rejects the
  platform's real ontology; 56-crate evidence says this fights the
  product.

**Ruled: 1a (David, 2026-08-19)** — adopt the ontology, replace the
encoding, with both riders standing: the materialized-index layer is
required (not optional), and the TEXT/UUID id format is settled before
any glue is built.

---

## Pattern 2 — EAV property system

**What it is.** `property_definitions` (team/user-owned, 8 data types,
multi-select, entity refs) + `property_options` + `entity_properties`
(one row per (entity, definition), **tagged-union JSONB values** with
CHECK constraints, GIN `jsonb_path_ops` index with query recipes in
comments) — `[NW] crates/macro_db_client/migrations/20251030100000:5-178`.
System properties with fixed UUIDs seeded at `20251128000001`.

**Load-bearing facts.**
- **Core task workflow state is EAV rows, not columns**: 18 system keys —
  Tasks (Assignees, Status, Priority, DueDate, ParentTask, Subtasks,
  DependsOn, Effort, StoryPoints, RelevantDocuments), Email (Source,
  Companies, Sender, Recipients, Subject), CRM (Stage, CompanyOwner,
  Revenue) (`[NW] crates/system_properties/.../system_property_key.rs:80-103`).
- List sorting/grouping/filtering joins EAV directly in SQL (Soup:
  `pg_soup_repo/expanded/dynamic.rs:53-63,930-938` — dynamic
  `EXISTS(SELECT 1 FROM entity_properties…)` compilation); every list item
  gets a bulk properties attach (`pg_soup_repo.rs:229-280`).
- Property writes have side effects — assignee grants, notifications,
  search reindex (`[NW] docs/PROPERTY_TARGET_ENTITY_TYPE_PLAN.md:234-240`).
- In-source pain report: tasks-as-documents created **two property
  namespaces for the same entity id** (`(DOCUMENT,id)` vs `(TASK,id)`),
  producing a real write-then-stale-read bug; that doc is a plan to
  canonicalize target types (`PROPERTY_TARGET_ENTITY_TYPE_PLAN.md:7-23`).
  EAV also needed performance surgery (`20260511131825`).

**Why it exists.** *Split motivation.* User-defined custom properties are
a genuine product feature (Notion-like; team-scoped definitions, tag
promotion). Putting *system* task/CRM fields in the same EAV store is a
Postgres-era choice — one shared global schema can't grow per-team
columns, so everything became rows.

**Cloudflare mapping.** In a DO-per-entity design, values dissolve into a
`Map<definitionId, TaggedValue>` on the entity record — single-writer DO
gives atomic array mutation free (no `jsonb_set` gymnastics).
Definitions are small, read-mostly team data (team DO or D1). Keep the
fixed-UUID system-key scheme — substrate-neutral and good. **The query
half is the genuine gap:** nothing in the kernel answers "filter the
workspace by Status" — that needs designed materialized per-view indexes
(typed-storage non-unique indexes in an index DO, or D1 projections
maintained on write).

**Failure modes if adopted blindly.**
- A D1 `entity_properties` clone reintroduces the cross-entity query need
  without GIN/JSONB operators — `json_each` scans will not sustain
  Soup-style filters.
- Recreating the TASK/DOCUMENT dual-namespace bug — settle entity-type
  canonicalization before writing any property row.
- Property-write side effects were same-process in Rust; on CF they are
  cross-DO effects and need pattern-3 treatment or they drop on eviction.

**Options for David (D2).**
- **2a — Adopt semantics, replace storage (aligned with his lean):**
  keep definitions/options/tagged-values/system-keys semantics exactly;
  store values on the entity record; build the materialized-index layer
  for list filtering as a first-class design task.
- **2b — Adopt EAV as a relational table on D1:** fastest port; fails on
  the query half (failure mode 1) — would need the index layer *anyway*.
- **2c — Split system from custom:** system fields (Status, Assignees,
  Stage…) become typed columns/fields on their entities; EAV survives
  only for user-defined custom properties. Cleanest storage; diverges
  from source semantics where system and custom properties share one
  pipeline (sorting, grouping, AI `SetEntityProperty` tool, the CRM
  shadow-stage mechanism in `crm-audit.md` §C depends on custom
  definitions replacing a system one).

**Ruled: 2a (David, 2026-08-19)** — adopt semantics, replace storage,
with both riders standing: entity-type canonicalization is settled
before any property row is written, and property-write side effects get
pattern-3 (intent + alarm) treatment as cross-DO effects.

---

## Pattern 3 — Transactional outbox tables

**What it is.** Outbox rows written in the same Postgres transaction as
the domain write, drained to SQS by a single in-process loop
(`FOR UPDATE SKIP LOCKED`, oldest-first, publish → mark published):
`email_backfill_init_outbox`, `email_backfill_completion_outbox` (also a
durable post-completion effects job with its own lease),
`calendar_sync_outbox` (`[NW] …/20260725014930:346-420`),
`contacts_backfill_outbox` (`20260429140000`). Producers write outbox row
+ fenced status flip in one tx
(`crates/email_db_client/src/backfill/job/update.rs:193-234,265-332`);
the drain contract is stated verbatim: crash-after-publish duplicates, so
*every consumer is idempotent*
(`services/email_service/src/calendar_outbox.rs:37-39`); an unmappable
row must be marked published or it wedges the queue (:214-219); the
outbox doubles as a feature-flag redelivery buffer (:52-56).

**Key negative finding:** the general event bus does **not** use
outboxes — `crates/macro_event_broker/src/lib.rs:1-16` dual-writes
straight to Kafka. Outboxes were added only where lost kickoffs were
unacceptable (2026 backfill/calendar/contacts). Neuwave itself treated
the outbox as a targeted reliability tool, not an architecture.

**Why it exists.** *Almost entirely substrate-motivated*: it bridges
Postgres transactions to SQS, which can't join them. The domain need is
only "when a job flips state, downstream work reliably starts,
effectively once."

**Cloudflare mapping.**
- **Within one DO the pattern collapses**: a DO write + `setAlarm()` in
  the same event is atomic (output gate), and the alarm retries. The
  kernel already implements exactly this shape —
  `gadgetResponseDeliveries`: idempotency-keyed delivery records with
  status-partitioned secondary indexes and one recomputed shared alarm
  (`[CF] workshop-backend/src/overseer.ts:505-510,826-843,1216-1236,3631-3638`).
- **Cross-DO / to Queues the discipline survives**: `Queue.send()` is not
  transactional with DO storage, so persist an intent record + alarm in
  the same event; the alarm publishes and marks published; consumers stay
  idempotent (the Neuwave comment transfers verbatim — Queues are
  at-least-once anyway).
- For *reconcilable state* (payload = current state, not event), the
  kernel prefers idempotent snapshot-push + reconcile-on-open
  (`overseer.ts:3022-3095`, `user.ts:172-204`) — self-healing, often
  better than an event outbox.

**Failure modes if adopted blindly.**
- Porting the SKIP-LOCKED drain to D1: no `FOR UPDATE`, no long
  transactions — competing stateless drains double-publish. The drain
  must be a single alarm-driven DO, which makes the locking unnecessary.
- Forgetting the poison-pill mark-and-skip rule wedges the ordered drain
  exactly as the source warns.

**Options for David (D3).**
- **3a — Adopt the discipline, not the tables (aligned with his lean):**
  intent-record + alarm inside each DO for cross-boundary effects;
  idempotent consumers; snapshot-reconcile where the payload is state.
  This is the kernel's existing idiom.
- **3b — Adopt literally as D1 outbox tables + drain workers:** imports
  the failure modes above; only defensible if a non-DO component must
  produce events, and even then the drain should be one DO.

**Ruled: 3a (David, 2026-08-19)** — adopt the discipline, not the
tables. The two source disciplines carry verbatim: consumers are
idempotent, and poison-pill rows are marked-and-skipped.

---

## Pattern 4 — Lease-based job claiming

**What it is.** Seven instances of "N stateless competing consumers race
over shared Postgres rows; an atomic conditional UPDATE/INSERT is the
arbiter," in two maturity tiers:
- *Token + expiry + fencing* (correct under stale-worker resurrection):
  `calendar_backfill_jobs.lease_token/expires` with renewal and
  **per-provider-mutation fencing** (`fence_google_mutation_tx` re-checks
  the token inside every write tx —
  `[NW] crates/calendar_events/src/outbound/pg.rs:1452-1494,1592-1655`);
  `email_backfill_jobs.init_lease_*` and the completion-outbox
  `effects_lease_*` (claim/reclaim/renew/fenced-complete —
  `crates/email_db_client/src/backfill/job/update.rs:150-234,350-454`).
- *Bare timestamp* (double-execution possible past the staleness window,
  acknowledged in comments): `scheduled_action.claimed`
  (`services/scheduled_action/src/outbound/pg_scheduled_action_repo.rs:117-260`,
  multi-instance rationale at `pg_polling_dispatcher.rs:26-40`),
  `processing_ai_projections` insert-as-lock with blanket 15-min DELETE
  reclaim, `email_attachments.upload_claimed_at` one-way claim,
  reminders `claim_occurrence` (claim-race-is-harmless design,
  `crates/reminders/src/domain/ports.rs:150-214`).

**Why it exists.** *Almost purely substrate-motivated*: horizontally
scaled stateless ECS workers + SQS redelivery over Postgres. The domain
requirement everywhere is just "at most one live executor per job." The
one piece that survives any substrate: **fencing external side effects**
(Google mutations) against resurrected stale workers.

**Cloudflare mapping.** **A Durable Object *is* the lease.** One DO per
job/family is single-writer: claim/renew/release vanish; `setAlarm()`
replaces the polling dispatcher; alarms retry and never run concurrently
with themselves. The kernel demonstrates it: durable in-progress registry
+ resume-on-construct + alarm-as-keepalive/retry
(`[CF] overseer.ts:820-824,1184-1210,1329-1341,6298-6310`).
scheduled_action → per-action alarms in an owner DO; reminders → per-user
DO with one alarm at `min(next_run_at)`.

**Failure modes if adopted blindly.**
- Lease columns inside a single-writer DO are redundant and can deadlock
  the object against itself after eviction (the "old holder" is the same
  object).
- Leases in D1 for competing Workers reproduce the *weakest* Neuwave tier
  with worse tools — route shared external work through a coordinator DO
  instead.
- **One alarm per DO**: a DO hosting several Neuwave job types must adopt
  the kernel's recompute-shared-alarm discipline (`overseer.ts:1219-1220`)
  or timers silently clobber each other.
- **Must keep**: fencing tokens / idempotency keys for external mutations
  (alarm handlers are at-least-once from the external system's view) —
  ported as DO-local state, not DB rows.

**Options for David (D4).**
- **4a — Replace with DO single-writer + alarms; keep external-mutation
  fencing (aligned with his lean *in effect*, though mechanically a
  replace):** leases/claims/dispatchers are not ported; fencing and
  idempotency keys are.
- **4b — Adopt lease tables on D1:** reproduces the weakest tier with
  weaker guarantees; no identified case requires it.

**Ruled: 4a (David, 2026-08-19)** — DO single-writer + alarms; leases,
claims, and polling dispatchers are not ported; external-mutation
fencing and idempotency keys are, as DO-local state. Rider standing:
multi-job DOs use the kernel's recompute-shared-alarm discipline.

---

## CF-OS primitives (verified for this review)

- **typed-storage** (`[CF] packages/typed-storage/src/index.ts`): typed
  collections + singletons over DO KV; unique and non-unique secondary
  indexes maintained atomically with the record write inside
  `transactionSync` (:319-331,452-585); cursor pagination; transactions
  are **one-DO-only**; no migrations yet (:1-5 TODO).
- **workshop-backend DOs**: per-user DO with mirrored outputs index +
  backfill cursor (`user.ts:151-220`); per-workspace Overseer with
  durable job registry, resume-on-construct, one shared recomputed alarm,
  DO-native outbox, best-effort snapshot push + reconcile-on-open;
  `blockConcurrencyWhile` init.
- **No Cloudflare Queues binding and no D1 anywhere in workshop-backend**
  — all "queues" in src are in-memory RPC constructs. Any Queues/D1 use
  in the rebuild is wrapper-side and new.

**Net:** the kernel already contains idiomatic, working replacements for
patterns 3 and 4, and a partial answer (mirrored index + cursor) to
pattern 1's read problem. It has **no answer for pattern 2's query half**
(EAV-style ad-hoc filtering across many entities) — that is the genuine
design gap the merge must fill deliberately.

## Coverage

Not examined: frecency/favorites/activity internals (writers grep-
confirmed only); notification fan-out pipeline; ~980 of ~1100 lines of
soup dynamic SQL; webhook retry policy in depth; graphql layers; the web
frontend; email backfill SQS consumers (grepped); entity_access domain
service internals; `overseer.ts` beyond the alarm/registry/outbox/outputs
sections (~400 of 9.5k lines read); `agent.ts` grepped for alarms/queues
only; typed-storage tests. The harvest doc's table inventory was trusted
for tables not independently cited (every cited table/migration was
verified by pointer). The old team's handoff docs named in
`agent-brief.md` do not exist at the pin (see header).
