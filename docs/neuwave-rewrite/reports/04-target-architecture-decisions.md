# WP-030 (part A) — Target architecture decisions per domain

Date: 2026-08-20. Author: WP-030 architecture agent (first pass).
Status: complete for this pass; coverage limits stated in §0.6 and per-domain.

## 0. Ground rules for this document

### 0.1 Pins and sources

| Source | Pin |
|---|---|
| Implementation worktree (Outreach-OS) | `dec12f2df3d205965838526076b910cdb8a845ce` |
| `cloudflare-os` kernel submodule | `bf7f762d7fa73553284d731ab6a978d3ea17be24` |
| Neuwave reference (read-only) | `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` |
| Decision ledger ("Ledger") | branch `research/nuewave-longtail` @ `13c2847543326f8c2ce8485b26a1c1f0520cfa1b`, path `docs/plans/nuewave-native/merge/merge-ledger.md` (read via `git show` only) |

Shorthand used below: **RPC-L** = `reports/02-rpc-compatibility-ledger.csv` (182 rows, all reviewed;
see `reports/notes/wp020-rpc-coverage.md`); **CMD-L** = `reports/03-command-hotkey-ledger.csv`
(387 rows = 383 commands + 4 scope registrations; see `reports/notes/wp020-hotkey-coverage.md`);
**Audits** = `docs/plans/nuewave-native/merge/audits/*` on the research branch; **EB/EF/SH** =
endpoint inventories and schema harvest on the same branch. Neuwave paths are at `9f7a26b` unless
stated; kernel paths at `bf7f762`.

### 0.2 Epistemic labels

- **[F]** verified fact — carried from wave-1 verification (`reports/00`, `reports/01`, WP-020 notes) or re-checked at the pins; each carries a citation.
- **[I]** inference — stated as such.
- **[R]** recommendation — this pass's design choice; owner/ADR may override.
- **[OD]** owner decision needed — pre-existing IDs `OD-1…OD-10` are from `reports/notes/wp010-owner-decisions.md`; new ones raised by this pass are `OD-30x` and appended to `reports/notes/wp030-arch-owner-decisions.md`.

### 0.3 ADR cross-references (RECONCILED against the landed ADR set)

The ADR set landed under `reports/adrs/` (all fourteen, per `reports/adrs/README.md`); this
document's references have been renumbered to match it. Confirmed numbering:

