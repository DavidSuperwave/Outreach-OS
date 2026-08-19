# Cloud-agent handoff — Nuewave × Outreach-OS merge

> Written 2026-08-19, at the end of the **ruling session** (all five ruling
> batches A–E ruled or explicitly deferred by David). This file is the
> single entry point for an agent picking up the merge from a **fresh
> environment** (cloud agent, new machine, or new session). It tells you:
> what the merge is, what is already done, what remains, how to rebuild the
> working environment, and where every load-bearing pointer lives.
> Pair it with `next-agent-prompt.md` (the paste-ready kickoff prompt).

---

## 0. What this project is, in three sentences

**Neuwave** (old platform: Rust/AWS backend, SolidJS frontend, one Postgres)
is being **fully absorbed** into **Outreach-OS** (Cloudflare-native, built
on the `cloudflare-os` kernel). Every old capability gets exactly one
verdict — rebuilt CF-native or explicitly killed — recorded in a ledger
that will eventually be turned into one Linear project ("Nuewave T").
Nothing keeps running on AWS; no live data migrates, but schemas, endpoints,
and UX are harvested from the pinned source as design input.

## 1. Environment reconstruction (do this first on a fresh machine)

| Repo | GitHub | Role | Setup |
|---|---|---|---|
| Build repo | `DavidSuperwave/Outreach-OS` | All work lands here; the merge docs live in `docs/plans/nuewave-native/` | clone; `git submodule update --init cloudflare-os` (public: `cloudflare/cloudflare-os`) |
| Reference repo | `DavidSuperwave/Neuwave` | Read-only harvest source | clone as a **sibling** dir named `Neuwave`; then `git checkout 9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` |

- **The pin is law.** Every `[NW]` pointer in the merge docs resolves against
  `Neuwave@9f7a26b`. Never cite a movable branch. (`origin/main` == the pin
  as of 2026-08-19, but check out the SHA anyway.)
- **Access:** `DavidSuperwave/Neuwave` is under David's account — a cloud
  agent needs read access granted to it before it can do research work.
- Local paths in older docs (`C:\Users\Kecin\Projects\...`) translate to
  wherever you cloned; only the *relative* pointers (`crates/...`,
  `services/...`, `apps/web/...`) matter.
- Neuwave repo shape at the pin: `apps/` (SolidJS web app), `crates/`
  (hexagonal Rust domains — HTTP inbound usually `src/inbound/axum_router.rs`),
  `services/` (composition roots), `packages/` (SDK/clients),
  `static_assets/schema.graphql`, `infra/`, `docker/`, `docs/`.

## 2. Read order (all under `docs/plans/nuewave-native/`)

