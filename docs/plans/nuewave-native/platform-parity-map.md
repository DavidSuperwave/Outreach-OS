# Platform parity and data plan (workstream B)

> Status: draft for review — first planning session, 2026-08-19
> Scope: domain-by-domain mapping from the Macro/Nuewave platform to a
> Cloudflare-native rewrite hosted in this repository (Outreach-OS, built on
> the pinned Cloudflare OS release in `cloudflare-os/`).
> Companions: `cf-os-capability-map.md`, `shell-ux-rebuild-plan.md`,
> `agents-ai-plan.md`, `roadmap-and-licensing.md` (same folder).

## Ground rules

1. **Rewrite-by-contract, never code port.** The Macro repository cannot be
   reused under its license. The `docs/internal/platform-context/` maps on the
   `cursor/platform-context-docs-2f7d` branch of `DavidSuperwave/Neuwave` are
   concept-level documentation and are our reference for *what the platform
   does*, not *how its code does it*. No Macro source files, schemas, SQL
   migrations, or copied identifiers enter this repo. Nouns and product
   semantics (Task, Channel, Entity, share levels, Project=Folder, one Task
   database) are fair game; implementations are written fresh against
   Cloudflare primitives.
2. **The Cloudflare OS build leads.** Where Macro has a subsystem and
   Cloudflare OS already has an equivalent primitive (agents, integrations,
   AI models, storage, admin), we adopt the OS primitive and adapt the
   concept to it — not the other way around.
3. **AWS is gone.** No ECS, Lambda, SQS, Kafka, OpenSearch, DynamoDB, S3,
   FusionAuth, Doppler, Pulumi. Every kept domain must name its Cloudflare
   substitute below.
4. **Pilot scope wins fights.** The true priorities are (a) the Nuewave
   Work-tab / Task / Flow / AgentSession / Broker loop and (b) the Outreach
   OS scope (Context playbooks + ICP, inspect→ask→table on lead files,
   Instantly **reads**). Anything not on the path to those is deferred or
   dropped, no matter how central it was to Macro.

## What Cloudflare OS already gives us

Grounded in `cloudflare-os/packages/` at the pinned release:

