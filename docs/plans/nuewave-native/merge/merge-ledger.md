# Merge ledger — every capability, one verdict

> Created 2026-08-19. The backbone of the merge audit (ruling 7: re-audit
> everything). One row per capability at the granularity a verdict is about.
> `Verdict:` slots are filled **only by David's dated rulings** — everything
> else in a row is research and may be refined by agents. Prior verdicts from
> the concept-only docs are recorded as *provisional* and carry no authority.
>
> Row lifecycle: `☐ unresearched` → `◐ researched` (pointers + proposal
> filled, cross-refs to the inventories) → `✔ ruled` (verdict + date).
> When every row is `✔`, this file plus dates is the final audit the Linear
> scope-map agent builds "Nuewave T" from.

Pinned source: `DavidSuperwave/Neuwave@9f7a26b` — see `README.md`.
Cross-refs: `endpoint-inventory-backend.md` (EB), `endpoint-inventory-frontend.md` (EF), `schema-harvest.md` (SH).

> **Default ruling (2026-08-19, Q19):** every row not explicitly ruled or
> parked is **KEEP — faithful recreation**. Kills happen only by explicit
> ruling (so far: `graphql_soup`, FusionAuth, and the AWS substrate itself).
> **Parked to the end:** the business chrome — billing/paywall, onboarding,
> getting-started — because David plans something different there; its
> *primitives* (how the old flows/pricing/first-run mechanically work) still
> get documented from source as reference for that redesign.

## 1. Backend domains — DSS composition root (`/dss`)

Mounted domain crates per `../reference/platform-context/platform-canvas.md`;
pointers to be verified against `services/document_storage_service` and
`crates/*` during research.

| St | Capability | Old source | What it is | Provisional (old docs) | Proposed CF target | Verdict |
|---|---|---|---|---|---|---|
| ☐ | documents | `crates/documents` | Document entities & storage | Keep | DO typed-storage + R2 | — |
| ☐ | projects (=folders) | `crates/projects` | Project/folder tree; Project=Folder invariant | Keep | DO typed-storage | — |
| ✔ | channels | `crates/channels` | Channels containers | ~~Conflict: keep-thin vs drop~~ | DO-backed channels + messaging | **Keep full — faithful recreation incl. messaging surface (2026-08-19)** |
| ✔ | soup | `crates/soup` | The list/feed engine behind Soup lists | Keep (thin) | Typed RPC + DO queries, WebSocket push | **Faithful UX on native data (2026-08-19)** — list behavior recreated exactly; substrate is CF-OS-native |
| ✔ | graphql_soup | `crates/graphql_soup` | GraphQL surface over soup | — | — | **Killed (2026-08-19)** — internal wire detail; replaced by typed RPC per soup ruling |
| ☐ | search_service | `crates/search_service` | Search API over OpenSearch | Defer | D1 FTS5 + Vectorize | — |
| ☐ | properties | `crates/properties` | Property system (system + custom props) | Keep | DO typed-storage | — |
| ✔ | crm | `crates/crm` | Companies/contacts CRM — **audited 2026-08-19**: mounted at `/crm` in DSS; email-traffic-derived (populate/depopulate off `email_links`); domain-keyed companies per team; EAV Stage/Owner/Revenue (companies only, contacts have none); global Apollo-backed domain directory; hidden/email_sync/killswitch machinery. Full audit: `audits/crm-audit.md`. | Keep | DO/D1 | **Keep, in the pilot (2026-08-19).** What the new CRM actually contains is decided by David + agent at design time from what the source really does. |
| ✔ | call | `crates/call` | Calls (LiveKit) | ~~Drop~~ | LiveKit stays external; call domain on DO/D1 | **Keep (2026-08-19)** |
| ☐ | favorites | `crates/favorites` | Favorites/stars | — | Cheap DO row | — |
| ✔ | reminders | `crates/reminders` | Reminders | ~~Drop~~ | DO alarms / kernel scheduler | **Keep (2026-08-19)** |
| ☐ | foreign_entity | `crates/foreign_entity` | External-entity mirror (GitHub etc.) | — | TBD | — |
| ☐ | webhook | `crates/webhook` | Webhook ingestion | — | Workers routes | — |
| ☐ | bots | `crates/bots` | Bot registry | — | Gatekeeper/agent identity model | — |
| ☐ | github | `crates/github` | GitHub integration | Keep (verifier path) | Gatekeeper | — |
| ✔ | calendar_events / cal | `crates/calendar_events`, `crates/cal` | Calendar (sync coupled to email accounts) | ~~Drop~~ | Workers sync + DO/D1 | **Keep (2026-08-19)** |
| ✔ | sync_service (domain) | `crates/sync_service` + `services/sync-service` | Loro CRDT sync (already CF) | — | Lift as-is | **Lift (2026-08-19)** — see §3 CF-services ruling |
| ☐ | DSS-native: activity, pins, recents, history, annotations, saved-views, entity-access | `services/document_storage_service` | Cross-entity chrome | — | Per-item rows if kept | — |