1. `merge/README.md` — the eight base rulings, the pin, the folder map.
2. `merge/agent-brief.md` — binding rules (tripwires, pointer pinning,
   source-over-Linear, verdicts-are-David's) + the Linear scope-map contract.
3. `merge/merge-ledger.md` — **the ledger of record**: one row per
   capability; ✔ = ruled, ◐ = researched awaiting ruling, ☐ = open.
4. `merge/pattern-review.md` — the four data patterns, **all ruled** (see §3).
5. `merge/route-reconciliation.md` — unified route map, **batches A–C ruled**.
6. `merge/audits/` — connectivity-layer, CRM, company-mailbox deep audits.
7. `merge/business-chrome-primitives.md` — billing/onboarding/getting-started
   mechanics, reference-only.
8. `merge/endpoint-inventory-backend.md`, `endpoint-inventory-frontend.md`,
   `schema-harvest.md` — the inventories (never regenerate; each states its
   own coverage caveats).
9. `../MISSION.md`, `../roadmap.md` §Status log — parent context; the
   "ruling session" entry is the latest state.

## 3. What is DONE (as of 2026-08-19)

**Foundation rulings (start of 2026-08-19):** full absorption; harvest
rules (two tripwires only: no Macro branding, no Rust code reuse);
keep-faithful default; channels full; Soup UX on native RPC (graphql_soup
killed); split-layout shell; CRM + mailbox in pilot;
calls/calendar/reminders/activity kept; real multi-tenant auth rebuilt
(FusionAuth dead, CF Access rejected); kernel is the one agent runtime;
five invariants preserved; agent connectivity layer = P1 centerpiece;
business chrome parked-prepare.

**Research pass (merge review):** four-pattern review, route
reconciliation (20-item collision register), three P1 audits
(connectivity/CRM/mailbox), inventories, two premise corrections
(contacts_service ≠ CRM; old team's handoff docs don't exist at the pin).

**Ruling session (this session) — all five batches closed:**

| Ruling | Verdict (all 2026-08-19, recorded in ledger + dated "Ruled:" lines) |
|---|---|
| D1 entity glue | **1a** — keep `Entity=(type,id)` ontology; storage rebuilt: DOs/typed-storage + entity registry (existence/tombstones) + **required** materialized-index layer; riders: settle TEXT/UUID id format first; access policy stays per-type code |
| D2 properties | **2a** — keep definitions/options/tagged-values/system-key semantics exactly; values live on the entity record; filter-index layer is first-class design; riders: entity-type canonicalization first; property-write side effects get pattern-3 treatment |
| D3 outbox | **3a** — discipline not tables: intent record + alarm in-DO; idempotent consumers; poison-pill mark-and-skip |
| D4 leases | **4a** — DO single-writer + alarms; no ported claims/dispatchers; external-mutation fencing + idempotency keys kept as DO-local state; shared-alarm discipline for multi-job DOs |
| A1 surface | **R3 hybrid** — RPC-first via `/api`; small explicit HTTP surface only where physically required (webhooks, WS, file GETs, `/.well-known`) |
| A2 mounts | **L1** — router strips lifted prefixes; services stay byte-for-byte; `/sync` `/lexical` `/ai-editing` confirmed |
| A3 lift set | **coding-agent-worker dropped** — all-refs/all-history search of both repos proved no source was ever committed and it was never a CF Worker (lockfile = `daytona-bun-hello`, a local Bun/Daytona/Ink prototype). Lift set = **three** services. Future coding-agent capability = new ☐ ledger row (new scope on the kernel agent runtime, not a lift) |
| B auth mount | **Deferred** to auth design time (recorded ruling); `/auth/*` stays reserved in the route map |
| C1 live push | connection_gateway **superseded** by kernel `/api` session push; its event types become kernel session events at domain design time |
| C2 webhooks | **`/hooks/<source>/*`** unified ingress; router dispatches by source |
| C3 well-known | **Deferred** to the native-app-links / first-party-MCP-host rows |
| E contacts_service | **Keep as its own capability, in the pilot** — standalone user↔user connections graph (NOT CRM), mention/share-suggestion feeder |

Also done: `business-chrome-primitives.md` (Q19 parked-prepare — billing is
DB-role-driven via `read:professional_features`, Stripe webhook rides on
authentication_service; onboarding = one `user_onboarding` row served via a
crate mounted on document_cognition_service; getting-started is
frontend-only localStorage).

## 4. What REMAINS (the pipeline, in order)

1. **Research the still-open ☐ ledger rows** (research columns only — no
   verdicts; that's the next agent's main work). Highest-leverage first,
   per David: **documents, projects, properties, search_service,
   connection_gateway internals, the Lambda/batch families** (~20 handlers,
   never extracted — the known inventory hole). Full open list: favorites,
   foreign_entity, webhook, bots, github, DSS-native chrome
   (activity/pins/recents/…), memory, import, onboarding, ai_usage,
   ai_projections, streaming/completions, notification_service,
   static_file_service, unfurl_service, image_proxy_service,
   search_processing_service, scheduled_action, convert_service,
   analytics-proxy, future-coding-agent row, most frontend ◐ rows, most
   block types, most table groups.
2. **David rules those rows in batches** (grill-style, concrete options —
   same format as the ruled batches; agents present, never rule).
3. **Resolve the two deferrals at design time:** B (auth mount — with the
   auth architecture; token custody question from the mailbox audit lands
   here too) and C3 (`/.well-known` — with the native-app-links/MCP-host
   rows).
4. **Linear scope-map pass** (only when every row is ✔): contract in
   `agent-brief.md` — one new Linear project "Nuewave T" (team Superwave),
   issues generated from ledger rows carrying old-source pointers +
   CF-targets; archive the two old projects only after explicit
   confirmation.
5. **Build**, domain by domain, under the ruled patterns and route model.

## 5. Key code references (the load-bearing pointers)

**Kernel (`cloudflare-os` submodule, `[CF]`):**

| What | Where |
|---|---|
| Router model (`/api/*`, `/gatekeeper/<name>/*`) | `packages/router/src/index.ts` |
| Per-user DO, mirrored outputs index (the materialized-index idiom D1 needs) | `packages/workshop-backend/src/user.ts:151-220` |
| Overseer: durable job registry, resume-on-construct, shared recomputed alarm, DO-native outbox (the D3/D4 idioms) | `packages/workshop-backend/src/overseer.ts:505-510,826-843,1216-1236,3631-3638` |
| Typed storage (collections, secondary indexes, one-DO transactions) | `packages/typed-storage/src/index.ts:319-331,452-585` |
| Gatekeeper authoring | `.agents/skills/write-gatekeeper/SKILL.md` (note: `packages/custom-gatekeeper` does **not** exist — gatekeeper-github is the registration reference) |

**Neuwave (`[NW]` @ `9f7a26b`):**

| What | Where |
|---|---|
| The Entity ontology (16-variant enum, 56 dependent crates) | `crates/model-entity/src/lib.rs:34-68`; per-type access rules `:73-101` |
| EAV property tables + JSONB query recipes | `crates/macro_db_client/migrations/20251030100000:5-178`; system keys `crates/system_properties/.../system_property_key.rs:80-103` |
| Soup dynamic SQL (the cross-entity list engine to be replaced by the index layer) | `crates/soup/src/outbound/pg_soup_repo/expanded/dynamic.rs:53-63,930-938,1055-1065` |
| Outbox drain contract (idempotent consumers, poison-pill rule) | `services/email_service/src/calendar_outbox.rs:37-39,214-219` |
| Fencing external mutations (the one lease piece that survives) | `crates/calendar_events/src/outbound/pg.rs:1452-1494,1592-1655` |
| Lifted services (the three) | `services/sync-service/src/cf_worker.rs:118-134`; `services/lexical-service/src/index.ts:97-120`; `services/ai-editing-worker/src/endpoints/edit.ts:98` |
| Entity-type canonicalization pain report (D2 rider) | `docs/PROPERTY_TARGET_ENTITY_TYPE_PLAN.md` |
| One migration stream (the "four databases" are one) | `crates/macro_db_client/migrations/` (267 files, 198 live tables) |

Illustrative anchor — the ontology D1 keeps (read as reference only; no
Rust is ever ported):

```rust
// [NW] crates/model-entity/src/lib.rs:34-68 (abridged)
pub enum EntityType { Chat, Document, Project, EmailThread, Call, /* …16 variants */ }
pub struct Entity { pub entity_type: EntityType, pub id: EntityId }
```

And the kernel idiom that replaces outboxes/leases (D3/D4):

```ts
// [CF] packages/workshop-backend/src/overseer.ts (shape, not verbatim):
// write intent record + this.ctx.storage.setAlarm(t) in the SAME event
// (atomic via the DO output gate); alarm() retries delivery, recomputes
// the next shared alarm from all pending work; consumers are idempotent.
```

## 6. Rules that bind every agent (full text in `agent-brief.md`)

1. Two tripwires: **no Macro branding**, **no Rust code reuse** (three
   lifted CF services excepted; reading Rust as reference is allowed).
2. Every pointer pins: `path/from/clone/root:line` against `9f7a26b`.
3. **Verdicts are David's.** Research fills every column except `Verdict:`.
   Present options; never rule; never simulate rulings if David is absent.
4. No Linear writes until the scope-map pass is explicitly ordered.
5. Slices state their coverage — silent truncation poisons the audit.
6. Source over Linear: code at the pin is the only authority on what
   exists.
7. Never delete or regenerate the ledger, the inventories, or the
   platform-context reference set; never delete unchosen options from
   review docs.
8. Git: the merge docs were working-tree-only until David ordered them
   committed (2026-08-19). Committing new doc updates on the designated
   docs branch is fine; nothing else gets committed without an explicit
   order.

## 7. Known coverage caveats (inherit, do not re-trust)

- Backend inventory: ~20 queue/Lambda workers + TS-service internals never
  extracted; some DSS handlers from registration lines only.
- `PublicApiImpl`'s RPC method surface never enumerated — the R3 model's
  method-namespace design needs it at domain-design time.
- Soup dynamic SQL ~90% unread; `upsert_message.rs` body unread.
- Schema harvest: 4 created-then-dropped tables; TEXT→UUID migration
  half-finished in source.
- Frontend inventory: stale `organization` client entry; 7 legacy settings
  slugs outside nav groups.
- Concept docs in `../reference/platform-context/` still say "four
  databases" — the one-physical-DB finding wins.
- Each merge doc's final Coverage section binds anyone building on it.