| OS primitive | Where | What it replaces from Macro |
|---|---|---|
| Workshop kernel (capnweb RPC `PublicApi` / `AuthenticatedApi` / `AdminApi`) | `workshop-backend/src/server.ts` | DSS/DCS composition roots as the single API surface |
| `UserDurableObject` (per-user state) | `workshop-backend/src/user.ts` | user rows + Redis session cache |
| `OverseerDurableObject` (agent session runtime: loopbacks, code-mode, spawner, tails) | `workshop-backend/src/overseer.ts` | `crates/agent` AgentLoop + DCS stream endpoint + connection_gateway delivery |
| `AdminSettings` DO + `/admin` | `workshop-backend/src/admin-settings.ts` | settings service surfaces, feature-flag plumbing |
| typed-storage (typed collections + secondary indexes over DO storage) | `typed-storage/src/index.ts` | hand-rolled Postgres tables for small entity sets |
| Gatekeepers (service-bound integration Workers with connect flows) | `gatekeeper-*` packages, `packages/custom-gatekeeper` in the wrapper | integration crates (github, google, email), MCP client/service, scheduler |
| `gatekeeper-context` | upstream package | Context collections — the Outreach playbook/ICP substrate |
| `gatekeeper-scheduler` | upstream package | `scheduled_action` deployable |
| `ExternalMessageGateway` service entrypoint | `workshop-backend/src/external-message-gateway.ts` | inbound channel/bot message routing |
| `LanguageModelGatekeeper`, AI Gateway config + billing | `ai-models.ts`, `ai-gateway.ts`, `ai-gateway-billing/` | model routing; OpenRouter lands here (SUP-536/SUP-465) |
| Gadgets + Blueprints (KV records, R2 screenshots) | blueprint modules, KV/R2 bindings | dynamic-ui DisplayResults widgets; document-ish artifacts |
| Cloudflare Access JWT auth (starter's deployed mode) | `access.ts`, wrapper `deployment.jsonc` | FusionAuth + auth service |
| Workers Analytics + observability + error reporter | `observability.ts`, wrapper `packages/error-reporter` | analytics proxy, log stacks |

## Domain-by-domain verdicts

### 1. Identity, teams, billing — keep-as-concept (minimal), billing dropped

- **Verdict:** keep identity; defer teams; drop billing/paywall/Stripe and all
  native-app auth paths.
- **Mapping:** Cloudflare Access is the identity provider (already the
  starter's deployed mode; admin allowlist in `deployment.jsonc`). Per-user
  state lives in `UserDurableObject`. There is no FusionAuth, no OTP flows, no
  team invitation machinery for the pilot — the "team" is the Access policy.
- **Contract:** a User has a stable id (Access subject/email), display name,
  and role (admin via `ADMINS`). A Team entity is introduced only when a
  second tenant forces it.

### 2. Workspace / Soup (unified cross-entity lists) — keep-as-concept, radically reduced

- **Verdict:** keep the *concept* (one queryable list layer with tabs,
  filters, grouping, saved views) but do **not** rebuild Soup's cross-entity
  federation over four databases. The pilot needs exactly one first-class
  list: **Work** (Tasks), plus whatever list views Gadgets render ad hoc.
- **Mapping:** a single **Workspace DO** (or small family: one per channel
  scope later) owns the Task collection using typed-storage with secondary
  indexes for `status`, `assignee`, `updatedAt`, `channelId`. List queries are
  RPC methods (`listTasks(filter, group, sort, cursor)`), not GraphQL. Saved
  views are small records in the same DO. If task volume or ad-hoc filtering
  outgrows DO indexes, promote the Task store to **D1** with plain SQL — that
  is the escape hatch, not the starting point.
- **Contract:** Task {id, title, body-ref, status (the four Work-tab system
  properties from the old plan: STATUS plus owner/delegate/priority-class),
  owner, delegate, channelId, flowId?, timestamps}. One Task database — the
  frozen Nuewave invariant — holds.

### 3. Documents, files, folders, editors — keep minimal, collaboration deferred

- **Verdict:** keep Markdown documents and file attachments as concepts;
  defer real-time collaborative editing, PDF/canvas/code/video blocks,
  history/blame, DOCX conversion.
- **Mapping:** document bytes and uploads → **R2** (already bound). Document
  metadata → the owning DO (typed-storage) with the R2 key. Rendering/editing
  happens in Gadgets; agent edits go through the agent runtime, not a
  Loro/CRDT sync service. Note Macro's own sync-service was conceptually a
  Cloudflare Worker + Durable Objects design — which tells us the platform
  fits here — but we re-implement from scratch *if and when* multi-writer
  editing is actually needed; the pilot is single-writer + agent.
- **Contract:** Document {id, kind (md | file), r2Key, title, ownerId,
  projectId?}; Project=Folder is a label/relation, not a separate storage
  system.

### 4. Channels and messages — keep-as-concept, phase 2

- **Verdict:** keep a thin Channel: the pilot needs a coordination surface
  (the old plan's "pilot channel" with a coordinator bot) and a home for the
  Work tab. Threads, reactions, rich message UX: deferred.
- **Mapping:** **DO per channel** owning an append-only message log
  (typed-storage list keyed by timestamp+id), member set, and a WebSocket
  fan-out to connected clients (DO hibernatable WebSockets). Inbound external
  messages arrive via the existing `ExternalMessageGateway` entrypoint. No
  CommsDB, no Kafka.
- **Contract:** Channel {id, name, members}, Message {id, channelId, author
  (user | agent | external), body, ts, threadRoot?}. Bots are agents joined
  to the channel — reusing the OS agent runtime, not a separate bots domain.

### 5. Email (Gmail sync, mailbox, compose) — drop; Instantly reads — keep

- **Verdict:** drop mailbox sync entirely (EmailDB, pubsub workers, scheduled
  send, signatures, calendar-watch — all out). The outreach requirement is
  **read-only Instantly campaign/lead data**, which is an integration, not a
  mailbox.
- **Mapping:** an **Instantly Gatekeeper** in the wrapper's
  `packages/custom-gatekeeper` pattern: read-only session API (campaigns,
  leads, replies, stats), secret held as a Worker secret, no send/activate
  method exposed at the contract level (the SUP-468/469 design carries over
  unchanged). Results land in Gadget tables, not an email UI.

### 6. Calendar — drop

No Google consent flows, no occurrence queries, no event editor. If the
scheduler ever needs wall-clock triggers, `gatekeeper-scheduler` covers it.

### 7. Calls, transcription, LiveKit — drop

Out entirely. No CommsDB/Kafka/LiveKit replacement is planned.

### 8. CRM and contacts — defer; ICP lives in Context

- **Verdict:** defer CRM tables. The pilot's company/ICP knowledge belongs in
  **Context collections** (`gatekeeper-context`): Playbooks + Intraplex ICP
  documents the agent retrieves, exactly the Outreach OS M1 scope. A
  CRM-lite (Company/Contact records with a few properties) becomes a phase-3
  candidate only if table-shaped lead work outgrows Gadget tables.
- **Mapping when it lands:** Companies/Contacts as a typed-storage collection
  in a Workspace DO or D1 table; enrichment from Instantly reads; no
  contacts-graph service.

### 9. Chat, agents, tools, MCP — keep; this is the OS core

- **Verdict:** keep — but the direction reverses. Macro's DCS/agent/ai_tools
  stack is *replaced by* the OS's Overseer runtime, gatekeeper toolset, and
  code-mode. The Nuewave concepts to re-express on top of it:
  - **AgentSession** → an Overseer session; its durable state and event tail
    are already DO-persisted (survives restart — the old M3 bar).
  - **Flow** → a thin entity on the Task (see workstream D's plan): ordered
    steps + pending session reference, stored beside the Task.
  - **Broker (provider-neutral delegation)** → the OS agent-spawner +
    `LanguageModelGatekeeper` provider routing via AI Gateway/OpenRouter;
    external CLI runners (Claude Code/Codex) become spawner targets or
    Gatekeeper-mediated remote sessions, not an ECS cluster.
  - **MCP** → `gatekeeper-mcp` / `gatekeeper-mcp-portal` for outbound
    connections; no standalone Macro-style MCP server for the pilot.
- **Contract:** tool access is always Gatekeeper-mediated (the OS trust
  boundary) — this also satisfies the old plan's zero-ambient-credential bar
  (P.C) by construction.

### 10. Search — defer, with an honest tradeoff note

- **Verdict:** defer. No OpenSearch replacement at pilot scale.
- **Mapping when needed:** two different needs, two tools —
  (a) *retrieval for agents* → **Vectorize** embeddings over Context and
  documents (fits `gatekeeper-context`); (b) *user-facing find* → **D1 FTS5**
  over Task titles/bodies and message text. Be honest: neither gives
  OpenSearch-grade cross-entity ranked search with live indexing fan-out;
  that entire producer→queue→indexer pipeline (SQS/Kafka → search_processing)
  is out of scope, and we accept simple per-store queries instead.

### 11. Properties and tags — keep the four system properties only

- **Verdict:** the generic user-defined property system is deferred. Keep
  the four Work-tab system properties from the old Nuewave plan as **typed
  fields on Task** (status, owner, delegate, priority/area) so kanban and
  filters work day one. Tags come later as a string-set field, not a domain.

### 12. Notifications — defer to in-app only

- **Verdict:** no NotificationDB, no push providers, no preference matrix.
- **Mapping:** channel DO WebSocket push + an unread counter in
  `UserDurableObject`. Browser/native push is out for the pilot.

### 13. Sharing and permissions — keep-as-concept, simplest possible

- **Verdict:** the Access policy is the outer wall; inside it, the pilot is
  effectively one workspace. Preserve Macro's *share-semantics concept*
  (owner / editor / viewer levels on an entity) in the contract so it can be
  enforced later, but implement only owner-or-member checks in DO methods
  now. The OS `sharing.ts` (public share links for gadgets) is used as-is.

### 14. Reminders — drop

`gatekeeper-scheduler` + an agent instruction covers any real need.

### 15. Automation / scheduled actions — keep via OS primitives

- **Verdict:** keep. Scheduled agent runs = `gatekeeper-scheduler` triggering
  Overseer sessions. No `scheduled_action` deployable rewrite.

## Summary table

| # | Domain | Verdict | CF-native mapping | Phase |
|---|---|---|---|---|
| 1 | Identity/teams | keep (minimal) | Cloudflare Access + UserDurableObject; billing dropped | P0 (exists) |
| 2 | Workspace/Soup | keep-as-concept | Workspace DO + typed-storage indexes; D1 escape hatch | P1 |
| 3 | Documents/files | keep minimal | R2 bytes + DO metadata; Gadget rendering; no CRDT sync | P1 |
| 4 | Channels/messages | keep thin | DO per channel, WS fan-out, ExternalMessageGateway | P2 |
| 5 | Email sync | **drop** / Instantly reads **keep** | custom Instantly Gatekeeper, read-only session API | P2 |
| 6 | Calendar | drop | — | — |
| 7 | Calls | drop | — | — |
| 8 | CRM/contacts | defer | Context collections now; CRM-lite in DO/D1 later | P3 |
| 9 | Chat/agents/tools/MCP | keep (OS core) | Overseer DO, spawner, Gatekeepers, AI Gateway/OpenRouter | P0–P1 |
| 10 | Search | defer | Vectorize (agent retrieval) + D1 FTS (find) when needed | P3 |
| 11 | Properties/tags | keep 4 system props | typed fields on Task | P1 |
| 12 | Notifications | defer | DO WS push + unread counter | P2 |
| 13 | Sharing/permissions | keep-as-concept | Access outer wall; owner/member checks in DOs; OS share links | P1 (checks only) |
| 14 | Reminders | drop | gatekeeper-scheduler if ever needed | — |
| 15 | Automation | keep | gatekeeper-scheduler → Overseer sessions | P2 |

## Infrastructure substitution table

| Macro/AWS | Cloudflare-native | Notes |
|---|---|---|
| MacroDB/CommsDB/EmailDB/NotificationDB (Postgres) | DO storage via typed-storage; **D1** for relational/FTS needs | one Task database invariant preserved inside one DO/D1 store |
| S3 | **R2** | already bound by the starter |
| Redis (cache, streams, coordination) | KV (read-heavy config), DO state + alarms (coordination), Overseer tails (streams) | no separate cache tier at pilot scale |
| OpenSearch | D1 FTS5 + Vectorize (deferred) | accept reduced search capability |
| SQS / Kafka | **Cloudflare Queues**; DO alarms for retries/timers | most Macro queue uses disappear with dropped domains |
| DynamoDB (connections, static-file metadata) | DO storage | connection tracking is inherent to DO WebSockets |
| ECS runner cluster / Lambdas | Workers + Durable Objects; agent-spawner for runner-like sessions | zero-ambient-credential via Gatekeeper mediation |
| FusionAuth | Cloudflare Access | already the deployed mode |
| connection_gateway (WebSocket delivery) | DO hibernatable WebSockets per channel/session | fan-out pattern below |
| Doppler/Pulumi/GitHub-hosted runner infra | Wrangler + `deployment.jsonc` + repo CI | wrapper repo already owns deploy order |
| PostHog feature gates | OS feature-flags (`feature-flags.ts`) + AdminSettings | keep gates few |

## Hardest problems

1. **The Soup replacement (cross-entity list/query layer).** Macro federated
   four Postgres databases behind one GraphQL/list API with live updates.
   Our reduction — one Workspace DO with typed-storage indexes and RPC list
   methods — is deliberately weaker: no cross-entity joins, no ad-hoc
   predicate language, per-DO consistency islands. The risk is scope creep
   dragging us back toward a general query layer; the mitigation is the D1
   escape hatch and refusing cross-entity views in the pilot.
2. **Realtime fan-out at the right grain.** DO WebSockets make per-channel
   and per-session fan-out easy, but "one user sees updates from many
   channels + a task list + an agent tail" means a client multiplexes several
   DO sockets or we add a per-user aggregator DO. Choosing that topology
   early (and keeping hibernation costs sane) is the main realtime design
   decision — connection_gateway solved this with a central gateway; we must
   not accidentally rebuild a central gateway DO that becomes a hot spot.
3. **Durable Flow/AgentSession semantics with an external verifier.** The old
   plan's bar — Flow state survives process death (M3/P.K) and GitHub
   verification is the only Done-setter (M4) — must be re-proven on Overseer:
   session resumption after eviction, idempotent event application to Task
   state, and a GitHub Gatekeeper webhook path that flips STATUS without any
   agent being able to. This is a state-machine correctness problem, not an
   infrastructure gap.
4. *(Runner-up)* **Search honesty**: if the pilot's lead tables grow, D1 FTS
   is serviceable, but nobody should expect OpenSearch parity; say so early.

## Open questions

- Task store: start in a Workspace DO (typed-storage) or go straight to D1?
  DO keeps the one-database invariant simplest; D1 makes ad-hoc filtering and
  FTS cheaper later. Recommend DO first, migrate behind the RPC contract.
- Does the pilot need Channels in phase 2 at all, or does the Work tab +
  agent sessions cover coordination until the coordinator-bot milestone?
- Where do Instantly read results live: transient Gadget tables only, or a
  persisted Lead collection (pre-CRM) in the Workspace DO?
- Per-user aggregator DO for realtime, or client-side socket multiplexing?
- Is `gatekeeper-context` retrieval good enough for Playbooks + ICP, or do we
  need Vectorize embeddings in phase 1 (hope: no)?
- The old Nuewave repo's R-21/cloud-verify GitHub Actions recipes: does any
  part carry over as the GitHub verifier design, or is that also a fresh
  build? (Concept carries; check nothing code-level is assumed.)