## 2. Backend domains — DCS composition root (`/cognition`)

| St | Capability | Old source | What it is | Provisional | Proposed CF target | Verdict |
|---|---|---|---|---|---|---|
| ✔ | chat | `crates/chat` | Chat threads/messages + streaming | Keep | Faithful UX over kernel sessions | **Kernel runs, old UX on top (2026-08-19)** — chat experience recreated as surfaces over kernel sessions |
| ✔ | agent | `crates/agent` | Agent runtime | Replaced | CF-OS kernel agent loop | **Kernel is the one agent runtime (2026-08-19)** |
| ✔ | ai_tools / ai_toolset | `crates/ai_tools`, `crates/ai_toolset` | Tool defs; **frozen ai_toolset invariant** | Keep frozen | Gatekeeper session APIs | **Semantics recreated as Gatekeeper session APIs, mapped piece-by-piece factually from source (2026-08-19)** |
| ☐ | memory | `crates/memory` | Agent memory | — | Context/DO storage | — |
| ☐ | import | `crates/import` | Import pipelines | — | TBD | — |
| ☐ | onboarding | `crates/onboarding` | Onboarding flows | — | Likely killed | — |
| ☐ | ai_usage | `crates/ai_usage` | Usage metering | — | AI Gateway analytics | — |
| ☐ | ai_projections | `crates/ai_projections` | AI-derived projections | — | TBD | — |
| ◐ | mcp_client | `crates/mcp_client` | MCP client — audited 2026-08-19: Streamable-HTTP only via rmcp, per-user servers, AES-GCM creds, 3-strategy OAuth (pre-reg/CIMD/DCR), searchable tool catalog (schemas never in prompt), CRUD at `/mcp/servers*` in DCS. See `audits/connectivity-layer-audit.md` §A1. | Replaced | `gatekeeper-mcp` (+ mcp-shared covers most of this already) | — |
| ☐ | streaming/completions (native) | DCS root | `POST /stream/chat/message` etc. | Keep | Kernel streaming | — |

## 3. Standalone services & processes