- **ADR-001 Custom shell vs stock/hybrid** (custom React shell + command registry; OD-11)
- **ADR-002 API/RPC compatibility boundary** (the 182-row kernel freeze; wrapper capabilities beside the `/api` Cap'n Web session; OD-12)
- **ADR-003 Entity registry and canonical identifiers** (opaque type-tagged TEXT ids; 16/10/413 vocabularies; TASK/THREAD via OD-7)
- **ADR-004 Authorization receipts and policy model** (typed receipts; SEC-1/2/3 fixed, not recreated)
- **ADR-005 DO/D1/R2/KV/Queue/Workflow ownership rules** (single-writer rule; ownership manifest; **outbox + event envelope + idempotency discipline** — rulings 3a/4a live here)
- **ADR-006 Soup and cross-entity materialized indexes** (the required materialized-index layer)
- **ADR-007 Seven-entity-type search** (coverage contract; OD-15 substrate election)
- **ADR-008 Sync and collaboration** (two CRDT planes; lifted sync-service/lexical/ai-editing; OD-13)
- **ADR-009 Channels, notifications, realtime** (session-event union; delivery channels; OD-3 gate cleared — Ruled 2026-08-20: in-app + digests, push deferred)
- **ADR-010 Safe file, unfurl, image, external fetch** (R2 delivery; unfurl/image behavior)
- **ADR-011 SSRF controls on Workers** (the safe-fetch mechanism; the OD-6 proposal)
- **ADR-012 Self-hosted converter boundary** (the exception's container boundary; ffmpeg)
- **ADR-013 Migration and cutover** (dual-branch; OD-1 Ruled 2026-08-20: Branch A selected, Branch B dead; OD-14 moot)
- **ADR-014 Kernel-change and upstream-patch budget** (enforced from wave 0 per OD-10)

Two slots this document originally assumed have **no dedicated ADR** in the landed set:
the event-envelope/outbox/idempotency discipline is part of **ADR-005**, and the identity/auth
rebuild has no ADR of its own — the auth mount was deferral **B = OD-16** (Ruled 2026-08-20:
closed, kernel flow adopted directly), and its API boundary rides ADR-002. Where a domain section needs a cross-cutting rule it cites the ADR
rather than inventing one; inline assumptions remain marked **[ADR-ASSUMPTION]**.

### 0.4 Binding rulings honored throughout (all [F], cited once here)

1. **Q19 default (Ledger header):** every row not explicitly ruled or parked is KEEP — faithful recreation. Rows below whose verdict slot is empty are labelled "default-keep via Q19, verdict pending".
2. **Ruling 1a (Ledger §7, 2026-08-19):** adopt the `Entity=(type,id)` ontology, replace the encoding — entities in DOs/typed-storage, entity registry (existence + tombstones), **required** materialized-index layer, per-type access policy stays code. Rider: settle TEXT/UUID id format first (→ ADR-003).
3. **Ruling 2a (Ledger §7, 2026-08-19):** properties — adopt semantics, replace storage; values on the entity record; filter index first-class. Riders: entity-type canonicalization first (OD-7); property-write side effects get pattern-3 treatment.
4. **Rulings 3a + 4a (Ledger §7, 2026-08-19):** adopt the outbox/lease *disciplines*, not the tables — intent record + alarm inside the DO, idempotent consumers, poison-pill mark-and-skip; DO single-writer + alarms replace claim columns and polling dispatchers; keep external-mutation fencing + idempotency keys (→ ADR-005).
5. **Ruling C1 (Ledger, connection_gateway row, 2026-08-19):** connection_gateway is superseded by kernel `/api` session push; its event types become kernel session events; the free-form `message_type` string becomes a closed union.
6. **Rulings R3/L1/C2/A3 (route-reconciliation.md, 2026-08-19):** HTTP routes collapse to RPC except physical-protocol needs; lift set = sync-service, lexical-service, ai-editing-worker; inbound webhooks at `/hooks/<source>/*`.
7. **Q20 invariants (Ledger §6, 2026-08-19):** Soup/Block/Split/Entity/Team/Channel nouns; frozen `ai_toolset` semantics (as Gatekeeper session APIs); share-permission semantics with SEC-1/2/3 holes **fixed, not recreated**; Project = Folder; One Task Database.
8. **Ruling 8 (merge/README.md, 2026-08-19):** schemas over, data doesn't — premise now CONFIRMED (OD-1 Ruled 2026-08-20, see `reports/06-owner-decisions-needed.md` OD-1: Branch A selected, Branch B dead); the migration sections below were written conditional with both branches sketched — read only the no-live-data branch as live (§0.8 item 1).
9. **The four deliberate exceptions** (01-AUTHORITY): MCP server in pilot; ungoverned OpenAI proxy; seven-entity-type search; self-hosted converter — treated as controlled owner decisions (CON-2/OD-2); designed *around*, not cleaned up.
10. **Kernel surface freeze:** exactly **182** callable RPC surfaces at `bf7f762` (178 preserve, 4 needs-review) — WP-020 note. New domain capability is added **beside** the kernel surface per ADR-002, never by editing `api.ts` outside the ADR-014 budget.
11. **Command surface freeze:** 379 static commands + 4 runtime-generated markers across the scope tree in CMD-L; the rewrite's command registry (06-COMPAT target architecture) must reproduce scope semantics (leader scopes, shadowing, input-focus gates, `add` vs `override`).

### 0.5 Cross-cutting primitive doctrine (applies to every domain below)

**[R]** These defaults are derived from actual requirements, not AWS-name matching; each domain
section states only its deviations:

- **Durable Object** — only where a requirement needs a *single serialized writer* over one aggregate (ordering, invariant enforcement, alarm-driven lifecycle). Sharding key and hot-key bound stated per domain.
- **D1** — cross-aggregate relational read models (projections/indexes) and small authoritative relational sets **with exactly one owning writer** per ADR-005. Never an unowned write free-for-all.
- **R2** — bytes (immutable/sha-addressed where the old system was); metadata and authorization always live elsewhere (D1/DO).
- **KV** — read-mostly config/snapshots only; never an authority for conflicting writes.
- **Queues** — durable fan-out between authorities and consumers; every consumer idempotent (ruling 3a), poison = mark-and-skip with a dead-letter record, replay = re-drive from the outbox/intent records.
- **DO alarms** — replace *all* polling dispatchers and claim tables (ruling 4a). Cron triggers only for the two inherently periodic externals (Gmail watch re-arm; digest windows if not per-user alarms).
- **Workflows** — considered only where a multi-step orchestration outlives what an intent-record + alarm can express legibly; no domain below strictly requires one in the first pass **[I]**.
- **Outbox** — every state-changing domain write that must be observed elsewhere appends an intent/event record in the same DO transaction as the write, then an alarm drains it to Queues (ADR-005 envelope). Event ids are deterministic (entity id + version/sha) so consumers dedupe by id.
- **Idempotency** — client-supplied idempotency keys on mutating RPC where the old surface had them or where retry-on-reconnect is possible; DO-local dedupe window. **[ADR-ASSUMPTION]** envelope carries `{event_id (uuidv5 over entity+version), entity:{type,id}, tenant, actor, on_behalf_of?, occurred_at, schema_version}` — mirrors the activity log's proven idempotent shape (`crates/activity/src/domain/models.rs:40`).
- **Authorization** — every domain handler demands a typed receipt (`EntityAccessReceipt<View|Comment|Edit|Owner>` analogue) minted by the entity-access core (ADR-004); no handler reads ACL tables directly. Mirrors the kernel's own compile-time default-deny wrappers (`UseOverseerInterface`, overseer.ts:8767) **[F]**.

### 0.6 Coverage statement

All 18 domain families of `05-DOMAIN-REWRITE-MAP.md` have a section below — none is represented
by a product-name mapping alone; each carries authority, API, storage, authorization, async,
query, migration, parity, and rollback content (WP-030 acceptance). Depth is bounded by wave-1
evidence: domains whose audits exist (documents, CRM, mailbox, connectivity, chrome, standalone
services, Lambdas) are grounded in those audits; domains with ledger-row-only research (e.g.
calendar/calls internals, transcription sidecar) carry explicit "not re-derived here" notes.
No Neuwave source file was newly re-audited in this pass beyond spot-checks; where a number is
load-bearing it comes from the verified wave-1 set. Per-endpoint mappings for the ~200 old HTTP
routes are NOT reproduced here (they live in EB and collapse under R3); RPC mapping below is at
interface/namespace granularity against RPC-L. Domain-spec template files per domain
(`templates/domain-spec.md`) are *not* instantiated as separate files in this pass — this
document is the consolidated first-pass equivalent; splitting into per-domain files is mechanical
follow-up.

### 0.7 Recommended implementation waves (summary; the build graph itself is part B)

- **W1 — Spine:** identity/auth rebuild, entity registry + entity-access core, control-plane packages (receipts, envelope, idempotency), kernel-budget governance. (§1, §2)
- **W2 — Core entities:** documents + projects, static files, properties/tasks (after OD-7). (§5, §6, §16)
- **W3 — Query plane + shell:** materialized-index layer, Soup, custom shell + command registry, splits/routes. (§3, §4)
- **W4 — Comms:** channels/messages/bots, notifications (shape ruled 2026-08-20 per OD-3: in-app + digests, push deferred). (§7, §13)
- **W5 — External-system domains:** mailbox/email, calendar/calls, CRM. (§8, §9, §10)
- **W6 — Connectivity centerpiece:** agents/MCP/import/webhooks — **OD-4 Ruled 2026-08-20: P1 centerpiece confirmed with clarified governed-data-ingress intent; runs as the first track of wave 4a immediately post-slice per 05 §4** (CON-4 resolved; the "pulled to immediately after W1" conditional here is superseded — pre-slice start would violate the parallel-work rule). (§14, §15)
- **W7 — Long tail:** search, activity/frecency/favorites, unfurl/image-proxy, converter container. (§11, §12, §17)
- **Parked:** billing/onboarding/getting-started (owner-designed; primitives preserved). (§18)

### 0.8 Rulings applied 2026-08-20 (registry of record: `reports/06-owner-decisions-needed.md`)

After this document was written, the owner issued nine in-session rulings on
2026-08-20. Each is authoritative over any contrary text below; surgical
amendments are marked inline, and anything missed is read under this list:

1. **OD-1** — fresh start; **Branch A (N20a) selected, Branch B dead**; old
   Postgres schemas are design reference only. **Applies globally to every
   §-Migration block below**: wherever a section sketches both OD-1 branches,
   only the *no-live-data* branch is live; "data exists" text is record of the
   rejected alternative. ADR-013 is Accepted on Branch A.
2. **OD-3** — notifications kept: in-app (kernel session push) + email
   digests; mobile push deferred until a native client exists (§13; ADR-009
   branch selected; stale ledger "Drop" overruled).
3. **OD-4** — connectivity P1 centerpiece confirmed, intent clarified:
   connectivity IS the sandboxed agent's **governed data-ingress** capability
   (the Cloudflare sandboxed agent cannot currently ingest data from MCPs or
   external APIs); N10 runs as the first track of wave 4a, immediately
   post-slice (§14, §15; supersedes §0.7's W6 conditional phrasing).
4. **OD-5 (mode)** — batch ruling session chosen; the owner rules all 57
   unruled rows in batches; packet at `reports/notes/od5-batch-ruling-packet.md`.
5. **OD-7** — task stays a **document facet** (document + `sub_type='task'` +
   TASK property bundle), NOT a first-class entity type; thread = the already
   first-class **EmailThread**; the hybrid recommendation is superseded
   (audit: `reports/notes/od7-task-treatment-audit.md`; §2, §5, §6 amended).
6. **OD-10** — zero-kernel-patch budget bound from wave 0; exceptions need
   their own ADR + owner sign-off (ADR-014 Accepted).
7. **OD-11** — fully custom UI/UX: ALL screens rebuilt from scratch to 1:1
   Neuwave parity, including surfaces the stock kernel shell provides; stock
   kernel screens transitional only, same parity bar (ADR-001 Accepted with
   amendment; embed list reclassified transitional).
8. **OD-16** — kernel auth flow (`PublicApi`/`LoginAttempt`) adopted
   directly; standing deferral B closed; no legacy mounts (§1; ADR-002 note).
9. **OD-27** — projection topology ruled: **one D1 projection plane, two
   schema families, shared consumer framework** (§4, §11; ADR-006/ADR-007 may
   finalize).

---

## 1. Identity, account, teams

**Owner ruling [F]:** explicit — "Rebuild real auth Cloudflare-native (2026-08-19). FusionAuth
stays dead; Access is not the auth model" (Ledger, `authentication_service` row). Standing
deferral **B** (auth mount) is **closed — OD-16 Ruled 2026-08-20** (see
`reports/06-owner-decisions-needed.md` OD-16): the custom shell consumes the kernel's
`PublicApi`/`LoginAttempt` flow directly; no legacy mount paths (no dedicated auth ADR
landed — the auth API boundary rides ADR-002). Teams/membership ride the same
ruling (the ~79-endpoint auth service owns sessions, signup/login, OAuth, teams, invites,
permissions [F] EB).

**Source behavior evidence [F]:** Neuwave `9f7a26b` — `services/authentication_service` (~79
endpoints, EB; count approximate per gap review §5.2-4); team domain auto-join judgment shared
with onboarding (`crates/onboarding/src/domain/service.rs` `suggested_team_domain`); legacy
gate `User.tutorialComplete` via `PATCH /user/tutorial` (Ledger onboarding row); GitHub link
endpoints mounted here (`POST/DELETE /link/github`). Kernel side: `PublicApi` (8 methods),
`LoginAttempt` (1), session minting via `authenticate`, client-side argon2id keyed on
`SERVICE_SALT` (api.ts:30) — RPC-L rows 1–10.

**User journeys:** sign in (password or gatekeeper OAuth popup) → identical effective role;
signup + team invite acceptance; team creation with domain auto-join suggestion; admin changes a
member's role and the member's next authorization check reflects it; token restore on reload;
sign out everywhere.

**Invariants:** one canonical user per identity; a user's effective role in a team is a single
value computable at any time; invites are single-use; session tokens survive reload but are
revocable; admin policy (AdminApi) is reachable only by admins. SEC-1/2/3 class holes fixed,
not recreated (Q20).

**Entities and identifiers:** `user`, `team`, `membership(user,team,role)`, `invite`, `session`.
**[ADR-ASSUMPTION]** ids follow ADR-003's chosen format (1a rider); user/team are the two
principal-namespace roots; bots are a third principal kind (§15). `USER` and `TEAM` are already
canonical `EntityType` variants [F] (16-variant enum, `crates/model-entity/src/lib.rs:34`).

**Authoritative state owner / consistency / concurrent writers [R]:** the kernel already gives a
per-user single-writer authority — `UserDurableObject` (`packages/workshop-backend/src/user.ts`)
[F]. Keep it as the authority for user identity, credentials, sessions, and per-user settings
(requirement: serialized credential/session mutations; natural key = user id; hot-key risk nil).
Add a **Team DO** per team as the authority for membership/roles/invites — the requirement is a
serialized writer for role changes and invite consumption (two admins demoting each other
concurrently must serialize; an invite must be consumable exactly once). Cross-authority reads
(login → team roles) go through the D1 membership projection; strong read-your-writes is needed
only *within* one authority, which this split preserves.

**Cloudflare primitives with reasoning:** User DO (kernel-native, already the session owner —
reusing it avoids any kernel change); Team DO (new wrapper DO: invite-consumption and role-change
serialization is a single-aggregate ordering requirement, the DO's exact fit); D1
`memberships(user_id, team_id, role, …)` projection owned by the Team DO's outbox (requirement:
"list my teams" / "list team members" are cross-aggregate relational reads); KV only for
read-mostly server config already kernel-owned (`getServerConfig`). No Queues needed except the
outbox drain; no Workflows.

**Projection/index strategy:** D1 `memberships` + `invites_open` projections, single writer =
Team DO outbox consumer (ADR-005). Effective-role resolution = pure function over (membership
row, admin policy) in the entity-access core — never a second store.

**API/RPC surface [F→R]:** kernel already provides the session plane — RPC-L: `PublicApi.*`
(8 rows incl. `login`, `createAccount`, `authenticate`, `startGatekeeperLogin`,
`authenticateFromCfAccess` *needs-review*), `LoginAttempt.wait`, `AuthenticatedApi` account
subset (profile, password change, sessions), `AdminApi` (16 rows) — all `preserve`. New wrapper
capability `TeamsApi` (create/rename team, invites, membership, roles) added per ADR-002; the
old service's ~79 HTTP endpoints collapse into it under R3 except OAuth callbacks
(`/hooks/oauth/*` or gatekeeper-native) and deferral-B mounts. The 4 needs-review rows
(CF-Access auth; Cloudflare-limits trio) → **OD-301**.

**Command/UI surface [F]:** CMD-L: auth screens carry no hotkey rows (auth UI ruled keep,
Ledger §4); `settings.*` rows (12) include account/team tabs; `global.*` sign-out lives in the
command menu. Parity: settings tab digits 1–9 (Settings.tsx:198 expansion).

**Authorization model:** PublicApi = unauthenticated internet [F] (RPC-L). Everything else
demands a session capability; admin surface behind AdminApi capability minting. Team mutations
demand an Owner/Admin receipt on the team entity (ADR-004).

**Events/async:** Team DO outbox → `team.member_added/removed/role_changed/invite_*` (old bus
had `macro.teams` [F]); consumers: memberships projection, contacts graph (§10a), notifications.
Idempotent by event id; retries via queue redelivery; poison → dead-letter row + alert; replay =
re-drain from the Team DO's intent log.

**Outbox/idempotency:** invite creation carries a client idempotency key (double-click safe);
invite consumption is naturally idempotent (single-use flag in Team DO).

**Migration (conditional on OD-1):** *If ruling 8 confirmed (no live data):* adopt shapes only —
users/teams/membership table shapes from SH §identity; seed fixtures; the **password-hash
contract question disappears** (no credentials to carry). *If data exists:* FusionAuth grant
export + user/team/membership ETL with the canonical identity mapping (08 §2); the argon2id
`SERVICE_SALT` client-side scheme means imported password users must either re-register through
the same client scheme or be force-reset — a migration-plan dependency recorded in the WP-020
note [F]. Either way the ledger's FusionAuth-dead ruling stands.

**Parity tests:** the 05-MAP gate — existing (seeded) user signs in and resolves identical
effective role; plus: invite single-use; role change visible on next authz check; session revoke;
`contract:capability-lifecycle` tests for the auth rows (RPC-L test column).

**Observability/SLOs:** login success rate, p95 login latency, session-mint failures, invite
funnel; audit log for role changes (append-only, activity §12). SLO: authn p99 < 1s; role
propagation to projections < 5s **[R]**.

**Rollback:** wrapper `TeamsApi` behind a version flag; Team DO state is additive — rollback =
route reads back to the previous build; no kernel surface changed, so kernel rollback is
independent (ADR-014).

**Dependencies / wave:** none upstream; **W1**. Everything else depends on this + §2.

---

## 2. Entity ontology and access

**Owner ruling [F]:** ruled — **1a (2026-08-19)**: adopt ontology, replace encoding; entity
registry with tombstones; required materialized-index layer; per-type access policy stays code.
Share-permission semantics preserved with SEC-1/2/3 fixed (Q20). Rider: id format (TEXT/UUID)
settled first (ADR-003). Entity-type canonicalization rider = **OD-7 — Ruled 2026-08-20**
(see `reports/06-owner-decisions-needed.md` OD-7): task stays a document facet; thread =
EmailThread (already first-class); the canonical enum stays the 16 verified variants.

**Source behavior evidence [F]:** `crates/entity_access` — 62 files, 6,448 non-test / 13,519
test LOC (68% tests), 14 typed axum extractors (`EntityAccessReceipt<L>`), 13 per-entity-type
access-query modules (gap review §2.2, re-derived exact). `EntityType` = 16 variants
(`crates/model-entity/src/lib.rs:34`); polymorphic `(entity_type, entity_id)` glue on 10+ tables
with no FK (SH). SEC-1/2/3 specifics live only in Linear SUP-474 [F: unverifiable here]; the
crate's tests are the only executable spec.

**User journeys:** owner shares a document with a teammate at Comment level → teammate sees it
in lists, can comment, cannot edit; revoke → it disappears from access (and, per the SEC-fix
ruling, from stale read paths like favorites listing §12); channel membership grants
channel-entity access; agent acting `on_behalf_of` a user gets exactly that user's access.

**Invariants:** access level lattice View < Comment < Edit < Owner (+ role variants) [F:
extractor set]; **no handler executes a read/write without a minted receipt**; tombstoned
entities resolve nowhere except restore paths; per-type policy is code, never data (1a);
receipts are not forgeable across the RPC boundary (server-side only).

**Entities and identifiers:** the registry row itself: `(entity_type, entity_id, tenant,
created_at, tombstoned_at?)`. **[ADR-ASSUMPTION]** ADR-003 fixes: id format; `task`/`thread` do **not**
join the canonical enum (OD-7 Ruled 2026-08-20 — task = document facet, thread =
EmailThread; see `reports/06-owner-decisions-needed.md` OD-7); receipt as an in-process
typed value (TypeScript branded type), *not* a serialized token — it never crosses the wire,
matching the Rust extractors' compile-time-obligation character [F].

**Authoritative state owner / consistency / concurrent writers [R]:** split authority: (a)
**existence/tombstones** — the entity registry, a D1 table with a single logical writer: the
owning domain DO's create/delete path writes through a shared `registry` library that appends in
the same outbox transaction (requirement: registry must never disagree with the authority; making
it a projection of authoritative creates achieves that without a global registry DO becoming a
platform-wide hot key — a single DO serializing *every entity create in the system* is exactly
the hot-key failure 04-TARGET warns about **[I]**). (b) **ACL/share state** — owned by the
entity's own authority DO (per-type policy is code + per-entity share rows in the owning DO),
because share changes must serialize with the entity's lifecycle. (c) **access decisions** — a
pure library (`entity-access` package) that, given actor + entity + required level, consults the
owning DO's share state via its capability or the D1 access projection; consistency requirement
is read-your-writes for the sharer (satisfied: the mutation and the check both hit the authority)
and bounded staleness (<5s) for third-party list filtering via the projection.

**Cloudflare primitives with reasoning:** D1 for the registry (cross-aggregate existence lookup
joined by every list/projection — a relational read requirement, not an aggregate); owning DOs
for ACL state (serialized share mutations); no KV (ACLs are not read-mostly config — they must
never serve stale grants on the authority path); no separate "policy engine service" — policy is
code linked into each domain worker (1a).

**Projection/index strategy:** D1 `entity_access_index(actor → entity, level)` maintained from
share-change events — used **only** for list filtering/decoration (Soup, favorites hydration,
search result filtering); the authority path never reads it. This is the projection the SEC-fix
ruling turns from "gap" into "requirement": revocation events must propagate to it, and read
surfaces that skipped re-checks in the old system (favorites listing [F:
`crates/favorites/src/domain/service.rs:103-112`]) now filter through it.

**API/RPC surface:** no direct public RPC — receipts are internal. Share management is per-domain
RPC (`share`, `unshare`, `access_level` methods inside each domain namespace, mirroring the old
per-domain `/permissions` endpoints [F: EB]). Kernel provides nothing here (verified absence of a
cross-entity query/authz plane at `bf7f762`, gap review C3) — this is wrapper-new, per ADR-002.

**Command/UI surface [F]:** CMD-L `block.share` row + share-menu telemetry (`share_menu_open`);
`block-entity.*` rows (17) include access-dependent enable conditions; parity tests must assert
command *enablement* tracks receipt level (CMD-L conditions column).

**Authorization model:** this domain *is* the model. Matrix source of truth: the 13 query
modules + 14 extractors translated 1:1 into per-type policy functions; the 13.5k-LOC test corpus
is harvested into a table-driven fixture set (WP-020 recommendation (c)) — the first parity gate
of the whole program (05-MAP row 2).

**Events/async:** share-change events on the envelope (ADR-005) feed the access projection,
notifications (`document_mention`-class types need grant context), and Soup row decoration.
Idempotent by (entity, principal, version); revocation replay-safe (last-write-wins by version).

**Migration (conditional OD-1):** *No live data:* adopt the `SharePermission`/ACL shapes from SH
as fixtures; nothing to move. *Data exists:* permission principals are stage-2 canonical-mapping
items (08 §2); reconciliation = the user/entity matrix diffed old-vs-new (same fixture harness
as parity).

**Parity tests:** the 05-MAP proof verbatim — same user/entity matrix produces expected
view/comment/edit/owner results; plus SEC-1/2/3 regression tests written from the extracted
Linear semantics (blocked on WP-020 follow-up [F: B5]); revocation-propagation test (grant,
list, revoke, list again).

**Observability/SLOs:** authz decision latency (p99 < 10ms in-process against authority; < 30ms
via projection **[R]**); denied-decision audit counter by type; projection lag gauge; alert on
any handler path that bypasses receipt minting (lint + runtime assert).

**Rollback:** the core is a library + D1 tables; rollback = previous library version. Because
every domain compiles against the receipt types, breaking changes are compile-visible (the point
of the pattern). Registry rows are append/tombstone-only → no destructive rollback.

**Dependencies / wave:** §1 (principals). **W1**, before any list-shaped domain (gap-review
recommendation 6). Blocks: everything.

---

## 3. Workspaces, splits, routes

**Owner ruling [F]:** ruled — "Recreate faithfully as the new app's shell, on CF-OS's frontend
(2026-08-19). Supersedes the shell plan's Gatekeeper-App-vs-custom-shell question" (Ledger §4,
Split-layout engine row). ADR-001 still records the compatibility-cost estimate 04-TARGET asks
for, but the direction is ruled.

**Source behavior evidence [F]:** `apps/web/src/components/app/split-layout/`, `Root.tsx:223`
(27 top-level routes = 26 `path:` + `LAYOUT_ROUTE` `/*splits`); split registry 28 always + 19
LOCAL_ONLY + 5 DEV_MODE registrations (`componentRegistry.tsx`, 52 calls); the `/*splits` route
encodes alternating `{type}/{id}` pairs (Ledger §4 preamble); deep-link/native interplay:
deferral C3 (`/.well-known`), Tauri shell in-repo, no iOS/Android sources (gap review K6).

**User journeys:** open an entity into a new split; reorder/close splits; reload → identical
multi-pane layout; share the URL → recipient (with access) sees the same layout; back/forward
walks navigation history; mobile collapses to single-pane behavior; `cmd+.` sidebar toggle
(with its known full-cover-route quirk, CMD-L note).

**Invariants:** the URL is the layout — `/*splits` codec round-trips losslessly (05-MAP parity
proof); split state never desyncs from route; per-split hotkey scopes attach/detach with the
split (CMD-L scope tree); Soup/Block/Split nouns preserved (Q20).

**Entities and identifiers:** no server entities. Route-state codec tokens = `{type}/{id}` pairs
where `type` ∈ split registry names [F: EF §2] and `id` is an entity id → codec depends on
ADR-003's id format decision (a TEXT-vs-UUID change alters every deep link — stated dependency).

**Authoritative state owner / consistency:** the client owns live layout state; the URL is the
durable encoding. Per-user *persistent* UI state (last route, nav history, sidebar state) →
User DO per-user collections (kernel-native `user.ts:151-220` idiom [F]) — requirement is
per-user, small, read-on-boot; no concurrency beyond one user's own tabs (last-write-wins is
acceptable and is the old behavior **[I]**).

**Cloudflare primitives with reasoning:** none new server-side — this is the strongest
"custom shell over existing RPC" case: the kernel router serves the SPA assets [F: 04-TARGET],
and layout needs no server authority. Deliberately **not** a DO: there is no serialized-writer
requirement.

**Projection/index strategy:** n/a (reads ride other domains' projections).

**API/RPC surface [F]:** kernel rows used as-is: `AuthenticatedApi` boot/config subset,
`Overseer.openGadget`-family (RPC-L caller-surface column maps these to the old shell's
workspace-open paths), presence subscribers. The `TODO(multi-gadget)` rename set is frozen at
current names per WP-020 note (owner decision there). No new RPC namespace for the shell itself.

**Command/UI surface [F]:** the shell owns the command registry: CMD-L rows `split.*` (8),
`go-to` (15), `launcher` (27), `command-menu` (15), `create-menu` (13), `global.*` (23),
`theme.*` (40 incl. 3 runtime markers), `scope.*` (4 registrations), plus the scope-tree
semantics (leader re-parenting, jettison, interceptor, `add`/`override`, input-focus gate,
touch-disable, cmd→ctrl mapping) — all normative for the new registry (06-COMPAT). Brand
tripwires in theme names/localStorage keys → `adapt` rows (CMD-L note #2).

**Authorization model:** shell renders only what receipts allow; deep link to a forbidden
entity → the old join/request-access surfaces (`non-member-channel` split kept [F: Ledger §4]).

**Events/async:** none; realtime updates arrive via domain subscriptions (C1).

**Migration:** none (no data). C3 (`/.well-known`/app links) stays deferred — the codec design
must not foreclose it (keep route prefixes stable) **[R]**.

**Parity tests:** 05-MAP proof — reload and share a multi-surface route without losing layout
state; codec round-trip property tests over the 28 split types; hotkey-scope attach/detach tests
per CMD-L shadowing facts (soup `cmd+k` over global, canvas undo shadowing, `h` triple-booking).

**Observability/SLOs:** client-side route-decode failure telemetry; `split_created`,
`hotkey_use` events preserved [F: CMD-L telemetry]; TTI budget for a 3-split reload **[R]**.

**Rollback:** shell versions are asset deploys — instant rollback via wrapper deploy; codec is
versioned (`v` prefix or shape-sniff) so old links never break **[R]**.

**Dependencies / wave:** §1/§2 for boot+receipts; command registry blocks every domain's UI
rows. **W3** (with Soup), prototyped in the W-slice.

---

## 4. Soup / list engine

**Owner ruling [F]:** ruled — "Faithful UX on native data (2026-08-19)" (soup row);
`graphql_soup` **killed** (2026-08-19); SoupView "recreate faithfully; data via native RPC not
GraphQL" (Ledger §4). Substrate: ruling 1a's *required* materialized-index layer. The
soup+search one-substrate proposal is **unruled** (Ledger search row: "Rule with
search_processing_service — one system") → **OD-302**.

**Source behavior evidence [F]:** `crates/soup`, `crates/soup_realtime`, `crates/models_soup`,
`crates/item_filters` (filter AST incl. `foreign_entity_sources` literal); frontend
`features/next-soup` backing 10 splits [F: Ledger §4]; saved views in three tiers with backend-
opaque `config` JSON (DSS-native row); kernel has **no cross-entity query plane** (verified
absence, gap review C3).

**User journeys:** open Inbox/Tasks/Mail/Channels lists with tabs, grouping, filters, sort;
switch saved views; live row updates while the list is open; paginate a mixed-entity list;
per-row entity actions (soup-entity commands); `g g` per-soup goto; digit tab switching.

**Invariants:** one list engine for all entity types (the Soup noun, Q20); filter/order/
pagination semantics reproduced exactly (05-MAP proof); rows the actor cannot View never render
(§2 projection); saved-view `config` stays backend-opaque [F] — the engine interprets it
client-side; live updates never reorder already-rendered pages except per old behavior.

**Entities and identifiers:** Soup has **no entities of its own** — it renders registry entities.
Saved views: personal rows + team blob + base64url share links [F: DSS-native row] — personal →
User DO collection; team → Team-scope storage (§1); share links stay stateless encodings.

**Authoritative state owner / consistency / concurrent writers:** Soup owns no authoritative
state. The **materialized-index layer** is authoritatively *derived*: one D1 index family
(`soup_index` + per-type filter columns + `entity_access_index` join) with exactly one writer —
the projection consumer service fed by every domain's outbox (ADR-005/ADR-006). Consistency
requirement from source behavior: bounded staleness with live patch-up — the old system rendered
from Postgres read models updated by consumers, then pushed row updates over the gateway **[I
from soup_realtime + C1 enumeration]**; target: projection lag SLO + session-event row patches.

**Cloudflare primitives with reasoning:** **D1** for the index — the requirement is
cross-aggregate relational reads (filter, group, order, paginate over mixed entity types), which
is exactly the "cross-aggregate relational/query surface" slot; fanning out to dozens of
authoritative DOs per render is explicitly prohibited (04-TARGET §query plane) and would
reintroduce the hot-key problem. **Not** a DO (no serialized-writer requirement on reads);
**not** KV (filters need SQL, not point reads). Subscription model: kernel session events (C1)
carrying row-patch events keyed by (list query hash → entity id) **[R]**; the free-form
`message_type` becomes the closed union per C1.

**Projection/index strategy:** per ADR-006: one `soup_index` table (registry join: type, id,
tenant, timestamps, tombstone), plus per-type projection tables for type-specific
filter/sort columns, plus property-value index (§6) and access index (§2). Checkpointed
consumers (ADR-005); full rebuild = replay domain outboxes/scans (08 §4) — rebuildability is a
release gate.

**API/RPC surface:** new `SoupApi` namespace (ADR-002): `query(viewConfig, cursor)`,
`subscribe(viewConfig)` (returns subscriber stub; dispose = unsubscribe, matching kernel
subscriber discipline [F: WP-020 note §missed-4]), saved-view CRUD. Kernel provides the session
transport only. graphql_soup's wire shapes are dead [F]; the *semantics* ledger for filters is
`crates/item_filters` AST — harvest it as the filter-contract fixture set **[R]**.

**Command/UI surface [F]:** CMD-L: `soup.*` 28 rows (incl. `cmd+k` shadowing, `cmd+f` stacking,
digit tabs ×9, filters/sort/search/ask-ai), `soup-entity.*` 22 rows (per-row actions),
`soup-nav.*` 8, `home` 1, plus `block-entity.*` interplay. Shadowing/priority facts (CMD-L
notable-facts list) are normative.

**Authorization model:** every query filtered through the access index; receipts checked at
row-action time by the owning domain (defense in depth — the index is advisory, the action is
authoritative).

**Events/async:** consumes every domain's events; emits none. Consumer idempotency by event id;
poison rows → dead-letter + skip (one bad row must not stall a partition); replay = rebuild from
checkpoints; ordering per entity via per-entity queue key **[R]**.

**Migration (conditional OD-1):** projections are *never migrated* — rebuilt (08 §4). Saved
views: *no live data* → shape adoption only; *data exists* → personal/team view configs copied
opaquely (they are opaque JSON; copy is safe by construction [F]).

**Parity tests:** 05-MAP proof — one mixed list reproduces filters, ordering, pagination, and
update behavior; golden filter fixtures from item_filters AST; projection-rebuild determinism
test (rebuild twice → identical index); staleness budget test.

**Observability/SLOs:** projection lag (p99 < 5s **[R]**), query p95, subscription fan-out
delivery latency, rebuild duration; per-consumer poison counters.

**Rollback:** projections are disposable — rollback = rebuild from events at the previous
consumer version; RPC namespace versioned; shell can pin the previous SoupApi minor.

**Dependencies / wave:** §2 (registry+access), §5/§6/§7 events for content. **W3**; the index
layer's *schema* is W1-adjacent design (parallel-work rule: projection ownership must freeze
early, 10-DELIVERY §parallel).

---

## 5. Documents and projects (folders)

**Owner ruling:** default-keep via Q19, **verdict pending** — the documents row is the ledger's
largest and its G1/G2/G3 split needs David (OD-5/wp000 §C5). Bound rulings that shape it [F]:
sync-service **Lift (2026-08-19)**; Project=Folder preserved (Q20); One Task Database (Q20);
1a/2a/3a/4a. Converter exception (§17) supplies `ConvertedPdf`.

**Source behavior evidence [F]:** `crates/documents` 18,653 LOC / 76 files; 25 endpoints (22 hex
±1 + 3 DSS-native, gap review J17); 5 creation flavors; 15 tables incl. `DocumentInstance`
(sha-keyed versions), `DocumentFamily` + `branchedFrom*`, `DocumentBom`/`BomPart`,
`DocumentText*`; 8 events on `macro.documents`; content in one of **5 locations**
(`object_storage`, `sync_service`, `docx_bom_parts`, `converted_pdf`, `unknown`)
(`crates/documents/src/domain/content.rs:26-38`); 413 FileType variants → 18 viewer
associations; DSS double-mount at root and `/dss` (`api/mod.rs:289-291`) has **no successor**
under R3 [F: Ledger row]. Projects: `crates/projects` 9,809 LOC / 45 files; self-referential
`Project.parentId`; 11 endpoints incl. soft-delete/restore/purge; async resumable folder upload
(`uploadPending`/`uploadRequestId` + extractor Lambda pair + `UploadFolderStatusUpdate` pushes);
6 events on `macro.projects`. Ingestion Lambda family (5 handlers) is the same
pending→ready machine [F: Lambda audit §B].

**User journeys:** create/edit/version a document (each flavor); branch and duplicate; move
between folders; soft-delete → restore → purge; upload a folder archive and watch resumable
progress; open any of 18 viewer associations; comment/annotate (annotations move with this
domain per DSS-native split guidance [F]); task flavor journeys live in §6.

**Invariants:** versions are immutable and sha-keyed; content-location indirection preserved —
the domain does **not** own live-collab bytes (sync-service does) [F]; Project=Folder (the tree
is the folder model); deletion is three-state (live → tombstoned → purged) with registry
tombstones (1a); `content_uploaded` only fires after bytes are durably present; branch lineage
(`branchedFrom*`) never dangles.

**Entities and identifiers:** `document` (with facet/subtype machinery — task/md/snippet/skill
flavors; **task is a facet, Ruled 2026-08-20 per OD-7**), `project` (folder), `document_instance`
(version, sha), `annotation`, `thread/comment` (thread = EmailThread per the same OD-7 ruling;
comment stays a sub-record), `upload_job`. Registry rows
for document/project; instances are sub-records of the document aggregate.

**Authoritative state owner / consistency / concurrent writers [R]:** **one DO per document** —
requirement: serialized writes over version creation, branch bookkeeping, content-location
transitions, share state, and the pending→ready machine; the aggregate is small and naturally
sharded by document id (hot-key bound: a single document's write rate — human-scale; the
sync-service carries the high-frequency keystroke load, not this DO [F]). **One DO per
project** for the folder aggregate + upload job (requirement: `revert_delete`/`permanent`
lifecycle and the resumable upload job need a serialized owner; ruling 4a turns the Lambda
trigger/handler pair into this DO + alarm [F: Ledger projects row]). Tree *reads* (folder
listing) come from the D1 parent-edge index, not DO fan-out. Concurrent editors of content are
the sync-service's CRDT problem (lifted, ADR-008); concurrent metadata writers serialize in the
document DO.

**Cloudflare primitives with reasoning:** DO per document/project (serialized aggregate writes —
see above); **R2** for `object_storage` content, sha-addressed (immutable blobs; metadata and
authorization stay in the DO/D1 per 04-TARGET caution); lifted **sync-service** (its own DO+D1,
already Cloudflare [F]) as the authoritative backend for `sync_service` content — integration
per ADR-008 with routes reconciled per the lift ruling; **Queues** for ingestion
(R2 event notification → queue → document DO `mark_uploaded`), replacing the S3-event Lambda hop
[F: Lambda audit §B] — requirement is durable async with retry, not orchestration; **D1**
projections for lists (folder children, document lists, text-extract index feed). Converter
(§17) is invoked queue-wise for docx→pdf; `docx_bom_parts` machinery ports only if DOCX
rendering survives OD-8.

**Projection/index strategy:** `documents_index` (Soup columns), `folder_edges(parent,child)`
(hot folder-listing read [F: Ledger projects row]), `document_text` feed to search (§11).
Writers: the two DOs' outbox consumers only (ADR-005).

**API/RPC surface:** new `DocumentsApi`/`ProjectsApi` namespaces under R3 collapsing the 25+11
endpoints; the DSS double-mount dies [F]. Upload: presigned R2 PUT minted by RPC (files
pattern §16); folder-upload progress becomes **C1 session events** replacing
`UploadFolderStatusUpdate` gateway pushes [F: Ledger projects row maps this explicitly].
Kernel rows used: `exportPdf` streaming row exists kernel-side (RPC-L `contract:streaming`) —
adapter decision recorded in ADR-002 **[ADR-ASSUMPTION]**. 5 agent tools ride Gatekeeper
session APIs (frozen ai_toolset, Q20).

**Command/UI surface [F]:** CMD-L: `md.*` 32 rows (+ markdown loop expansions 8+15),
`canvas.*` 32, `code.*` 2, `block-entity.*` 17, `launcher` create flavors, `create-menu` 13,
`thread.*` 9 (comments), `block.share`; quirks flagged in CMD-L note #4 (copy-branch-name
re-registration leak; canvas `cmd+v` display-only) are fix-not-recreate candidates → keep CMD-L
dispositions.

**Authorization model:** per-type policy code (document/project modules of §2; extractors
`document`, `project`, `entity_body`, `history`, `pin`, `thread` [F: B2]); folder access
inheritance semantics harvested from `project_access` query module; annotations/comments demand
Comment level.

**Events/async:** 8 document + 6 project events → outbox per 3a; `document.interaction` is
presence → C1 session events, **not** the durable outbox [F: Ledger row]. Ingestion consumers
idempotent on (document id, sha); text-extraction consumer (old `document_text_extractor`
Lambda) becomes a queue consumer feeding search; retries via queue; poison = mark-and-skip with
the document flagged `extract_failed` (deterministic failure reporting mirrors §17); replay =
re-drive by sha (safe by idempotency).

**Migration (conditional OD-1):** *No live data:* adopt the 15-table shapes as DO/typed-storage
+ D1 schemas; seed fixture documents per flavor; S3 objects nonexistent → nothing to copy. *Data
exists:* sha-addressed S3 → R2 copy is resumable/idempotent by key; instances/families ETL with
id mapping (08 §2); sync-service content migrates within the lifted service's own store
(coordinate under ADR-008); `converted_pdf` artifacts regenerable → do not migrate, regenerate
**[R]**.

**Parity tests:** 05-MAP proof — create/edit/version/move/restore one document and see lists
update; branch/duplicate lineage fixtures; pending→ready state-machine tests (upload interrupted
→ resumable); 18 viewer-association goldens; folder-upload progress event sequence.

**Observability/SLOs:** upload finalize p95; version-write p95; ingestion queue depth/age;
extract-failure rate; projection lag. SLO: content available (`content_uploaded` observed)
< 10s after R2 PUT completes **[R]**.

**Rollback:** DO state additive + event-versioned; projections rebuildable; R2 immutable — a bad
deploy cannot corrupt priors; rollback = previous worker + projection rebuild. Purge paths
feature-flagged last **[R]**.

**Dependencies / wave:** §1, §2, files (§16, same content-state machine), sync-service lift
(ADR-008), converter (§17, only for docx). **W2** — first real entity domain; pairs with the
vertical slice.

---

## 6. Tasks and properties

**Owner ruling [F]:** ruled — **2a (2026-08-19)**: semantics kept exactly; values on the entity
record (single-writer DO); materialized filter-index first-class. Riders binding: entity-type
canonicalization **first** (= OD-7 — **Ruled 2026-08-20**: task stays a document facet, thread =
EmailThread; see `reports/06-owner-decisions-needed.md` OD-7 and
`reports/notes/od7-task-treatment-audit.md`) and pattern-3 treatment for property-write side
effects. One Task Database preserved (Q20). Task subtype reality [F]: task is an md-block alias
/ document flavor; `TASK`/`THREAD` exist in `property_entity_type` (10 values) but not
`EntityType` (16) — the dual-namespace bug 2a's rider names.

**Source behavior evidence [F]:** `crates/properties` — 20,911 LOC / 53 files, the largest
domain crate; 19 endpoints in 4 groups (`/definitions`, `/tags` incl. promote/merge,
`/entities/...` values, `/entity_properties`); **bulk is pervasive — 4 of 19 endpoints are bulk
paths, a load-bearing shape for grid/kanban** (Ledger row, verbatim requirement); 3 tables +
`property_data_type` (9) + `property_entity_type` (10); 9 agent tools; own activity/events
side-effect pipeline publishing `macro.properties`; 18 system keys incl. task Status/Assignees
(Ledger §7). Task coupling: `github_pr_tasks`, branch-name endpoints (documents audit §A1/D2).

**User journeys:** define a custom property (typed, with options); tag entities; promote/merge
tags; set status/owner/delegate/due on tasks; **bulk-edit a grid column across N selected
rows**; drag a kanban card between status columns (a property write + index update + event);
filter a Soup list by property values.

**Invariants:** property *semantics* identical to source (definitions/options/tagged-values/
system-key behavior — 2a verbatim); a bulk edit is atomic per entity and reported per-item, not
all-or-nothing across entities **[I from bulk endpoint shapes]**; system properties
(Status/Assignees etc.) are not deletable; tag merge preserves references; One Task Database —
tasks are not forked into a second store.

**Entities and identifiers:** `property_definition` (team-scoped), `property_option`, `tag`
(a definition flavor), property *values* — **not entities**: fields on the owning entity record
(2a). Task identity: **Ruled 2026-08-20 (OD-7, following Macro's own treatment — see
`reports/notes/od7-task-treatment-audit.md`): branch (b)** — task stays a **document facet**
(document + `sub_type='task'` marker + TASK property bundle; access receipts minted as
Document) and the property system carries a facet dimension as in the source; branch (a)
(first-class task entity type) is superseded, as is the earlier hybrid recommendation. The
*filter index* schema uses the **facet column**, not a type value — the W2-freeze deliverable
this rider gated is now unblocked.

**Authoritative state owner / consistency / concurrent writers [R]:** definitions/options/tags —
**Team-scope authority** (Team DO or a per-team `PropertySchema` DO): requirement is serialized
schema mutations (tag merge/promote are multi-row rewrites that must not interleave). Values —
written **only through the owning entity's DO** (2a: single-writer DO), so a kanban drag and a
concurrent grid edit on the same entity serialize there; cross-entity bulk = fan-out of per-entity
serialized writes with a client-visible per-item result envelope (preserving the bulk *shape* on
the wire per the Ledger's warning that an RPC loop is not faithful).

**Cloudflare primitives with reasoning:** DOs as above (serialization requirements); **D1**
property-value filter index — this *is* the "kernel's one genuine storage gap" (gap review C3)
and the 2a "first-class design task": schema `entity_property_index(tenant, property_id,
entity_type, entity_id, value_typed_columns…)` written solely by the projection consumer.
**Not** EAV-in-DO-storage for queries (typed-storage collections are per-DO [F] — cross-entity
filtering cannot ride them); **not** KV (needs range/equality predicates).

**Projection/index strategy:** value index above + tag-usage counts; kanban lanes read the index
grouped by status option; Soup property filters compile onto it (§4). Rebuildable from entity
outboxes.

**API/RPC surface:** new `PropertiesApi` preserving the four endpoint groups **and the bulk
shapes** as first-class RPC methods (`bulkSetValues`, `bulkSetOptions`) [F: Ledger requirement].
9 agent tools → Gatekeeper session APIs (frozen ai_toolset). No kernel coverage (RPC-L has no
property plane — wrapper-new per ADR-002).

**Command/UI surface [F]:** CMD-L: `property-editor` row, CRM company property commands (3,
`use-entity-action-hotkeys.ts:681` expansion), task-flavor rows within `md.*`/`launcher`
(task compose), `soup.*` filter/sort rows, kanban interactions (pointer-driven; parity via UI
tests rather than hotkeys).

**Authorization model:** definition/tag mutations need team-level Edit (admin-ish) receipts;
value writes need Edit on the target entity (receipt minted per entity in bulk loops — the
per-item result envelope carries per-item authz failures).

**Events/async:** property writes fan out (activity, `macro.properties` consumers, index) —
**pattern-3 mandated by the 2a rider [F]**: intent record in the owning DO + alarm + idempotent
consumers; event id = (entity, property, version). Retries/poison/replay per ADR-005. Bulk ops
emit per-entity events (not one mega-event) so consumers stay idempotent per entity **[R]**.

**Migration (conditional OD-1):** *No live data:* adopt the 3-table shapes + system-key seed set
(18 keys) as fixtures. *Data exists:* definitions/options/tags ETL first (schema), then values
folded into entity records during each entity's own migration pass (stage-3 job per 08),
reconciliation = value-count and per-property distribution diffs; the old EAV rows become the
source cursor.

**Parity tests:** 05-MAP proof — bulk edit grid and kanban transition remain consistent; golden
fixtures: type-system round-trips for all 9 data types; tag merge/promote reference integrity;
per-item bulk failure reporting; filter-index equivalence vs semantics fixtures.

**Observability/SLOs:** bulk-op p95 by batch size; index lag (kanban drag → lane query reflects
< 2s **[R]**); side-effect pipeline depth; per-consumer poison counters.

**Rollback:** index rebuildable; definition mutations event-sourced in the schema DO → restore
by replay; value writes live in entity DOs (rollback rides §5's model).

**Dependencies / wave:** OD-7 block **resolved (Ruled 2026-08-20: facet-dimension index
schema)**; §2, §5. **W2**.

---

## 7. Channels and messages

**Owner ruling [F]:** ruled — "Keep full — faithful recreation incl. messaging surface
(2026-08-19)" (channels row); channel/channel-compose/non-member-channel splits and `channel`
block keep (Ledger §4/§5); comms table shapes adopt (Ledger §7). Bots row is default-keep via
Q19, verdict pending (rule with auth per its research); the two already-CF channel-bot workers
need a disposition row (G-019).

**Source behavior evidence [F]:** `crates/channels` + 7 `comms_*` tables (SH); `crates/bots`
6,575 LOC + `crates/channel_bots` 1,123; 14 bot endpoints; bot token `mbot_<12-hex>_<64-hex>`
(tokens.rs:5-15); `owned` XOR ownership CHECK; unauthenticated `POST /channels/{id}/webhook`
poster; system bot = Macro AI thinking→edit loop; 11 channel events on the webhook-subscribable
catalog [F: webhook row]; `channel_mention`/reply/send notification types [F: §13];
`x-macro-bot-token` contract's only working reference = the two CF bot workers (standalone
audit §G). Realtime rides C1 (gateway superseded).

**User journeys:** the 05-MAP proof journey — two users and one agent exchange ordered messages
and reconnect safely; create channel/DM; threads; mention a user (→ notification) or a bot
(→ agent session posts "thinking", edits with answer [F]); join a non-member channel via prompt;
external system posts via bot webhook.

**Invariants:** per-channel total message order; mention→trigger exactly once per message;
reconnect resumes without loss or duplication (subscriber replay-then-`ready()` discipline,
kernel-native [F: WP-020 test obligations]); membership gates visibility (channel access-query
modules: membership/role/users [F: B3]); bot ownership XOR invariant preserved.

**Entities and identifiers:** `channel` (incl. DM as channel flavor), `message`, `thread`,
`bot` (principal kind), `bot_token`. Channel/message ids per ADR-003; `CHANNEL`/`CHAT` are
canonical EntityType variants [F].

**Authoritative state owner / consistency / concurrent writers [R]:** **one DO per channel** —
the requirement is the definition of a DO: a totally-ordered append log with serialized
membership changes and fan-out triggers. Message append assigns the sequence number; membership
and role changes serialize in the same DO so "posted after being removed" is impossible.
Hot-key bound: one channel's message rate (human + bot scale); very large broadcast channels are
read-scaled via projections/subscription fan-out, not by sharding the writer **[R]**. Bot
identity/tokens: authority in §1's principal model (bot = third principal kind, token hashing
preserved) — its serialized writer is the owning user/team authority.

**Cloudflare primitives with reasoning:** Channel DO (ordering requirement above) with
hibernatable-WebSocket-era concerns delegated to the kernel session (C1: no dedicated `/ws`
service [F: ruling]); message history pages in the DO's storage with D1 projection for
cross-channel surfaces (channel list, unread feed rows in Soup); Queues for mention/notification
fan-out (durable, decoupled from the append path); R2 nothing (attachments ride §16).
External bot webhook ingress = `/hooks/channels/*` HTTP (C2 — physical-protocol exception,
token-authenticated with the preserved `mbot_` scheme).

**Projection/index strategy:** `channels_index` (Soup: last-activity, membership-filtered),
`channel_members` D1 (cross-channel queries; contacts-graph feed §10a). Writer: channel DO
outbox consumer.

**API/RPC surface:** new `ChannelsApi` (CRUD, membership, post/edit/react, thread ops,
subscribe → subscriber stub with replay/`ready()`/dispose semantics copied from kernel
subscriber contract rows [F: RPC-L `parity:subscription-replay`]); `BotsApi` (CRUD, tokens,
scoped add). Kernel rows used: session/subscription transport; `Overseer` agent rows for the
Macro-AI bot loop (§14). The 11 channel events feed §15's subscribable catalog [F].

**Command/UI surface [F]:** CMD-L: `channel.*` 16 rows (incl. find-in-channel two-scope loop),
`thread.*` 9, channel-input/reply-input/message-editor inner scopes, `launcher` message/channel
creates, `chat.*` 3 (block-chat Enter/Ctrl+C via `registerScopeSignalHotkey` [F: CMD-L gap
fix]).

**Authorization model:** membership/role modules from §2 (channel_membership, channel_role,
channel_users [F: B3]); bot-token auth maps to a bot principal with channel-scoped receipts;
the unauthenticated webhook poster is gated by token + channel binding only (preserve exactly;
document as an auth exception alongside the deferral-B/OD-16 resolution — no dedicated auth
ADR landed) **[R]**.

**Events/async:** message/membership events → outbox → notifications (§13), Soup, webhook
catalog (§15), search (§11). Mention triggers idempotent per (message id, bot id). Retries per
ADR-005; poison messages (malformed bot payloads) dead-lettered with the channel unaffected;
replay safe by message sequence + event id.

**Migration (conditional OD-1):** *No live data:* adopt `comms_*` shapes (7 tables) as DO/D1
schemas; seed channels. *Data exists:* per-channel export ordered by old sequence → DO append
replay (idempotent by (channel, old_seq)); reconciliation = per-channel count + last-message
hash; tenant-by-tenant cutover fits channels naturally (08 §5).

**Parity tests:** 05-MAP proof verbatim (two users + agent, ordered, reconnect); replay-then-
ready subscription tests; mention-exactly-once; bot token auth (format + revocation + last_used);
thinking→edit bot flow; non-member join prompt.

**Observability/SLOs:** append p95 (< 150ms **[R]**), delivery fan-out p95, reconnect resume
success rate, mention-trigger lag, dead-letter counts; per-channel depth gauges.

**Rollback:** channel DO log append-only; projections rebuildable; bot webhook ingress
feature-flagged per token; rollback = previous worker (log format versioned).

**Dependencies / wave:** §1/§2; §13 for "mention someone and they find out"; §14 for the AI bot.
**W4**.

---

## 8. Company mailbox and email

**Owner ruling [F]:** ruled — "Keep, IN the pilot — full faithful recreation incl. send
(2026-08-19)" (email_service row; the old "Drop — Instantly instead" framing explicitly
corrected). Email table shapes adopt (Ledger §7). GCP Pub/Sub stays a hard dependency [F].

**Source behavior evidence [F]:** `services/email_service`; **23 live `email_*` tables**
(mechanically corrected count, gap review I3 — audit said 24, ledger §7 says 26; both stale);
Gmail push sync watch→GCP Pub/Sub→webhook; `email_refresh_handler` Lambda `rate(1 hour)` re-arms
expiring `users.watch` — **push sync silently dies without it** [F: Lambda audit]; two-phase
Gmail-API send with undo, **no SMTP anywhere** (re-verified grep, J12); Redis backfill counters;
delegation + shared-inbox promotion; `email_scheduled_handler` 1-minute poll (scheduled send);
SES bounce/complaint suppression via `email_suppression_handler`; inline remote images ride the
image proxy [F: §17-adjacent]; `refresh_email` cache-invalidation poke over the gateway [F: C1
enumeration]. Full audit: `audits/company-mailbox-audit.md`.

**User journeys:** connect a Gmail account (OAuth) → backfill then live push sync; read a
thread; compose/reply/send with undo window; schedule a send; shared-inbox promotion and
delegation; unsubscribe/suppression honored; attachment upload/download; email rows appear in
Soup/Mail split and CRM activity (§10).

**Invariants:** send is two-phase — a send is cancelable until the undo window closes, then
exactly-once handed to Gmail (external-mutation fencing per ruling 4a [F: pattern ruling]);
sync is resumable from checkpoints (05-MAP proof); a thread's message set converges with the
provider (reconciliation, not lock); suppression list always consulted before send; delegation
never widens access beyond granted mailboxes (SEC-fix bar applies).

**Entities and identifiers:** `email_account` (connection), `mailbox`, `thread`, `message`,
`attachment` (→ §16 files), `suppression_entry`, `scheduled_send`, sync `checkpoint`.
`EMAIL` is a searchable/canonical type [F]. Provider ids (Gmail message/thread ids) kept as
foreign keys — identity mapping is provider-id-first **[R]**.

**Authoritative state owner / consistency / concurrent writers [R]:** **one DO per connected
email account** — requirement: sync is a per-account serialized cursor (history id checkpoints;
concurrent webhook bursts and backfill jobs must not interleave per account), and send/undo is a
per-account fenced state machine. This DO owns checkpoints, the undo queue (alarm per pending
send — replaces the 1-minute `email_scheduled_handler` poll per ruling 4a [F]), and watch
re-arm bookkeeping. Thread/message *storage* is D1 (relational: thread listing, per-mailbox
filters, CRM joins over `email_links` [F: CRM audit]) written only by the account DO's
consumers. Shared inboxes: same account DO, multiple grantee principals (delegation is authz,
not a second writer).

**Cloudflare primitives with reasoning:** account DO (above); **Queues** between the Pub/Sub
ingress and per-account processing (durable burst absorption; ordering key = account id);
**D1** for threads/messages (Soup/CRM need SQL, and messages are write-once — no serialized-
writer need beyond the consumer); **R2** for raw MIME/attachment bytes (large immutable blobs)
with metadata in D1/§16; **Cron trigger** for the fleet-wide watch re-arm sweep — the one
inherently periodic job [F: Ledger Lambda row says exactly this] — implemented as cron →
enumerate accounts due → poke account DOs (per-account alarm also acceptable; cron chosen
because expiry is provider-driven and fleet-scannable **[R]**); Pub/Sub push ingress =
`/hooks/gmail/*` HTTP route (C2 physical-protocol exception). Google OAuth via a
mail Gatekeeper (kernel connected-accounts surface, RPC-L `subscribeConnectedAccounts` rows).

**Projection/index strategy:** `mail_index` (Soup Mail split columns), `email_links` equivalent
feeding CRM company/contact association (the CRM's populate/depopulate driver [F: crm audit]),
search feed (§11, `email` consumer). Writers: account-DO consumers only.

**API/RPC surface:** new `MailApi` (accounts, threads list/read, compose/send/undo, schedule,
delegation, suppression admin) under R3; `/hooks/gmail/*` ingress; approved-write audit trail
per the 05-MAP parity gate ("execute an approved write with audit trail") ties into §14's
approval queue for agent-initiated sends **[R]**. Kernel coverage: connected-accounts
subscription rows (3) + gatekeeper session minting (`GatekeeperClient.openSession` — per-vendor
contract explicitly outside the 182-row freeze [F: WP-020 note]).

**Command/UI surface [F]:** CMD-L: `email.*` 25 rows (incl. `registerScopeSignalHotkey` pair
Enter/Escape [F], compose `arrowup` shadowing, `email.send` raw-string token quirk), launcher
email create + shift-variant, `mail` split rows in `soup.*`. Dormant `opt+r` reply-all row =
needs-owner-ruling (CMD-L note #1, already queued).

**Authorization model:** mailbox-scoped receipts (delegation = explicit grant rows in the
account DO); email entities respect the email access-query semantics harvested into §2;
suppression admin = team admin.

**Events/async:** ingress: Pub/Sub webhook → queue → account DO → D1 + events
(`email.received` etc. on the old `macro.email` topic [F]) → Soup/CRM/notifications/search.
Egress: send intents in the account DO with undo alarm → Gmail API call with idempotency fencing
(record the provider message id before acking — crash-safe resume re-checks provider state per
ruling 4a's external-mutation fencing). Bounce/complaint: SES-equivalent → suppression consumer
(provider webhooks via `/hooks/*`). Retries: queue-native + per-send bounded retry with the
undo/fencing state machine; poison sync payloads dead-lettered per account without stalling the
cursor; replay: re-pull from Gmail history API from last checkpoint (the provider is the
source of truth — reconciliation is a re-sync, uniquely cheap in this domain).

**Migration (conditional OD-1):** *No live data:* adopt the 23-table shapes (correct the 26/24
counts at source per gap-review rec 1); seed with a test account. *Data exists:* prefer
**re-sync over ETL** — reconnect accounts and rebuild from provider history (the provider holds
the truth); ETL only for Macro-authored metadata (labels/links/scheduled sends). Undo-window
state never migrates (drain before cutover).

**Parity tests:** 05-MAP proof — read/sync one thread and execute an approved write with audit
trail; watch-expiry re-arm test (clock-advanced); send-undo window semantics; scheduled send
fires once across restart; suppression enforcement; delegation matrix; backfill-resume test.

**Observability/SLOs:** sync lag per account (push → visible < 30s p95 **[R]**); watch re-arm
success (alert on any account < N hours from expiry un-re-armed — the silent-death mode [F]);
send success/undo rates; queue depth; suppression hit counts.

**Rollback:** account DO checkpoints allow re-entry at any point (provider replay); D1
projections rebuildable from provider; sends are the only irreversible external effect —
feature-flag send separately from sync (read-only cutover first, per 08 §5) **[R]**.

**Dependencies / wave:** §1/§2, §16 (attachments), §14 (approval queue for agent writes), §10
(CRM consumes links). **W5** (pilot-critical; pairs with CRM).

---

## 9. Calendar and calls

**Owner ruling [F]:** ruled — calendar_events/cal **Keep (2026-08-19)**; call **Keep
(2026-08-19)** with LiveKit staying external; transcription **Keep with calls (2026-08-19)**;
calendar/reminders/calls/activity splits keep; call block keep; call/calendar table shapes
adopt (Ledger §7). Reminders ruled keep → folded here operationally but owned by DO alarms /
kernel scheduler per its row [F].

**Source behavior evidence [F]:** `crates/calendar_events`, `crates/cal` (sync coupled to email
accounts [F: ledger row]); `crates/call` (LiveKit); transcription sidecar (path noted "verify
path" in ledger — **not re-derived this pass**, honest gap); `CALL_RECORD` and `CALENDAR_EVENT`
are late-added property entity types (migrations `20260709192942`, `20260726023229` [F]);
`call_started` notification type; `refresh_calendar` gateway poke [F: C1 enumeration];
`call_recording_preview_handler` is the ffmpeg Lambda (OD-8) [F]; calls/email are 2 of the 7
searchable types [F: E1]. 1-minute reminder dispatch queue poll at
`infra/stacks/cloud-storage-service/reminder-dispatch-queue.ts:60` [F: Lambda audit].

**User journeys:** the 05-MAP proof — one event/call opens from Soup and obeys access rules;
connect calendar (same provider account as mail) → events sync; create/edit an event; join a
call (LiveKit), get `call_started` notification; call record + transcript + preview appear as an
entity afterward; set a reminder → it fires once at the right time in the right timezone.

**Invariants:** provider remains authoritative for provider-sourced events (mirror semantics,
like mail); call records are immutable after finalization; transcript attaches to exactly one
call record; reminders fire exactly once (per-item alarm, ruling 4a kills the 1-minute poll
[F]); access to a call/transcript follows the call access module (§2, `call_access`,
`call_channel` [F: B3]).

**Entities and identifiers:** `calendar_event` (provider id keyed, like mail), `call_record`,
`transcript`, `reminder`. All registry entities (CALL_RECORD/CALENDAR_EVENT already canonical
[F]).

**Authoritative state owner / consistency / concurrent writers [R]:** calendar sync rides the
**same per-account DO as mail** (§8) — the coupling is source fact ("sync coupled to email
accounts"), and the requirement (serialized per-account cursor) is identical; calendar gets its
own checkpoint lane inside that DO. Calls: **one DO per call** for live-call lifecycle
(participants join/leave ordering, recording state, finalization — serialized single-aggregate
transitions), then the finalized record is written to D1 and the DO retires (short-lived DO —
hot only during the call). Reminders: per-reminder DO alarm or a per-user reminder lane in the
User DO **[R: per-user lane — reminders are small per-user collections and the kernel scheduler
idiom exists (`gatekeeper-scheduler` [F])]**; ADR-005's no-dispatcher rule either way.

**Cloudflare primitives with reasoning:** account-DO lane (serialized provider cursor); call DO
(live serialized lifecycle); **D1** for event/call-record listings (relational: date-range
queries for calendar views, Soup rows); **R2** for recordings/transcript blobs (large immutable
media; metadata in D1); ffmpeg preview generation is **OD-8** (Container vs Media
Transformations vs drop) — designed as an isolated queue consumer whichever substrate wins, so
the choice does not reshape the domain **[R]**; LiveKit webhooks/callbacks at `/hooks/livekit/*`
(C2).

**Projection/index strategy:** `calendar_index` (date-range + Soup), `calls_index`; search feed
for `call_record` (§11). Writers: account-DO/call-DO outbox consumers.

**API/RPC surface:** new `CalendarApi` / `CallsApi` / `RemindersApi` under R3; LiveKit
room-token minting stays server-side RPC; transcription sidecar's ingest = internal
queue/service binding, not public HTTP **[R]**. Kernel coverage: none domain-specific (transport
only). Provider gatekeeper shared with mail (§8).

**Command/UI surface [F]:** CMD-L: `calendar.*` 6 rows (view keys ×3 loop expansion), go-to
flag-gated links (Calendar/Calls/Reminders/Activity in sidebar `g` expansion [F]),
`reminder-composer` 1 row, "Remind me" `h` add-registration (the triple-booked `h` shadowing
fact [F: CMD-L]), `block-call` rows within block-entity family.

**Authorization model:** call/channel access modules from §2; calendar events scoped to account
owner + explicit shares; transcripts inherit the call's receipt level.

**Events/async:** provider sync events → outbox → Soup/search/notifications (`call_started`);
recording-finalized → transcription job (queue) → transcript-ready event → preview job (OD-8
substrate); all idempotent by (call id, artifact sha); retries queue-native; poison media jobs
dead-letter with `preview_failed` status (call record unaffected); replay = re-run by call id.

**Migration (conditional OD-1):** *No live data:* shapes only; nothing external to copy (LiveKit
history not owned). *Data exists:* calendar re-syncs from provider (same posture as mail); call
records/transcripts are Macro-owned → ETL S3→R2 by key + D1 rows; previews regenerate (do not
migrate) **[R]**.

**Parity tests:** 05-MAP proof (open from Soup + access rules); recurring-event fixture set
(recurrence rules are the classic parity trap **[I]** — harvest exact fixtures in the domain
pass); reminder DST/timezone fixtures (harvest the cron+IANA semantics the scheduled_action row
says to keep verbatim [F]); call lifecycle state machine; transcript attach-once.

**Observability/SLOs:** calendar sync lag; call join success rate; transcription job age;
preview failure rate; reminder fire-time skew (p99 < 5s **[R]**).

**Rollback:** mirrors are re-syncable; call DOs short-lived; media immutable in R2; rollback =
previous worker + projection rebuild.

**Dependencies / wave:** §8 (shared account DO + gatekeeper), §2, §13, OD-8 for previews.
**W5**. Coverage note: transcription sidecar internals and `crates/cal` internals were not
audited in wave 1 beyond the ledger row — the domain implementation pass must do that read.

---

## 10. CRM

**Owner ruling [F]:** ruled — "Keep, in the pilot (2026-08-19). What the new CRM actually
contains is decided by David + agent at design time from what the source really does" (crm row).
CRM shapes adopt; companies split + company/contact blocks keep [F]. This section therefore
designs the *mechanics* and marks content-scope as the owner's design-time call.

**Source behavior evidence [F]:** `crates/crm`, audit `audits/crm-audit.md` — mounted at `/crm`
in DSS; **email-traffic-derived** (populate/depopulate off `email_links`); domain-keyed
companies per team; EAV Stage/Owner/Revenue on companies only (contacts have none); global
Apollo-backed domain directory with unfurl fallback (§17-adjacent [F: unfurl row]); hidden/
email_sync/killswitch machinery; CRM entities **not favoritable** at pin (crm-audit §D12);
`crm_company` is a searchable type [F: E1]; `crm_company_access`/`crm_contact_access` query
modules exist [F: B3]. contacts_service is **NOT** CRM — separately ruled (§10a).

**User journeys:** the 05-MAP proof — company view reconciles linked contacts, email activity,
and properties; connect mailbox → companies/contacts auto-populate from email traffic;
depopulate when traffic basis disappears; set Stage/Owner/Revenue; enrich from the domain
directory; hide a company; killswitch a team's CRM sync.

**Invariants:** company identity is domain-keyed per team [F]; populate/depopulate is derived —
CRM rows caused by email evidence must retract when the evidence retracts (the depopulate
semantic); properties on companies ride §6 exactly (Stage/Owner/Revenue as system-ish keys);
enrichment never overwrites user-entered fields silently **[I — verify exact precedence in the
domain pass; crm-audit has the machinery]**.

**Entities and identifiers:** `crm_company` (team, domain key), `crm_contact`, `email_link`
association rows, directory entries (global, non-tenant). COMPANY is a property entity type [F].

**Authoritative state owner / consistency / concurrent writers [R]:** **one DO per company** is
over-granular for a derived-heavy domain **[I]**; requirement analysis: writes come from (a)
users editing fields (low rate), (b) the email-link deriver (bursty), (c) enrichment. The
serialization requirement is per-company (deriver retract vs user edit races). Choose **per-team
CRM DO** as the single writer for the team's company/contact set — team-scoped cardinality is
modest (per-team CRM), it serializes deriver-vs-user races in one place, and it owns the
killswitch state machine. Hot-key bound: one team's email-derivation rate; if a pilot team's
volume breaks this, shard by company-domain hash within the team — recorded as the named
fallback **[R]**. Directory: global read-mostly store, KV/D1 with a single enrichment-writer
worker.

**Cloudflare primitives with reasoning:** Team-CRM DO (serialized derived-vs-manual writes +
killswitch); **D1** for company/contact rows and `email_link` associations (relational joins
with mail are the domain's essence — company view = join over links/activity/properties [F]);
**KV** for the global domain directory cache (read-mostly, eventual consistency acceptable, with
negative-cache behavior the unfurl fallback already implies [F]); Apollo + unfurl-fallback as
Gatekeeper/safe-fetch consumers (OD-6 applies to any user-influenced URL fetch).

**Projection/index strategy:** `crm_index` for companies Soup split/saved views (team CRM saved
views are the team-blob tier [F: §4]); activity rollups (email counts, last-touch) as
projection columns maintained from mail events — never computed by fan-out at render.

**API/RPC surface:** new `CrmApi` under R3 (company/contact CRUD, hide, enrich, killswitch,
link inspection). Kernel coverage: transport only. Enrichment provider calls go through a
gatekeeper (per ADR-002's connector posture).

**Command/UI surface [F]:** CMD-L: CRM company property commands (3 rows,
`use-entity-action-hotkeys.ts:681`), `companies` split rows within `soup.*`, `block-company`/
`block-contact` UI (pointer-driven; parity via fixtures), go-to Customers link (flag-gated [F]).

**Authorization model:** `crm_company_access`/`crm_contact_access` semantics from §2; killswitch
= team admin; directory reads are global but tenant-decorated (no cross-tenant leakage of
which teams track a domain **[R]**).

**Events/async:** consumes mail-link events (§8) → derive/retract company/contact rows (Team-CRM
DO applies them serially, idempotent by (team, domain, evidence id)); emits CRM events →
Soup/search/activity. Enrichment jobs: queue + per-domain dedupe; retries bounded; poison
enrichment marked and skipped (company stays un-enriched); replay = re-derive from `email_link`
state (fully derivable — the recovery story is a rebuild, matching the depopulate design).

**Migration (conditional OD-1):** *No live data:* shapes only; CRM re-derives from mail once
mail has data — effectively self-migrating **[I]**. *Data exists:* ETL manual fields
(Stage/Owner/Revenue, hides) — derived rows re-derive rather than migrate; reconciliation =
derived-set diff old-vs-new with tolerance for deliberate SEC/derivation fixes.

**Parity tests:** 05-MAP proof (company view reconciliation); populate/depopulate fixture
(send/remove evidence → row appears/retracts); domain-keying collisions (two teams, same
domain); enrichment precedence; killswitch behavior.

**Observability/SLOs:** derivation lag from mail event → company visible (< 60s p95 **[R]**);
enrichment success rate; directory cache hit rate; per-team killswitch state metric.

**Rollback:** derived data rebuildable by construction; manual fields event-sourced in the Team
DO; rollback = previous worker + re-derive.

**Dependencies / wave:** §8 (hard — the deriver's feed), §6, §2, OD-6 for enrichment fetches.
**W5** (with mail). Owner design-time session on content scope is the ruled gate before UI
build.

### 10a. Contacts graph (adjacent, separately ruled)

**[F]** "Re-ruled (2026-08-19, batch E): keep as its own capability, in the pilot — standalone
user↔user connections graph (mention/share-suggestion feeder), independent of CRM."
`contacts_connections(user1,user2)` with `CHECK(user1<=user2)`, fed from channel membership +
auth events [F: crm-audit §A3]. Design: D1 table owned by one consumer of §1/§7 events
(normalized pair ordering preserved); read API inside `TeamsApi`/suggestion surfaces; no DO
(no serialized-writer need beyond the single consumer); rebuildable projection; parity = same
event stream yields same edge set. Wave: W4 tail-end **[R]**.

---

## 11. Search

**Owner ruling [F]:** default-keep via Q19, **verdict pending**; ledger's dated instruction:
"Rule with `search_processing_service` — one system." One of the four deliberate exceptions
("seven-source search", OD-2) with the corrected framing **[F: gap review E2]**: seven **indexed
entity types on one OpenSearch index** (document, project, chat, channel, email, call_record,
crm_company), enrichment from Postgres — *not* seven providers. The 04-TARGET "query router over
provider sources" phrasing is wrong and must not drive the ADR (gap-review rec 2).

**Source behavior evidence [F]:** `crates/search_service` 7,061 LOC — 3 mounts (`POST /`,
`POST /simple`, `/channel`) fanning across 7 per-entity handlers; `terms.rs` query parsing;
`enrich.rs` post-index hydration from Postgres; `services/search_processing_service` 10,165 LOC —
7 Kafka consumer modules (one per type) + internal `/backfill`, `/delete_document`,
`/extract_sync`; OpenSearch substrate (`infra/stacks/opensearch`); the `macro.*` topic registry =
12 product topics + example (corrected E3 — `macro.com`/`macro.activity_events` are not topics).

**User journeys:** the 05-MAP proof — golden query set matches source coverage and ranking
tolerances; unified search across the 7 types; the `/simple` fast variant; channel-scoped
search; results hydrated with live display metadata and filtered by access; deleted entities
vanish from results promptly.

**Invariants:** the **7-entity-type coverage contract** is the requirement (E2 correction);
ranking within stated tolerances (exact BM25 parity with OpenSearch is not promised — the gate
is the golden set with tolerances, per 05-MAP); index-by-id idempotency (re-indexing twice is a
no-op [F: search_processing row]); tombstoned/access-revoked entities never surface (enrichment
+ access filter is the last line).

**Entities and identifiers:** no entities of its own — index documents keyed by (entity_type,
entity_id). Deletion propagation keyed the same way.

**Authoritative state owner / consistency:** the index is **derived, never authoritative**;
freshness requirement from source behavior: near-real-time consumer lag (Kafka consumer, not
batch [F]) → same staleness class as the Soup projection.

**Cloudflare primitives with reasoning [R]:** **D1 FTS5** as the lexical index — reasoning: the
old system is *lexical* OpenSearch + relational enrichment; nothing in the harvested surface
shows semantic/vector retrieval [F: E1 — query construction + enrichment only], so **Vectorize
is not required for parity and is deliberately deferred** until a ranking-gap in the golden set
proves the need (avoids inventing a requirement; 04-TARGET's own caution). Substrate unification
question with the Soup index (one D1 family vs two) is **OD-302** — this design keeps them as
*separate schemas in the same D1 projection plane with one owning consumer service each*, which
is compatible with either ruling **[R]**. Indexing: **Queues** consumers per entity type
(mirror of the 7 Kafka modules) — durable fan-out, per-entity ordering key, idempotent by id;
backfill = DO + alarm bulk job (ruling 4a: no dispatcher [F: row]); enrichment reads D1
projections/entity DOs at query time (the old Postgres hydration slot).

**Projection/index strategy:** `search_fts_{type}` FTS5 tables + a metadata table per type;
deletion consumer honors registry tombstones; `extract_sync` path (sync-service-backed document
text) becomes a pull from the lifted sync-service on `document.sync_content_updated` events [F:
row]. Single writer per table = the indexing consumer (ADR-005).

**API/RPC surface:** new `SearchApi.query` / `querySimple` / `channelSearch` under R3
(preserving the three-mount shape); internal backfill/delete = admin RPC, not public HTTP.
Kernel coverage: none.

**Command/UI surface [F]:** CMD-L: global `/` search row (standalone, global scope [F: WP-020
sidebar note]), `soup.*` search/ask-ai rows, `command-menu` search interplay; `search` split
(default-keep [F: Ledger §4]).

**Authorization model:** results filtered through the access index (§2) at enrichment time;
channel search additionally membership-gated; no cross-tenant index reads (tenant column in
every FTS table **[R]**).

**Events/async:** consumes the product event bus (the 12-topic contract is the reusable
artifact [F]); retries queue-native; poison documents (pathological text) marked
`index_failed` and skipped; replay/backfill = re-drive by entity id (idempotent); ordering
per entity id.

**Migration (conditional OD-1):** the index is **rebuilt, never migrated**, in both branches
(08 §4). OpenSearch dies with the AWS substrate either way [F: ruling 2].

**Parity tests:** golden query set harvested from source behavior (build it in the domain pass
against the 7 handlers' query-construction logic — `terms.rs` semantics are the fixture
source); coverage assertion per type; deletion-propagation test; access-filter test; freshness
test (event → searchable < SLO).

**Observability/SLOs:** index lag p99 (< 30s **[R]**); query p95 (< 300ms **[R]**);
zero-result rate; backfill throughput; per-type poison counts.

**Rollback:** derived — rebuild at previous version; query API versioned; FTS schema changes =
shadow-table rebuild then swap **[R]**.

**Dependencies / wave:** §2 registry/access, event bus (ADR-005), producing domains. **W7**
(needs producers live); schema/contract fixed earlier via ADR-007.

---

## 12. Activity, history, recents, favorites

**Owner ruling [F]:** DSS-native umbrella row is default-keep via Q19, **verdict pending**, with
the ledger's own split guidance (N1/N2/N3, needs David — OD-5); **frecency and the
activity-events vocabulary have no ledger rows** (escalated in wp000 §D9; still true). Favorites
row researched, verdict pending. Reminders ruled keep (§9). Q20's SEC-fix ruling governs the
favorites read-side gap [F].

**Source behavior evidence [F]:** `activity_events` — append-only fact log, **uuidv5 ids
(replay-idempotent by construction)**, closed **10-action vocabulary** (renaming a variant is a
storage migration per its own doc comment), actor-vs-subject split (`on_behalf_of ?? actor`),
two keyset indexes = exactly two surfaces (my-activity, entity-activity)
(`crates/activity/src/domain/models.rs:40,95-125`). `frecency` — 4,450 LOC; score =
0.7×frequency + 0.3×recency, decay 0.1/hour, last 10 events (`models.rs:199-205`); consumed by
soup, memory, ai_tools, email, channels [F]. Favorites — 1,531 LOC; PK (user, entity_type,
entity_id), fractional `sort_order`, cap 500 enforced on add and reorder, **publishes no
events**, add requires View receipt but **listing re-checks nothing**, 6-way LEFT JOIN
hydration, display names deliberately not stored [F: favorites row + J2/B6]. Pins 258 LOC/4
endpoints; history 249/3; recents endpoint is only `GET /recents/deleted` — **the visible
"recents" is frecency** [F: DSS-native row]. Saved views covered in §4.

**User journeys:** the 05-MAP proof — same activity stream yields stable recents/favorites
ordering; view my activity / an entity's activity; quick-access list driven by frecency; pin;
favorite + reorder (fractional); favorites decorate Soup rows; navigation history.

**Invariants:** activity is append-only with the closed 10-action vocabulary as a **portable
contract** (new action = explicit vocabulary change, ADR-005 schema_version); activity replay
is idempotent (uuidv5 preserved); frecency constants (0.7/0.3, 0.1/h, 10 events) are the parity
spec [F]; favorites cap 500 + fractional order preserved; **favorites listing now filters
through access** (the read-side gap is *fixed*, per Q20's SEC posture — a deliberate,
documented behavior change [R], the one place this doc chooses fix over faithful).

**Entities and identifiers:** activity events (uuidv5 over namespace+content [F]); favorites/
pins/history rows keyed by (user, entity); frecency per-(user, entity) score state. None are
registry entities.

**Authoritative state owner / consistency / concurrent writers [R]:** activity — an append-only
log with **no serialized-writer requirement** (ids are content-derived and idempotent):
Queue consumer(s) appending to D1 partitioned by tenant; the two keyset surfaces are its
indexes. Favorites/pins/history/view-locations — **per-user User-DO collections** (the ledger
calls this "the best fit in the ledger for the kernel's per-user DO idiom" [F: favorites row];
requirement: small, per-user, ordered, read-on-every-page; single writer = the user).
Frecency — per-(user) scoring state updated from activity events: a per-user lane in the same
User DO (event-driven decay computed lazily at read from last-10 events — the algorithm needs
only the event tail [F], so no cron decay job **[R]**).

**Cloudflare primitives with reasoning:** D1 for the activity log (relational keyset reads over
a cross-entity fact stream; no aggregate invariant to serialize); User DO for personal
collections (kernel-native idiom, `user.ts:151-220` [F]); **no Queues fan-out for favorites**
(publishes no events — preserved [F]); hydration: the 6-way JOIN becomes a **batch read against
the Soup projection/registry** (§4's denormalized row cache), preserving the
names-resolved-live property (renames + viewer-relative DM names stay correct [F]).

**Projection/index strategy:** activity's two keyset indexes; `favorited_entities` decoration
column in the Soup index [F]; frecency scores exposed to soup/memory/ai_tools via a small read
API on the User DO (its five consumers [F]).

**API/RPC surface:** new `ActivityApi` (2 read surfaces), `FavoritesApi` (list/add/remove/
reorder — 4 old endpoints [F]), `PinsApi`, `HistoryApi`, plus `recents.deleted` folded into
DocumentsApi trash surface **[R]**. Kernel: User DO storage primitives only.

**Command/UI surface [F]:** CMD-L: `favorites` scope row + the runtime-generated
`favorites.open.<favorite>` marker (1 of the 4 runtime markers — unbounded, user-data-driven
[F]); go-to Activity link (flag-gated); pins/history surface via command menu rows in
`global`/`command-menu` families.

**Authorization model:** activity reads: my-activity = self; entity-activity requires View on
the entity; favorites add requires View receipt (preserved) **and listing filters through the
access index (changed — see invariants)**; pins/history are self-scoped.

**Events/async:** activity consumes all domain events (its 10-action vocabulary is the
consumer-side mapping; overlaps the 12-topic registry [F]); frecency consumes activity;
favorites emit nothing. Idempotency: uuidv5 (activity), (user, entity) upserts (frecency).
Retries queue-native; poison events skipped with counter; replay fully safe by construction
[F].

**Migration (conditional OD-1):** *No live data:* shapes only; frecency/activity start empty
(cold-start recents is acceptable and matches a fresh pilot **[I]**). *Data exists:* activity
log ETL is append-only replay (idempotent); favorites/pins ETL trivially keyed; frecency
recomputes from migrated activity tail (never ETL scores).

**Parity tests:** 05-MAP proof (same stream → stable ordering); frecency constant fixtures
(0.7/0.3/0.1/10 exact [F: J11]); favorites cap + fractional reorder + no-events; hydration
correctness under rename and DM-name viewer-relativity; the *changed* revocation-filtering
behavior gets its own labeled test (documents the deliberate deviation).

**Observability/SLOs:** activity consumer lag; favorites read p95 (< 50ms — it is on every page
**[R]**); frecency read cost; vocabulary-drift alert (unknown action = poison, never silent).

**Rollback:** all derived or per-user small state; rollback = previous worker; activity log is
append-only (no destructive change).

**Dependencies / wave:** event bus + producing domains; §2 access index for the fixed read
path. **W7** (activity consumer can start W3-adjacent to accumulate facts early **[R]**).
**New rows needed** (frecency, activity vocabulary) remain owner items — re-raised as OD-303.

---

## 13. Notifications

**Owner ruling:** **OD-3 RULED 2026-08-20** (see `reports/06-owner-decisions-needed.md` OD-3):
notifications kept — in-app (kernel session push) + email digests; **mobile push deferred until
a native client exists**. The stale provisional "Drop" is overruled (the ledger row's dated
verdict transcription rides the OD-5 batch). This design was written to be valid under either
OD-3 option; the selected branch is the in-app + digest core, with **the push channel an
isolated module that stays out of pass 1**.

**Source behavior evidence [F]:** 19 types (7 GitHub), 22 metadata structs, `format_title` copy
in code; 3 egress channels behind one state machine (WebSocket via gateway; mobile push via SNS
platform endpoints ios/android/iosvoip incl. CallKit; batched email digests with unsubscribe
codes + per-channel dedupe); last-online checker gates push (only when not live on socket);
rate limiter; SNS receipt ids in `notification_message_receipt`; 11 tables; ~22 endpoints
(list/bulk-get/seen/done/undone/delete, preferences, unsubscribe); per-type opt-out, per-item
mute, global mute; agents can raise notifications (AI-tool surface). All at
`crates/notification`/`crates/model_notifications` (gap review §2.4, exact).

**User journeys:** the 05-MAP proof — idempotent notification appears once and unread state
reconciles; mention → recipient notified in-app instantly if online, push if offline (channel
per OD-3), digest email if unseen by window; mark seen/done/undone; mute an item; per-type
preference; unsubscribe from digests via code.

**Invariants:** **exactly-once user-visible delivery per (event, recipient, channel)** — the
idempotency gate of the 05-MAP proof; unread count always reconcilable from the notification
set (count is derived, never independently mutated); the 19-type vocabulary is closed
(additions are explicit; type ids and `format_title` semantics harvested 1:1); suppression
(mute/preference/unsubscribe) evaluated at delivery time, not enqueue time [I from
preference machinery]; push only when not live on socket (preserved [F]).

**Entities and identifiers:** `notification` (per recipient, typed, entity-linked),
`preference`, `mute`, `device_registration` (push), `digest_state`, `receipt`. Notification id
deterministic from (event id, recipient) — the idempotency key **[R, mirrors the old
per-recipient dedupe]**.

**Authoritative state owner / consistency / concurrent writers [R]:** **one DO per user for
notification state** — requirement: unread/seen/done mutations and delivery dedupe must
serialize per recipient (two deliveries of the same event, or seen-vs-new races, resolve in one
place); the per-user digest window is an alarm on the same DO (ruling 4a). Fan-out (one event →
N recipients) happens *before* the per-user DOs via a queue consumer that expands recipients —
no cross-user serialization needed.

**Cloudflare primitives with reasoning:** per-user Notification DO (serialized unread state +
delivery dedupe + digest alarm — three requirements, one aggregate; could fold into the User DO
but kept separate to isolate fan-in write load from the identity aggregate **[R]**); **Queues**
for producer-event → recipient-expansion → per-user delivery (durable fan-out, ruling 3a);
in-app channel = **C1 kernel session events** (ruled — gateway superseded [F]); email digests =
the DO alarm composing via the mail-send path (§8) with unsubscribe codes preserved; **mobile
push**: no kernel analogue exists [F: D7] — a new `push-egress` worker speaking APNS/FCM
directly (SNS does not come along [F]), built **only** if OD-3 keeps the channel; its interface
(deliver(recipient, payload) with receipt) is fixed now so the core never changes shape
**[R]**.

**Projection/index strategy:** notification list + unread counts live in the per-user DO
(small, self-scoped); a D1 mirror only if cross-user admin/ops queries demand it (not in
first pass **[R]**).

**API/RPC surface:** new `NotificationsApi` (list/bulk-get/seen/done/undone/delete,
preferences, mute, device registration) collapsing the ~22 endpoints under R3; unsubscribe-code
links stay HTTP (`/hooks/unsubscribe/*`-class public GET — physical need: email links, C2
exception) **[R]**. Agent-raised notifications ride the Gatekeeper session API surface (frozen
ai_toolset). Kernel coverage: session-event transport (C1) only.

**Command/UI surface [F]:** CMD-L: inbox rows within `soup.*` (unified inbox split), seen/done
actions in `soup-entity.*` rows; no dedicated hotkey family (matches source — notifications
surface through Inbox).

**Authorization model:** strictly self-scoped (recipient-only reads/writes); producers must
hold the entity receipt that justifies notifying (mention requires the mentioner could View the
entity — carried in the event envelope's receipt context **[ADR-ASSUMPTION]**, ADR-005/ADR-006
reconcile).

**Events/async:** consumes all producer domains' events; type-mapping layer implements the
19-type vocabulary (the 7 GitHub types arrive only with §15's GitHub scope [F]). Idempotency:
deterministic notification id; delivery per channel recorded with receipts. Retries: queue
redelivery + per-channel bounded retries (push tokens invalidated on provider NotRegistered —
harvested behavior class **[I]**); poison: malformed producer events dead-lettered; replay:
safe end-to-end (dedupe at the per-user DO). Digest: alarm-window batch, per-channel dedupe
preserved [F].

**Migration (conditional OD-1):** *No live data:* shapes only (11 tables → DO schema + seeds).
*Data exists:* unread/preference state ETL per user (small rows); receipts/history optionally
archived not migrated **[R]**; device registrations re-enroll (push tokens are
device-refreshed anyway **[I]**).

**Parity tests:** 05-MAP proof (idempotent appears-once + unread reconcile); per-type golden
fixtures for all 19 `format_title` outputs [F: copy lives in code — harvest verbatim];
last-online gating; digest window + dedupe + unsubscribe; mute/preference matrix; double-
delivery injection test.

**Observability/SLOs:** delivery latency per channel (in-app p95 < 2s **[R]**); dedupe hit
counter; digest send success; push token failure rate; unread-reconciliation drift alert
(derived-count audit).

**Rollback:** per-user DOs additive; channel modules feature-flagged independently (push can
roll back alone); replay-safe pipeline means a bad mapping version is fixed by redeploy +
re-drive.

**Dependencies / wave:** producers (§5–§10, §15), C1 session events, §8 for digest sending;
scope **ruled 2026-08-20 (OD-3)**: build in-app+digest core in **W4**; push module deferred
until a native client exists.

---

## 14. Agents, tools, memory, MCP

**Owner ruling [F]:** heavily ruled: **"Kernel is the one agent runtime (2026-08-19)"**; chat =
"Kernel runs, old UX on top (2026-08-19)"; ai_tools/ai_toolset = "Semantics recreated as
Gatekeeper session APIs, mapped piece-by-piece factually from source (2026-08-19)" (frozen
invariant, Q20); mcp_client → `gatekeeper-mcp` (row researched; direction stated);
mcp_service + mcp_auth_proxy: **deliberate exception — MCP server in pilot** (OD-2 records it;
auth-proxy role dissolves with the auth rebuild [F]); `/chat/completions` OpenAI proxy:
**deliberate exception — ungoverned proxy stays** (OD-2), even though the ledger's research
calls it "the one clear kill candidate" — the exception wins per program instruction, and the
contradiction stays recorded in CON-2. memory / ai_projections / scheduled_action / import /
ai_usage rows: default-keep via Q19, verdict pending.

**Source behavior evidence [F]:** streaming row — the durable-stream half (`crates/stream`
1,696 LOC: offset-addressed resumable streams, replay-from-beginning, 30-min lifetime, Redis
pub/sub cross-instance cancellation, `active_streams` table) **dissolves into kernel sessions**
(the ledger's own analysis: "the strongest 'the kernel already has this' case");
`/structured-completion` = prompt+schema→one AgentLoop; `/chat/completions` = 47-line OpenAI
passthrough, stream forced false [F: J1]. memory — one prose blob per user, 24h
stale-while-revalidate, generation = full agent session over `all_tools`, CLI sidecar [F: J7 +
row]. ai_projections — prompt+schema+cadence (6h/1d/3d) materialized per user/team,
insert-as-lock 15-min reclaim (weakest lease tier), Home-recommendations surface [F].
scheduled_action — `ActionKind` = {Agent} exactly; cron+IANA timezone; polling dispatcher;
execution creates a real Chat row with memory injected [F: J9 + row]. import — staged→importing→
imported/discarded ledger; 3 hardcoded MCP sources (Linear/Notion/Slack) with fixed target
types + normalization; cheap 24-turn/90s gather agent with a locked staging tool; "strongest
existing analogue of the ruled P1 connectivity centerpiece" [F: J6 + row]. ai_usage —
`AiFeature` ×10 = the complete AI-spend inventory [F: J8]. Kernel provides: Overseer (64+1
rows), AiChatSubscriber (7, incl. streamGeneration restart-vs-reconnect + provisional-event
discard protocols), ActionsSubscriber, approval queue, auto-approval rules, hooks, scheduler,
agent spawners, `gatekeeper-mcp`, `gatekeeper-scheduler` [F: RPC-L + 04-TARGET].

**User journeys:** the 05-MAP proof — agent reads a capability, proposes a write, receives
approval, resumes; chat with streaming + stop; resume a stream after reconnect; agent uses a
frozen-toolset tool against a domain; scheduled automation runs as an agent session and shows
in the agents view; import gathers candidates from Linear/Notion/Slack and user
confirms/discards; memory refreshes in background and improves prompts; external agent connects
to Macro-as-MCP-server (pilot exception).

**Invariants:** **one agent runtime — the kernel's** (ruled; no second loop is ever built);
frozen `ai_toolset` semantics mapped piece-by-piece (Q20) — tool names/contracts are a parity
fixture set, not a redesign surface; agent writes to domains pass the same receipts as humans
(+ approval queue for gated writes — the 05-MAP proof); `on_behalf_of` attribution flows to
activity (§12 [F]); stream resume never duplicates or drops visible tokens (kernel subscriber
protocol tests [F: RPC-L `parity:streaming`]); import "latitude on content, never on shape"
[F].

**Entities and identifiers:** chat/session (kernel-owned session + a `CHAT` registry entity for
Soup/search [F: CHAT is a canonical type]); `automation` (saved prompt + schedule);
`import_run`/`import_entity`; memory blob (per user); projection definitions/instances;
usage rows. Agents/bots as principals per §1/§7.

**Authoritative state owner / consistency / concurrent writers:** the kernel Overseer/session
DOs own runs, streams, approvals (adopted as-is — that is the ruling); wrapper-owned state:
memory blob + refresh alarm in the **User DO** (per-user, 24h staleness lane — ruling 4a
replaces the CLI/cron shape); ai_projection instances in a per-target (user/team) DO lane with
**per-cadence alarms replacing the 3 EventBridge tiers and the insert-as-lock entirely**
(ruled pattern: no lease tables [F]); automations = per-automation alarm state (cron+IANA
semantics harvested verbatim — the row's one keep-verbatim instruction [F]) executing by
spawning a kernel session — **plausibly not a service at all** (row's own analysis), just
saved-prompt rows + alarms + the kernel spawner, reconciled with `gatekeeper-scheduler` overlap
in ADR-002 **[R]**; import runs = per-run DO alarm lifecycle.

**Cloudflare primitives with reasoning:** kernel DOs (ruled); User-DO lanes for
memory/projections (per-user small state + alarms — no dispatcher); **AI Gateway** for the
collection half of ai_usage (native token/cost logging [F: row]) with the **10-value
`AiFeature` tag stamped by the model layer** as the request attribute + small D1 rollup — the
tag is the part that does not dissolve [F]; `gatekeeper-mcp` for outbound MCP (transport free;
the harvest is source→type mapping + normalization [F: import row]); the pilot MCP *server* =
a wrapper worker exposing first-party tools under the rebuilt auth (OAuth 2.1 broker need
dissolves with FusionAuth [F]) — boundary documented per the exception's governance duty
(OD-2); the OpenAI proxy exception = an isolated wrapper route with its ungoverned nature
explicitly logged/metered (governance doc per OD-2) **[R]**.

**Projection/index strategy:** chats into Soup/search via registry events; automation history
per-automation collection; usage rollups in D1.

**API/RPC surface [F→R]:** **the bulk of the kernel's 182 rows serve this domain**: Overseer 64
(+1 callback), AiChatSubscriber 7, ActionsSubscriber 2, CodeSubscriber 2, WorkpiecesSubscriber
3, WorkpieceClient 4, GadgetClient 12, GatekeeperClient 3, ConsoleLogSubscriber 1,
PresenceSubscriber 3 — all `preserve` per RPC-L; per-vendor gatekeeper sessions and per-gadget
`connectToGadget` facets are explicitly outside the freeze and need their own inventories
[F: WP-020 note]. Wrapper adds: `AutomationsApi` (7 old endpoints collapsed), `ImportApi` (4),
`MemoryApi` (1 + regenerate), `AiAdminApi` (usage/pricing, admin-only), structured-completion
as an RPC method over kernel structured output [F: row]. `/chat/completions` HTTP route kept
verbatim as the exception (external contract shape [F]).

**Command/UI surface [F]:** CMD-L: `chat.*` 3, `launcher` agent/automation creates, `agents`
split rows in `soup.*`, `command-menu` ask-AI rows, `md.*` AI-editing rows (lifted
ai-editing-worker integration), onboarding-mock rows excluded (parked §18). "MCP setup" command
is a brand-tripwire `adapt` row [F: CMD-L note #2].

**Authorization model:** agent sessions carry the invoking principal + `on_behalf_of`; domain
receipts minted per tool call (no ambient authority); approval queue gates writes per kernel
model (kept — the compile-time default-deny wrappers for the "use" role are explicitly
preserved [F: WP-020 note]); admin-only surfaces (ai_usage) 403 semantics preserved [F].

**Events/async:** session lifecycle = C1 events (replaces StreamEvent created/closed [F]);
automation/import/memory alarms per above; usage rows written per model call. Idempotency:
runs keyed by (automation id, scheduled tick) so a crashed tick re-arms without double-running
(fencing per 4a); import re-runs are per-(user, source) serialized [F: import_run shape].
Retries: agent-session retries are kernel policy (not wrapped); job alarms re-arm with backoff;
poison prompts (permanently failing generations) mark `error` status (ai_projections status
enum preserved [F]). Replay: memory/projections regenerate by design.

**Migration (conditional OD-1):** *No live data:* nothing — chats/memory/projections start
empty; automations seeded by fixture. *Data exists:* chats ETL into kernel-session-compatible
history + registry entities (the one non-trivial mapping — old Chat rows → kernel session
records; scoped in the domain pass); memory/projections regenerate (never ETL); automations ETL
(cron + tz + prompt rows).

**Parity tests:** 05-MAP proof (read-propose-approve-resume); kernel contract tests already
specified per-row in RPC-L (`parity:subscription-replay`, `parity:streaming`,
`contract:capability-lifecycle`) — this domain inherits them wholesale [F]; frozen-toolset
fixture set (piece-by-piece mapping table, per the ruling's wording); cron/DST fixtures;
import normalization goldens (Notion 32-hex collapse, Slack id passthrough [F]); AiFeature
tagging end-to-end (one call per feature → correct rollup).

**Observability/SLOs:** session start p95; stream resume success; approval latency; per-feature
AI cost (the point of the tag); automation on-time rate; import run success; memory
regeneration cost/day — feeds **OD-304** (whether the daily whole-workspace sweep survives).

**Rollback:** wrapper surfaces flagged; kernel untouched (budget ADR-014); alarms idempotent →
rollback = redeploy previous wrapper; the exceptions (proxy, MCP server) are isolated routes
that can be disabled independently.

**Dependencies / wave:** §1/§2 receipts; domains for tools. Chat/agent core rides the kernel
from **W1** (it exists); wrapper surfaces (automations/import/memory/projections) ride the
connectivity track — **OD-4 Ruled 2026-08-20: first track of wave 4a, immediately post-slice,
with the clarified intent that connectivity is the sandboxed agent's governed data-ingress
capability** (import *is* the centerpiece analogue [F]).

---

## 15. Webhooks and integrations

**Owner ruling [F]:** webhook (outbound) and bots rows: default-keep via Q19, verdict pending
(webhook's ledger label corrected — it is an **outbound delivery engine**, Macro-as-provider
[F: J3]); github row: default-keep via Q19, verdict pending, with dated route ruling **C2**
(`/hooks/<source>/*` inbound ingress) and the existing `gatekeeper-github` as the kernel
reference [F]; foreign_entity: default-keep, "rule with github" per its research [F];
**Agent connectivity layer: ruled — "Build as the P1 outreach centerpiece (2026-08-19)"** [F]
(sequencing conflict CON-4 **resolved — OD-4 Ruled 2026-08-20**: centerpiece confirmed with
clarified governed-data-ingress intent; first track of wave 4a post-slice, per 05 §4). SSRF
ruling **OD-6 blocks outbound delivery parity**.

**Source behavior evidence [F]:** outbound engine — 3 tables; `UNIQUE(webhook_id, event_id)`
idempotency; `event_ordering_key`; max **5 attempts, fixed 30/60/120/300s backoff**;
`x-macro-signature` HMAC over timestamp+raw body + reserved `x-macro-*` headers; GIN-indexed
`rule->'events'` filters; status active|paused|disabled with pause reasons; subscribable
catalog = 5 of 8 document events + 11 channel events + 4 meta events; owner = user XOR bot
(`crates/webhook/*`, J3). Inbound — GitHub webhook handles exactly 6 event types, unknown
skipped [F: J5]; every PR event upserts `foreign_entity` rows (single producer, single source
value `"github_pull_request"` [F]); GitHub App installations are **the only team-scoped
external connection** (gap: kernel grants are per-user — connectivity audit §C3 [F]); 7 of 19
notification types originate here [F]. Connectivity: no Instantly connector exists anywhere
[F: J14]; import is the strongest analogue (§14); old catalog was a hardcoded FE constant [F].

**User journeys:** register a webhook endpoint with an event filter → validate (rate-limited)
→ receive signed deliveries in order with retries → inspect delivery attempts → duplicate event
processed once (05-MAP proof); pause/disable; GitHub App installed for a team → PRs appear as
Soup items / `pr` blocks, PR notifications flow; connect an MCP/API source (Instantly first)
so agents pull external data into the workspace (P1 centerpiece).

**Invariants:** per-endpoint delivery order by `event_ordering_key`; at-least-once upstream,
exactly-once effect via `(webhook_id, event_id)` dedupe; signature scheme byte-compatible
(external consumers exist — the two CF bot workers are the contract reference [F: G-019]);
retry ladder exact (5 × fixed backoff — external-facing behavior, keep verbatim **[R]**);
reserved header protection; the not-forwarded document events (`content_uploaded`,
`sync_content_updated`, `purged`) stay unforwarded [F].

**Entities and identifiers:** `webhook` (endpoint config), `delivery` (per event),
`delivery_attempt`; `foreign_entity` (registry entity — "the cleanest case of an entity that
exists only in the registry" [F: row]); connector/connection records (gatekeeper-owned).

**Authoritative state owner / consistency / concurrent writers [R]:** **one DO per webhook
endpoint** — the requirement is verbatim the DO shape: a single-writer drain preserving
ordering per endpoint, alarm-driven retry ladder, dedupe state (`UNIQUE(webhook_id,event_id)`
becomes DO-local dedupe [F: the ledger's own D3/D4 analysis says exactly this]). Catalog
subscription filtering happens in a queue consumer that routes bus events to matching webhook
DOs (GIN filter → per-DO filter evaluation). GitHub ingress: stateless `/hooks/github/*`
worker verifying signatures → queue → consumers (foreign_entity upserts idempotent by (PR,
event) [F: uses upsert]); App-installation state: Team-scope authority (§1's Team DO lane) —
**the team-credential model is a named kernel gap → OD-305**.

**Cloudflare primitives with reasoning:** webhook DO (ordering + retry + dedupe per aggregate);
Queues (bus→filter fan-out; ingress burst absorption); D1 projection for delivery-status
inspection UI (relational listing of attempts); **egress fetch is blocked on OD-6** — the DNS
resolve-then-reject guard is unportable [F: F2]; design assumes OD-6's option (a)
(shared safe-fetch egress boundary at resolver-level parity bar [F: gap-review rec 4]) and
isolates all outbound HTTP behind one `safe-fetch` interface so whichever ruling lands is a
module swap **[R]**. `gatekeeper-github` adopted for OAuth/API; the three not-free scopes
(team installs, PR mirror, 7 notification types) built as wrapper per the row [F].

**Projection/index strategy:** `webhook_status` + `delivery_log` D1 projections (inspectable
per 05-MAP proof); PR mirror rows decorate Soup via registry + `pr` block.

**API/RPC surface:** new `WebhooksApi` (6 old endpoints incl. rate-limited validate) under R3;
delivery is background (C2 explicitly does not apply to outbound [F]); `/hooks/github/*`,
`/hooks/channels/*`, `/hooks/gmail/*`, `/hooks/livekit/*` ingress family per C2;
`ConnectorsApi` for the connectivity catalog (gatekeeper-backed; the kernel's
connected-accounts rows — RPC-L `subscribeConnectedAccounts` 3 rows + `GatekeeperClient` 3 —
are the adopted surface [F]).

**Command/UI surface [F]:** CMD-L: settings Connections/MCP/Bots tabs rows (`settings.*`
family); `block-pr` rows within block-entity; integrations/`import-linear` split (Ledger §4
default-keep). The webhook admin UI is settings-surface, no dedicated hotkeys (matches
source).

**Authorization model:** webhook CRUD requires owner (user or bot principal — XOR preserved
[F]); signing secrets never leave the DO (read-once display on create **[R]**); ingress
verifies provider signatures before any parse; team-install management = team admin receipts;
foreign_entity reads follow the `foreign_entity` access module [F: B3].

**Events/async:** consumes the whole product bus (the 12-topic contract [F: corrected E3]);
delivery attempts recorded per try; poison endpoints auto-pause with reason (status machinery
preserved [F]); replay: re-drive by event id is safe (dedupe); meta-events about webhooks
themselves (4) preserved [F].

**Migration (conditional OD-1):** *No live data:* shapes only. *Data exists:* webhook configs +
secrets ETL (secret custody per G-017 inventory); delivery history archived not migrated
**[R]**; GitHub installs re-authorized (provider-side state re-established — installations
cannot be silently transplanted **[I]**).

**Parity tests:** 05-MAP proof (duplicate processed once + status inspectable); signature
byte-parity against the two CF bot workers' verification code [F: the only working reference];
retry-ladder timing; ordering under interleaved events; auto-pause; GitHub 6-event dispatch
goldens incl. unknown-skip; foreign_entity upsert idempotency.

**Observability/SLOs:** delivery success rate + attempt histogram; endpoint pause rate; ingress
verification failures; queue depth; per-endpoint delivery lag (p95 < 60s under the retry
ladder's healthy path **[R]**).

**Rollback:** webhook DOs pausable fleet-wide (kill-switch flag); ingress routes independently
disableable; PR mirror rebuildable from provider re-sync.

**Dependencies / wave:** event bus, §2, §13 (GitHub notification types), OD-6 (hard, for
outbound), OD-305 [= OD-29]. **OD-4 Ruled 2026-08-20: rides the connectivity centerpiece as
the first track of wave 4a, immediately post-slice** (05 §4 encodes it; CON-4 resolved).

---

## 16. Static files, unfurl, image proxy

**Owner ruling:** static_file_service, unfurl_service, image_proxy_service rows: default-keep
via Q19, verdicts pending; route collisions ruled away by R3 [F: collision #1 `/api/file/*`;
`/proxy` literal collision unfurl-vs-image-proxy, route-reconciliation §7]. Safety ruling =
**OD-6** (shared with §15). Image-proxy row's own research: "possibly zero" port need [F].

**Source behavior evidence [F]:** static files — 6 endpoints ×2 mounts (`/api` + `/internal`,
same router); **metadata in DynamoDB, unharvested** (G-006; second non-Postgres store; only
`BulkUploadRequest` was harvested); presigned-PUT → S3 event → `mark_uploaded` pending→ready
machine (same family as documents ingestion [F: row]); CDN `GET /file/{id}` via
CloudFront/S3; image-optimizer derivative keys skipped by the finalizer; couplings: email
attachments (2 tables + GC Lambda), chat attachments, `EntityType::StaticFile` canonical.
unfurl — OG/Twitter card parse; 8s/3s timeouts; SSRF guard resolve-then-reject; redirect
limits; content-type + Content-Length + streaming size cap; **no cache layer found** [F: F4];
CRM directory fallback resolver [F]. image proxy — **no transforms**: streaming pass-through,
10MB cap enforced twice, 15s/5s timeouts, manual redirect re-validation ×5, spoofed UA,
immutable 1y cache header; purpose = CORS/hotlink laundering, chiefly inline email images;
resizing is the separate `image_optimizer` Lambda [F: F3].

**User journeys:** the 05-MAP proof — authorized file fetch and safe unfurl pass adversarial
tests; upload any non-Document blob (chat/email attachment) → pending → ready; download via
CDN-class URL; bulk delete; paste a link in a message → preview card; inline remote image in an
email renders without CORS/hotlink breakage; resized image variants serve fast.

**Invariants:** metadata/authorization never live in the byte store [F: 04-TARGET caution +
current design]; a file is downloadable only after `ready`; deletes are authorization-checked
and GC'd (email-attachment orphan GC semantics preserved); **all outbound fetches
(unfurl/image) pass the safe-fetch boundary at resolver-level parity or better** [F: gap-review
rec 4] — hard-blocked on OD-6; size/timeout/redirect caps preserved verbatim (they are the
hardening spec [F]).

**Entities and identifiers:** `static_file` (registry entity [F]) with metadata row (name,
content type, `extension_data`, upload state — shape **must be confirmed against the live
DynamoDB table**, which is unharvested → migration/parity blind spot, G-006/OD-1 interaction);
unfurl cards and proxied images are **not entities** (derived/cacheable).

**Authoritative state owner / consistency / concurrent writers [R]:** file metadata + upload
state machine: **D1 table with a single owning `files` worker/consumer** — reasoning: the
aggregate invariant (pending→ready per file) is a two-state transition driven by exactly one
event source (R2 notification), so a per-file DO is unnecessary; the queue consumer is the
serialized writer per file id (ordering key = file id). Bulk-delete = the same single writer.
This deliberately differs from documents (§5), whose aggregate carries versions/branches/
locations and earns a DO **[I]**.

**Cloudflare primitives with reasoning:** **R2** for bytes (presigned/multipart PUT minted by
RPC; sha-or-uuid keys per current scheme); **R2 event notifications → Queues →** metadata
writer (replaces S3-event Lambda hop, ruling 3a idempotent per (file id) [F: row says exactly
this]); delivery = `/files/{id}` worker route (HTTP-required surface per the ruled hybrid [F:
row/route-reconciliation §6]) issuing ranged reads with receipt checks, plus Cloudflare CDN
caching; **Cloudflare Images/Image Resizing** absorbs both `image_optimizer` and (if it
survives at all) remote-image laundering — the two old components collapse into one decision
[F: row]; unfurl = worker fetch behind safe-fetch (OD-6) + **deliberate cache decision**: Cache
API keyed by normalized URL with short TTL — chosen because the old system's cache absence was
an accident to not copy [F: row invites deciding deliberately] **[R]**; image-proxy port is
provisionally **zero** — revisit after the mailbox pass shows whether inline-image laundering
is still needed [F: row] → carried as a checkpoint, not an OD (the row already frames it).

**Projection/index strategy:** files metadata table is both authority and index (single
writer); per-entity attachment associations (email/chat) ride owning domains.

**API/RPC surface:** new `FilesApi` (metadata get, upload-intent → presigned PUT, delete,
bulk-delete) collapsing the 6-endpoint double mount under R3 [F: collision dies]; `/files/*`
HTTP delivery route; `UnfurlApi.card(url)` + bulk (RPC; the raw `/proxy` byte path only if
laundering survives — then as a distinct `/imgproxy/*` route, killing the path collision [F]).
Kernel coverage: none.

**Command/UI surface [F]:** CMD-L: upload flows ride `launcher`/`create-menu` rows and
block-level paste/drop (pointer-driven); no dedicated hotkey family (matches source).

**Authorization model:** file receipts derive from the owning context (email attachment →
mailbox receipt; chat attachment → chat receipt; standalone → owner) — the extractor-per-
context pattern from §2; `/files/*` route authenticates via short-lived signed URLs minted
against a receipt (bytes never behind ambient auth **[R]**); internal mount's service-key
callers become service bindings.

**Events/async:** upload finalize event; delete/GC events (email-attachment orphan sweep
becomes an alarm-driven GC lane, replacing the daily Lambda per 4a [F: Lambda family]);
idempotent by file id; poison uploads marked `failed` with deterministic reporting; replay =
re-emit R2 notification (safe).

**Migration (conditional OD-1):** *No live data:* shapes only — **but the DynamoDB table shape
must still be read before freezing the metadata schema** (G-006: the schema, not the data, is
the blocker; needs owner/production access either way — this is the one migration-section item
that survives even under ruling 8's no-data premise). *Data exists:* S3→R2 copy by key
(resumable, idempotent); DynamoDB→D1 ETL after harvest; CloudFront derivative keys regenerate
via Images (never copied).

**Parity tests:** 05-MAP proof (authorized fetch + safe unfurl adversarial suite: private-IP
hosts, redirect chains, lying Content-Length, oversized streams — the harvested hardening spec
is the fixture list [F]); pending→ready machine incl. crash between PUT and notification;
bulk-delete authz matrix; email-attachment GC.

**Observability/SLOs:** upload finalize lag (< 10s p95, shared with §5 **[R]**); delivery p95
(CDN hit rate); safe-fetch rejection counts (security signal); GC sweep metrics.

**Rollback:** metadata writer versioned; R2 immutable; delivery route independently
deployable; unfurl/imgproxy disableable without touching files.

**Dependencies / wave:** OD-6 (unfurl/proxy), §2, DynamoDB harvest access (owner). Files core:
**W2** (documents dependency); unfurl/image: **W7**.

---

## 17. Converter

**Owner ruling [F]:** **deliberate exception — the self-hosted converter remains** (01-AUTHORITY;
OD-2 records it into the ledger; the row's verdict slot is empty at the pin). Substrate ruling =
**OD-8** (Container vs external API vs drop — drop contradicts the exception and requires the
owner to reverse it). Must be ruled **with** the documents content-location model and ffmpeg
[F: row instruction].

**Source behavior evidence [F]:** `services/convert_service` 1,365 LOC; 3 internal endpoints
(`POST /internal/convert`, `POST /internal/backfill/docx`, `/health`), also queue-drivable
(`ConvertQueueMessage` + job_id); job shape is **bucket→bucket**
`{from_bucket,to_bucket,from_key,to_key}`; embeds LibreOffice via `rs-libreoffice-bindings` @
`056a40d` over Collabora `core-co-25.04` assets + MS core-fonts EULA in the Dockerfile;
producer of `DocumentContentLocation::ConvertedPdf` — the DOCX half of the documents content
model, not a side utility [F: G1/G3].

**User journeys:** upload a DOCX → converted PDF renders in the viewer; backfill a corpus of
docx conversions; conversion failure surfaces deterministically on the document (no silent
blank viewer).

**Invariants:** conversions are **deterministic per (input sha, converter version)** — output
keyed by `to_key`, idempotent re-runs (ruling 3a: "idempotent on `to_key`" [F: row]); the
converter never holds authority over any entity — pure R2-in/R2-out function; failures are
first-class results (deterministic failure reporting is the 05-MAP gate); font-metric parity
(the whole reason the EULA'd fonts exist [F]) — golden fixtures must be pixel/metric-tolerant
comparisons, not byte equality **[R]**.

**Entities and identifiers:** none owned. Job records live in the caller's domain (document
conversion state on the document aggregate §5).

**Authoritative state owner / consistency / concurrent writers:** callers own state; the
converter is stateless per job. Concurrency = queue parallelism; duplicate jobs collapse on
`to_key` idempotency.

**Cloudflare primitives with reasoning [R]:** **Cloudflare Container** running the same
LibreOffice/Collabora stack — reasoning: the exception mandates *self-hosted*; Workers cannot
run LibreOffice (no native substrate [F: "No Workers-native successor exists"]); a Container
preserves the pinned binding + assets + fonts with minimal behavioral drift, honoring
"faithful recreation" at the substrate boundary; Browser Rendering is *not* a substitute (it
renders HTML, not DOCX layout semantics — the caution in 04-TARGET's table **[I]**). Interface:
**Queues** in (job messages), **R2** in/out, small status callback event out — everything
around the container ports cleanly per the row [F]. The same container pattern is the named
option for **ffmpeg** (OD-8; §9) — one "media container" boundary doc can cover both **[R]**.
Exception governance: boundary/threat-model/capacity/observability/rollback doc required by
01-AUTHORITY rides ADR-012.

**Projection/index strategy:** none.

**API/RPC surface:** no public surface. Internal: queue contract + an admin backfill RPC
(service-key callers become service bindings/RPC). Kernel: none.

**Command/UI surface:** none direct (viewer behavior in §5's 18 associations).

**Authorization model:** not reachable from users; the container accepts jobs only from the
queue/service binding (no inbound internet); R2 credentials scoped to the two buckets
(least-privilege boundary — part of the exception's threat model **[R]**).

**Events/async:** job in → convert → `converted|failed{reason}` event out; retries: bounded
(conversion is deterministic — a failure repeats, so retry once for transient container churn
then poison **[R]**); poison = `failed` with reason class (the deterministic-failure gate);
replay = re-enqueue by (input sha) safely.

**Migration (conditional OD-1):** *No live data:* nothing — `ConvertedPdf` artifacts are
derivative. *Data exists:* **regenerate, never migrate** derivatives **[R]**; only if
regeneration cost is prohibitive, S3→R2 copy of existing outputs keyed identically.

**Parity tests:** the 05-MAP gate — golden conversion fixtures pass with deterministic failure
reporting; fixture corpus: representative DOCX set (fonts, tables, images, RTL, headers)
compared metric-tolerantly against old outputs; idempotent re-run; failure-class fixtures
(corrupt docx, unsupported feature).

**Observability/SLOs:** conversion p95 by size class; failure rate by reason class; container
health/restart counts; queue age. SLO: p95 < 30s for ≤10MB docx **[R]**.

**Rollback:** container image pinned + versioned (the LibreOffice pin is already exact [F]);
rollback = previous image; outputs immutable and re-generable.

**Dependencies / wave:** §5 (content model), OD-8, R2/Queues. **W7** (docx viewing lags core
documents; the exception doc lands with ADR-012 earlier).

---

## 18. Billing, onboarding, getting started

**Owner ruling [F]:** **Parked to the end (2026-08-19, Q19)** — "business chrome … David plans
something different there; its *primitives* still get documented from source as reference"
(Ledger header + §4 row). The 05-MAP gate: **owner-approved flow spec before implementation** —
nothing here is built in this program until that spec exists. This section therefore records
the primitives to *preserve* and the accidental-deletion tripwires only.

**Source behavior evidence [F]:** onboarding — 2 endpoints + 1 row (`user_onboarding`);
**read-triggers-work** polling GET (12s) that auto-starts import gathers per authenticated
connector (CAS-protected); post-OAuth reconcile hook; `POST /onboarding/complete` idempotent +
best-effort delete of unreserved staged candidates; **the real app-entry gate is the legacy
`User.tutorialComplete` boolean** (`PATCH /user/tutorial` on the auth service) — the dual gate
is "a bug to not recreate" [F: row verbatim]; two flow generations coexist behind a PostHog
flag. billing — entitlement is **role-driven, not usage-driven** (`read:professional_features`
gate seen in ai_projections paywall check [F]); Stripe webhooks ride the auth service [F:
auth row]; `stripe-payment-bot` is one of the two already-CF bot workers [F: G-019]. paywall/
getting-started splits + `business-chrome-primitives.md` document the mechanics [F].

**Mechanical primitives that must not be accidentally deleted (the 05-MAP charge):**
1. **Entitlement check primitive** — a role-derived capability gate (`read:professional_features`
   class) consulted by ai_projections, premium-model access (`ChatModelAccess` in streaming
   [F]); survives as a receipts-adjacent capability check in §2's core so callers keep
   compiling when the business layer is redesigned **[R]**.
2. **Stripe webhook ingress** — becomes `/hooks/stripe/*` under C2 whenever billing is
   designed; the payment-bot worker needs its G-019 disposition either way.
3. **Onboarding state row + connector-first flow shape** — the read-triggers-work poll is a
   substitute for kernel session push and will be **re-derived on C1**, not recreated [F: row];
   the CAS-protected one-auto-import-per-connector invariant is the piece worth keeping.
4. **Single entry gate** — whatever replaces the flow gets **one** completion gate, explicitly
   not the tutorialComplete/user_onboarding dual gate [F: bug-not-to-recreate].
5. **Kernel billing rows** — the Cloudflare-limits/top-up trio in RPC-L is `needs-review`
   (OD-301), adjacent to but distinct from product billing.

**Design placeholders (all conditional on the owner flow spec):** authority = per-user
onboarding lane in the User DO + team billing state in the Team DO **[R]**; Stripe as
gatekeeper/connector; entitlements evaluated in-process from role + plan snapshot (KV-cached,
authority in Team DO). No projections, no migration (nothing to migrate under either OD-1
branch — the row is per-user transient), parity = n/a until spec.

**Command/UI surface [F]:** CMD-L `onboarding.*` 11 rows (mock sidebar links ×5 expansion,
tutorial `cmd+k` swallow) — dispositions `defer` pending the redesign; getting-started/paywall
splits parked [F].

**Rollback/wave:** parked — **W-last**, after owner spec (10-DELIVERY item 9). Tripwire: no
other domain may hard-depend on onboarding rows (only on §1 identity + entitlement primitive).

---

## 19. Cross-domain summary tables

### 19.1 Authority and primitive selection (one line per domain)

| Domain | Authority (single writer) | Primary store(s) | Why (requirement, not name-matching) |
|---|---|---|---|
| Identity/teams | User DO (kernel) + Team DO | DO + D1 membership projection | serialized credential/role/invite mutations |
| Entity/access | owning-domain DOs + registry library | D1 registry + access index | registry must equal authority; no global hot-key DO |
| Splits/routes | client (URL codec) + User DO ui-state | — | no server invariant to serialize |
| Soup | projection consumer (derived) | D1 index family | cross-aggregate SQL reads; DO fan-out prohibited |
| Documents/projects | DO per document / per project | DO + R2 + D1 projections | versions/branches/lifecycle + pending→ready serialization |
| Tasks/properties | schema: team DO; values: entity DO | DO + D1 value index | 2a ruling; bulk shapes; tag-merge serialization |
| Channels | DO per channel | DO log + D1 projections | total message order per channel |
| Mailbox | DO per email account | DO checkpoints + D1 threads + R2 MIME | per-account sync cursor + send fencing |
| Calendar/calls | account-DO lane; DO per live call | D1 + R2 media | provider mirror; live-call lifecycle |
| CRM | DO per team (CRM lane) | D1 rows + KV directory | derived-vs-manual write races serialize per team |
| Search | indexing consumers (derived) | D1 FTS5 | lexical parity; no vector requirement proven |
| Activity/favorites | queue consumer (append-only) + User DO | D1 log + User DO collections | idempotent-by-id log; per-user small state |
| Notifications | DO per user (notification lane) | DO + Queues | per-recipient dedupe/unread serialization |
| Agents/AI | kernel Overseer/session DOs + User-DO lanes | kernel + D1 rollups + AI Gateway | ruled: kernel is the one runtime |
| Webhooks/integrations | DO per webhook endpoint; Team DO installs | DO + D1 status projections | per-endpoint ordering + retry ladder + dedupe |
| Files/unfurl/image | files metadata consumer | R2 + D1 metadata | two-state machine needs one writer, not a DO per file |
| Converter | stateless container jobs | R2 in/out | self-hosted exception; idempotent on to_key |
| Business chrome | parked (User/Team DO lanes reserved) | — | owner spec pending |

### 19.2 Where the kernel already provides the surface (RPC-L mapping)

- Kernel-native, adopt as-is (178 preserve rows): auth/session (PublicApi 8, LoginAttempt 1,
  AuthenticatedApi 51, AdminApi 16), agent/AI runtime (Overseer 64+1, AiChatSubscriber 7,
  ActionsSubscriber 2, CodeSubscriber 2, ConsoleLog 1), gadget/workpiece (GadgetClient 12,
  WorkpieceClient 4, WorkpiecesSubscriber 3), connectors (GatekeeperClient 3,
  ConnectedAccountsSubscriber 3, ObserverConfigCallback 1), presence (PresenceSubscriber 3).
- 4 needs-review rows → OD-301.
- Wrapper-new namespaces (no kernel coverage; ADR-002 extension path): TeamsApi, SoupApi,
  DocumentsApi, ProjectsApi, PropertiesApi, ChannelsApi, BotsApi, MailApi, CalendarApi,
  CallsApi, RemindersApi, CrmApi, SearchApi, ActivityApi, FavoritesApi, PinsApi, HistoryApi,
  NotificationsApi, WebhooksApi, ConnectorsApi, AutomationsApi, ImportApi, MemoryApi,
  AiAdminApi, FilesApi, UnfurlApi.
- HTTP-only (physical protocol, C2/R3 exceptions): `/hooks/{github,channels,gmail,livekit,
  stripe,oauth,unsubscribe}/*`, `/files/*`, `/chat/completions` (exception), lifted-service
  mounts per L1, deferral-B auth mounts (OD-16; no dedicated auth ADR).

### 19.3 Verified-fact / inference / recommendation / owner-decision separation

- **Verified facts:** every [F] above traces to `reports/00`, `reports/01` §5.1, the WP-020
  notes, or a Ledger row read at `13c2847`; no new source audit was silently introduced.
- **Inferences:** marked [I] inline (12 instances; the load-bearing ones: registry-as-projection
  hot-key argument §2; CRM per-team granularity §10; no-vector-requirement §11; files
  no-DO-per-file §16).
- **Recommendations:** marked [R] inline; all SLO numbers are [R] placeholders for the domain
  passes to confirm against measured source behavior.
- **Owner decisions:** pre-existing OD-1…OD-10 honored as constraints; **new: OD-301…OD-306**
  in `reports/notes/wp030-arch-owner-decisions.md`.

### 19.4 Conditionality register (what changes if pending decisions flip)

| Decision | Sections held conditional |
|---|---|
| OD-1 (live data) — **RULED 2026-08-20: Branch A, no live data** | every §-Migration collapses to the no-live-data branch (§0.8 item 1); DynamoDB harvest (§16) → shape-from-code acceptable |
| OD-3 (notifications verdict/push) — **RULED 2026-08-20: keep, in-app + digests; push deferred** | §13 push module stays out of pass 1; §7 mention delivery depth; §15 GitHub types |
| OD-4 (P1 centerpiece order) — **RULED 2026-08-20: confirmed; governed data ingress; first track of 4a post-slice** | §14/§15 ordering fixed per 05 §4; part-B build graph |
| OD-6 (safe-fetch) | §15 outbound delivery; §16 unfurl/image; §10 enrichment fetches |
| OD-7 (task/thread entities) — **RULED 2026-08-20: task = document facet; thread = EmailThread** | §6 index schema (facet column) frozen; §5 facet model confirmed; §2 ontology finalized on the 16 variants |
| OD-8 (converter/ffmpeg substrate) | §17 substrate; §9 previews; §5 docx machinery |
| OD-2 (exceptions into ledger) | §11, §14, §17 exception governance docs |
| OD-301…OD-306 | as listed in the notes file — merged into `reports/06-owner-decisions-needed.md` (registry of record) as: OD-301→OD-12(b), OD-302→OD-27, OD-303→OD-21, OD-304→OD-28, OD-305→OD-29, OD-306→OD-30 |

*End of part A. Part B (`reports/05-implementation-build-graph.md`) owns the dependency DAG,
critical path, slice comparison, and kernel-gap budget estimate.*