| St | Capability | Old source | What it is | Provisional | Proposed CF target | Verdict |
|---|---|---|---|---|---|---|
| ✔ | authentication_service | `services/authentication_service` | Real multi-tenant auth (`/auth`, ~79 endpoints): sessions, signup/login, OAuth, teams, invites, permissions; FusionAuth backend; Stripe webhooks ride on it | ~~Replaced by Access~~ | Workers + DO/D1; identity backend chosen at design time | **Rebuild real auth Cloudflare-native (2026-08-19).** FusionAuth stays dead; Access is not the auth model. |
| ✔ | connection_gateway | `services/connection_gateway` | WebSocket fan-out — WS upgrade at literal `GET /` (`src/api/connection/mod.rs:34`), JSON protocol (track_entity/stream_events, carries AI stream + email refresh events) | Replaced | DO hibernatable WebSockets; `route-reconciliation.md` §5 proposes supersede-by-kernel-`/api`-session (ruling C1) | **Superseded by kernel `/api` session push (2026-08-19, ruling C1)** — its event types become kernel session events at domain design time; no dedicated `/ws` service |
| ✔ | email_service (company mailbox) | `services/email_service` | Mailbox (`/email`), **24** `email_*` tables live at pin (audit corrected from 26), Gmail push sync (watch→GCP Pub/Sub→webhook), two-phase Gmail-API send w/ undo (no SMTP), Redis backfill counters, delegation + shared-inbox promotion. Full audit: `audits/company-mailbox-audit.md`. GCP Pub/Sub stays a hard dependency. | ~~Drop (Instantly instead)~~ — framing corrected 2026-08-19 | Workers + Queues (sync), DO/D1 (threads), R2 (attachments) | **Keep, IN the pilot — full faithful recreation incl. send (2026-08-19)** |
| ✔ | **Agent connectivity layer** (new — replaces the "Instantly read-only" framing) | new concept; seams: `gatekeeper-mcp`, kernel session APIs; old analogues `crates/mcp_client`, `crates/import` (gather/staging ledger — strongest analogue), `crates/foreign_entity`, `features/integrations`. Full audit: `audits/connectivity-layer-audit.md` (9-gap delta; no Instantly connector exists in either codebase; old catalog = hardcoded FE constant) | Composio-style MCP + API linking so agents pull external data into the workspace (Instantly = first source) | — | Gatekeeper connectors + MCP catalog | **Build as the P1 outreach centerpiece (2026-08-19, per David's clarification)** |
| ☐ | notification_service | `services/notification_service` | Notifications (`/notification`) | Drop | — | — |
| ✔ | contacts_service | `services/contacts_service` | **Research correction (2026-08-19 audit): NOT CRM** — a user↔user connections graph (`contacts_connections(user1,user2)`, SQS-fed from channel membership + auth events; `crates/contacts/src/inbound/http.rs:217-245`). The CRM has no dependency on it. See `audits/crm-audit.md` §A3. | Keep (CRM) | Standalone user-connections graph, CF-native | **Re-ruled (2026-08-19, batch E): keep as its own capability, in the pilot** — rebuilt CF-native as a standalone user↔user connections graph (mention/share-suggestion feeder), independent of CRM; supersedes the wrong-premise "keep with CRM" verdict |
| ☐ | static_file_service | `services/static_file_service` | File serve (`/static-file`) | Replaced | R2 + Workers | — |
| ☐ | unfurl_service | `services/unfurl_service` | Link unfurl | — | Worker fetch | — |
| ☐ | image_proxy_service | `services/image_proxy_service` | Image proxy | — | Workers/Images | — |
| ☐ | search_processing_service | `services/search_processing_service` | Async indexer | Defer | Queues + D1/Vectorize | — |
| ☐ | scheduled_action | `services/scheduled_action` (verify) | Scheduled jobs | Replaced | Kernel scheduler / DO alarms | — |
| ☐ | convert_service | verify path | Document conversion | — | TBD | — |
| ◐ | mcp_service + mcp_auth_proxy | `services/mcp_service`, `services/mcp_auth_proxy` (verified) | Macro-as-MCP-server (first-party toolset to external agents) + an OAuth 2.1 broker that exists **because FusionAuth lacks DCR** (`mcp_auth_proxy/README.md:1-6`) — substrate-motivated; FusionAuth is dead. See `audits/connectivity-layer-audit.md` §A2. | Replaced | `gatekeeper-mcp`; the auth-proxy role dissolves with the auth rebuild | — |
| ✔ | sync-service (deployable) | `services/sync-service` (Rust/WASM, DO+D1, 18 routes, WS) | Collaborative-editing sync — already Cloudflare | — | Lift as-is (WASM exception to the no-Rust rule) | **Lift all four CF services (2026-08-19).** Integration requirement: their routes must be reconciled into the unified CF-OS route model — the old build conflict was these services syncing against AWS-side routes; now route/service alignment is a first-class design task of the rebuild. |
| ✔ | lexical-service / ai-editing-worker | CF Workers in repo | Editor AI — already Cloudflare | — | Lift as-is | **Lift (2026-08-19)** — same route-reconciliation requirement |
| ✔ | coding-agent-worker | ~~CF Worker in repo (TS)~~ **Research corrections (2026-08-19): EMPTY at the pin**, and a full history/all-refs search of both repos found **no source ever committed anywhere**; the lockfile (`name: daytona-bun-hello` — Bun + Hono + Daytona SDK + Ink CLI, zero Cloudflare deps) was a swept-in local prototype artifact and **was never a Cloudflare Worker**. The commit that added it delivered `crates/agent_runtime_protocol` (WS/ACP server half, Rust). See `route-reconciliation.md` §4. | ~~Agent runtime worker — already Cloudflare~~ (mislabel from a hedged platform-canvas doc line) | — | ~~Lift~~ nothing to lift | **Re-ruled (2026-08-19, route ruling A3): dropped from the lift set** — the lift set is three services (sync, lexical, ai-editing); supersedes the "Lift" verdict, which had no object. Future intent tracked in the row below. |
| ☐ | Coding-agent capability (future) | Reference only: `crates/agent_runtime_protocol` (Rust WS/ACP server half) + the dropped worker's bun.lock revealing the intended design (Bun + Hono + Daytona sandboxes + Zed agent-client-protocol + Ink CLI) | Sandboxed coding-agent runtime — never built in Neuwave | — | If ever wanted: new scope designed on the kernel's own agent runtime, not a lift | **Marked future-only (2026-08-19, ruling A3)** — not pilot scope; no old system exists to recreate |
| ☐ | analytics-proxy | verify path | PostHog proxy | Replaced | OS feature-flags/analytics stance | — |
| ✔ | transcription (LiveKit sidecar) | verify path | Call transcription | ~~Drop~~ | TBD at design time | **Keep with calls (2026-08-19)** |
| ☐ | Lambda/batch families (~20 handlers, 7 families) | `infra/`, verify | Ingestion, search, cleanup, email ops, media, retention, AI projections | Never mapped | Queues + DO alarms + Workers, per family | — |

## 4. Frontend surfaces — routes & splits

From EF §1–2 (27 routes, 28 registered splits; 24 dev-only splits excluded —
collective row at bottom). The split-layout model itself (`/*splits` encoding
alternating `{type}/{id}` pairs) is its own row: it is the old shell's core
navigation idea and the shell plan flagged it as a conflict with CF-OS's
simpler routing.

| St | Capability | Old source | What it is | Verdict |
|---|---|---|---|---|
| ✔ | Split-layout engine | `apps/web/src/components/app/split-layout/`, `Root.tsx:223` | Multi-pane `{type}/{id}` navigation model — the shell's spine | **Recreate faithfully as the new app's shell, on CF-OS's frontend (2026-08-19).** Supersedes the shell plan's Gatekeeper-App-vs-custom-shell question. |
| ✔ | Soup list engine (SoupView) | `apps/web/src/features/next-soup/` | The unified list engine: filters, sorting, presets, sidebar; backs 10 of the splits | **Recreate faithfully; data via native RPC not GraphQL (2026-08-19)** |
| ◐ | `home` | `features/home` (EF :53) | Chat-first landing view with composer | — |
| ◐ | `inbox` | `features/next-soup` (EF :55) | Unified inbox list | — |
| ◐ | `tasks` + `task-compose` | `features/next-soup` (EF :64), `features/block-md` (:75) | Task list + composer — the Work-tab heart (SUP-493/495) | — |
| ◐ | `agents` | `features/next-soup` (EF :61) | Agents/automations list | — |
| ✔ | `mail` + `email-compose` | `features/next-soup` (EF :62), `features/block-email` (:74) | Email list + composer | **Keep — mailbox ruled keep-in-pilot (2026-08-19)** |
| ◐ | `documents` / `files` / `folders` | EF :63/:68 | Files and folder lists | — |
| ✔ | `channels` + `channel-compose` + `non-member-channel` | EF :65/:73/:72 | Channel list, composer, join prompt | **Keep — channels ruled keep-full (2026-08-19)** |
| ✔ | `companies` (CRM view) | `features/next-soup` + `features/companies` (EF :67) | CRM saved views | **Keep — CRM ruled keep-in-pilot (2026-08-19)** |
| ◐ | `search` | EF :69 | Search results list | — |
| ✔ | `calendar`, `reminders`, `calls`, `activity` | EF :56–58, :66 | Flag-gated secondary views | **Keep all four (2026-08-19)** |
| ◐ | `settings` (12 active tabs, 3 groups) | `features/settings`, `settingsTabsConfig.tsx:48` (EF §6) | Account/Billing/Appearance/Team/Tags/CRM/Connections/MCP/Bots/Admin… | — |
| ◐ | Command menu / launcher | `features/command/CommandMenu.tsx`, `Launcher.tsx` | Cmd-K command surface | — |
| ✔ | Auth screens (login/signup/invites) | `features/auth`, `team-invitations`, `channel-invitations` | Auth UI | **Keep — real-auth ruling (2026-08-19)** |
| ◐ | `getting-started`, onboarding (`setup`), paywall | `features/getting-started`, `setup`, `onboarding`, `paywall` | First-run and billing chrome | **Parked to end (2026-08-19)** — something different planned; document primitives from source as reference |
| ◐ | `import-linear` + integrations | `features/integrations/` | Linear import, MCP setup | — |
| ◐ | Entity layer + property system + sharing + favorites | `features/entity`, `features/property`, `features/sharing`, `features/favorites` | Cross-cutting UI infrastructure behind blocks/lists | — |
| ◐ | Dev-only splits (24) | EF §2 dev lists | Debug/playground pages | — (default: not recreated) |

## 5. Block types (16 concrete + aliases)

From EF §3; definitions at `apps/web/src/features/block-*/definition.ts`,
registry `apps/web/src/lib/core/block.ts:50`. Aliases: `csv`→code;
`task`/`snippet`/`skill`→md (so Task is an md-block flavor — matters for the
task model design). `write` is virtual; `unknown` is the fallback.

| St | Block | Old source (definition) | Verdict |
|---|---|---|---|
| ◐ | `md` (+ task/snippet/skill aliases) | `features/block-md/definition.ts:26` | — |
| ◐ | `chat` (AI chat) | `features/block-chat/definition.ts:18` | — |
| ✔ | `channel` | `features/block-channel/definition.ts:6` | **Keep — channels ruled keep-full (2026-08-19)** |
| ✔ | `email` | `features/block-email/definition.ts:6` | **Keep — mailbox ruled keep-in-pilot (2026-08-19)** |
| ✔ | `company` / `contact` (CRM) | `features/block-company/definition.ts:6`, `block-contact/definition.ts:6` | **Keep — CRM ruled keep-in-pilot (2026-08-19)** |
| ◐ | `project` (folder) | `features/block-project/definition.ts:13` | — |
| ◐ | `code` (+ csv) | `features/block-code/definition.ts:12` | — |
| ◐ | `pdf` / `image` / `video` | `block-pdf/definition.ts:15`, `block-image/definition.ts:14`, `block-video/definition.ts:52` | — |
| ◐ | `canvas` | `features/block-canvas/definition.ts:15` | — |
| ◐ | `automation` | `features/block-automation/definition.ts:6` | — |
| ◐ | `pr` (GitHub PR) | `features/block-pr/definition.ts:5` | — |
| ✔ | `call` | `features/block-call/definition.ts:15` | **Keep — calls ruled in (2026-08-19)** |
| ◐ | `unknown` (fallback) | `features/block-unknown/definition.ts:11` | — |

## 6. Cross-cutting invariants (from the original plan's "Do not break" list)

Each needs an explicit ruling: preserved in the recreation, or consciously
dropped. See `original-linear-plan-review.md`.

**Ruled 2026-08-19 (Q20): all five preserved as binding design invariants.**
The `ai_toolset` freeze applies to its semantics as recreated in Gatekeeper
session APIs (Q18).

| St | Invariant | Verdict |
|---|---|---|
| ✔ | Soup/Block/Split/Entity/Team/Channel nouns | Preserved (2026-08-19) |
| ✔ | Frozen `ai_toolset` | Preserved — semantics carried into Gatekeeper session APIs (2026-08-19) |
| ✔ | Share-permission semantics (cross-ref SEC-1/2/3 holes, SUP-474) | Preserved — with the SEC holes fixed, not recreated (2026-08-19) |
| ✔ | Project = Folder | Preserved (2026-08-19) |
| ✔ | One Task database | Preserved (2026-08-19) |

## 7. Data model

From SH. **Key correction to the concept docs:** the "four Postgres databases"
are one physical database — 198 live tables, one migration stream at
`crates/macro_db_client/migrations/` (267 files), logical grouping only by
table prefix + client crate, with real cross-domain FKs. Design patterns that
shaped the old system and need a deliberate adopt/reject ruling: polymorphic
`entity_type`/`entity_id` pairs as universal glue (10+ tables, no FK),
transactional outbox tables, lease-based job claiming. Also: DynamoDB
(bulk-upload requests), Redis (cache + email backfill state), S3 blobs
(sha-addressed), client-side SQLite cache — and **two schemas already on D1**
(`services/sync-service/database/user-peer-mapping`, `services/ai-editing-worker`
edit_traces). One-file schema reference incl. all enums:
`basic_schema_for_testing.sql` (test snapshot carried by five workers).
No live data migrates (ruling 8) — these rows decide which *shapes* the new
D1/DO typed-storage design adopts.

| St | Table group | Old source (prefix / SH section) | Size | Verdict |
|---|---|---|---|---|
| ◐ | Identity, teams, membership | MacroDB group | part of 154 | — |
| ◐ | Documents + versions + annotations | MacroDB group | " | — |
| ◐ | Projects (folders) | MacroDB group | " | — |
| ◐ | Sharing / ACL | MacroDB group (cross-ref SEC-1/2/3) | " | — |
| ◐ | AI chat, insights, projections | MacroDB group | " | — |
| ◐ | Properties (EAV) | MacroDB group | " | — |
| ✔ | CRM (companies/contacts) | MacroDB group | " | **Adopt shapes — CRM ruled keep-in-pilot (2026-08-19)** |
| ✔ | Calls/voice, calendar | MacroDB group | " | **Adopt shapes — both ruled keep (2026-08-19)** |
| ◐ | GitHub, bots, webhooks, import, reminders, activity | MacroDB group | " | — |
| ✔ | Email (`email_*`) | 26 tables | — | **Adopt shapes — mailbox ruled keep-in-pilot (2026-08-19)** |
| ✔ | Comms (`comms_*`) | 7 tables | — | **Adopt shapes — channels ruled keep-full (2026-08-19)** |
| ◐ | Notifications | 11 tables | — | — |
| ✔ | Polymorphic entity glue pattern | 10+ tables; canonical type `model-entity` (56 dependent crates) | pattern — **reviewed 2026-08-19**: domain-motivated ontology, substrate-shaped encoding; options 1a/1b/1c in `pattern-review.md` §1 | **Ruled 1a (2026-08-19): adopt the ontology, replace the encoding** — `Entity=(type,id)` universal; entities in DOs/typed-storage; entity registry (existence + tombstones); designed materialized-index layer for cross-entity lists (required); per-type access policy stays code. Rider: settle TEXT/UUID id format before building glue. |
| ✔ | EAV property system pattern | properties tables; 18 system keys incl. task Status/Assignees | pattern — **reviewed 2026-08-19**: custom props domain-motivated, system-fields-as-EAV substrate-motivated; the query half is the kernel's one genuine gap; options 2a/2b/2c in `pattern-review.md` §2 | **Ruled 2a (2026-08-19): adopt semantics, replace storage** — definitions/options/tagged-values/system-key semantics kept exactly; values live on the entity record (single-writer DO); materialized-index layer for list filtering is a first-class design task. Riders: settle entity-type canonicalization first (TASK/DOCUMENT dual-namespace bug); property-write side effects become cross-DO effects needing pattern-3 treatment. |
| ✔ | Outbox + lease-claim job patterns | migrations (`20260725014930` et al.) | patterns — **reviewed 2026-08-19**: both ~purely substrate-motivated; kernel already has DO-native idioms (intent+alarm outbox; DO-as-lease); keep external-mutation fencing; options 3a/3b + 4a/4b in `pattern-review.md` §3–4 | **Ruled 3a + 4a (2026-08-19): adopt the disciplines, not the tables** — outbox → intent record + alarm inside the DO, idempotent consumers, poison-pill mark-and-skip; leases → DO single-writer + alarms replace claim/renew/release and polling dispatchers; external-mutation fencing + idempotency keys kept as DO-local state; multi-job DOs use the recompute-shared-alarm discipline. |

**Pattern-review workstream (ordered by David 2026-08-19, Q21):** David leans
*adopt*, but each pattern must first be reviewed by an agent against the
source to determine **why it exists** — domain-motivated (the product needs
it) vs. substrate-motivated (a Postgres/AWS/old-agent workaround). Each
pattern then gets a per-pattern adopt/replace proposal mapped explicitly onto
Cloudflare behavior (DO single-writer, alarms, Queues), so we never import a
system that works one way while the new substrate expects it to behave
another. David rules per pattern after that review.
| ◐ | Already-D1 schemas (sync peer-map, edit_traces) | `services/sync-service`, `services/ai-editing-worker` | 2 | — |
