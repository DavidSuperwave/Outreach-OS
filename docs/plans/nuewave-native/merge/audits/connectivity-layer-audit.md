# Domain audit — Agent connectivity layer (P1 centerpiece)

> Created 2026-08-19 by the merge-review pass (workstream 3, audit 1 of 3).
> The capability is NEW — ruled 2026-08-19 as "Composio-style MCP + API
> linking so agents pull external data into the workspace; Instantly is
> merely the first source." The old platform has *analogues*, not an
> equivalent, so this audit maps analogues + kernel seams + gaps.
> Pointers: `[NW]` = Neuwave clone @ `9f7a26b`, `[CF]` = the `cloudflare-os`
> submodule in this repo; `path:line` from each root. Facts from code only;
> verdicts are David's.

## A. What the old platform actually does

### A1. MCP client (`[NW] crates/mcp_client`) — mounted inside DCS

- **Transport:** Streamable HTTP only (via `rmcp`); no stdio/SSE-only.
  `src/domain/models/server.rs:8-10,52-75`.
- **Ownership model:** servers are **per-user** `{user_id, url, server_name,
  credentials?, enabled}` (`server.rs:38-50`). No team or workspace
  scoping — every enabled server attaches to every chat the user runs.
- **Persistence:** Postgres `mcp_servers` (PK user_id+url), OAuth
  credentials AES-256-GCM-encrypted BYTEA
  (`src/outbound/pg_server_repo.rs:14-98`); upsert COALESCEs credentials so
  re-adding never wipes a grant; refreshed tokens written back through a
  write-through `PersistingCredentialStore`.
- **OAuth (client side):** full PKCE; three client-resolution strategies in
  precedence order — pre-registered per-provider creds, CIMD, Dynamic
  Client Registration (`src/outbound/oauth.rs:60-166`); ephemeral state in
  Redis (`src/outbound/redis_state_store.rs`); hardcoded provider registry
  (Slack, GitHub, Linear quirks) at
  `src/domain/provider_registry/mod.rs:5-102`.
- **Endpoints (mounted in document_cognition_service,
  `[NW] services/document_cognition_service/src/api/mod.rs:125,131`):**
  `GET/POST/PUT/DELETE /mcp/servers`, `POST /mcp/servers/auth/start`,
  unauthenticated `GET /mcp/servers/auth/callback` and
  `/mcp/servers/auth/client-metadata`
  (`src/inbound/axum_router.rs:102-132,464-544`). An
  `McpAuthCompletedHook` fires on OAuth completion and kicks
  onboarding/import gathering (`DCS main.rs:618-640`).
- **Tool discovery/invocation:** per chat-stream request a fresh
  `CombinedToolSet` is built — connect to all enabled servers, list tools,
  mangle names `mcp__<server>__<tool>`; failures silently skipped
  (`src/domain/service/toolset.rs:15-27,70-138`). Key invariant: **MCP tool
  schemas are never sent on every model request** — tools are exposed
  through a searchable catalog (`toolset.rs:322-332`), so a big catalog
  never bloats the prompt. No connection caching across requests
  (`DCS api/stream/chat_message/mod.rs:523-531`).
- **Auth-failure state is client-side only** — a localStorage hack; the
  server has no failed-auth signal
  (`apps/web/src/features/settings/Integrations.tsx:165-185`).

### A2. Macro *as* an MCP server (the inverse direction)

- `[NW] services/mcp_service/src/main.rs:42-76` — a Streamable-HTTP MCP
  **server** exposing the first-party `ai_tools::mcp_tools()` toolset to
  external agents (Claude Code, IDEs); auth extracted from middleware
  (`tool_service.rs:54-148`).
- `[NW] services/mcp_auth_proxy` — an OAuth 2.1 broker in front of
  FusionAuth *because FusionAuth lacks DCR* (`README.md:1-6`): fake-DCR
  `/register`, `/authorize`, `/token`, `/.well-known/*`, Redis state.
  Substrate-motivated; FusionAuth is ruled dead.

### A3. Integrations UI (`[NW] apps/web`)

- Settings → Connections: Gmail + GitHub account cards plus the MCP
  integrations list (`features/settings/ConnectedAccounts.tsx:13-36`,
  `Integrations.tsx` — ServerRow connect/toggle/delete :187-345, featured
  one-click rows :353-394, custom add-server dialog :38-163).
- **The entire "connector catalog" is a hardcoded frontend constant:**
  `QUICK_CONNECT_SERVERS` — GitHub, Linear, Slack (dev-only), Notion,
  PostHog, Datadog, Grafana — with icons and taglines
  (`lib/core/component/AI/constant/mcpServers.ts:13-82`).
- "Macro MCP server" settings tab + modal explain pointing external MCP
  clients at Macro (`features/settings/Agent.tsx:1-19`,
  `features/integrations/mcp-setup/MacroMcpSetupModal.tsx`).
- Onboarding reuses the featured connectors; connecting one triggers
  import gathering (A4). Linear import UI at
  `features/integrations/import-linear/ImportLinear.tsx`.

### A4. The import pipeline (`[NW] crates/import`) — closest analogue to the new centerpiece

- A ledger of external items (Linear issues, Notion pages, Slack channels)
  moving `staged → importing → imported | discarded`; explicitly distinct
  from `foreign_entity` (copies vs. live references) (`src/lib.rs:1-14`).
- `ImportSource` is a **hardcoded 3-variant enum**, each identified by its
  MCP server URL, with a fixed target entity type (task/md/channel)
  (`src/domain/models.rs:32-98`).
- **Gather jobs are short agent sessions** (24-turn cap, 90s timeout, cheap
  fast models) whose toolset = the user's connector `McpToolSet` plus an
  in-process `CreateImportEntity` tool locked to (user, source, initiator)
  — the model stages candidates by tool call, no structured-output parsing
  (`src/domain/service.rs:1-57,448-511`); Slack has a deterministic
  direct-API fallback (:601-683). OAuth-completed hook auto-starts gathers
  before the user returns from the OAuth tab.

### A5. First-party connector infrastructure (non-MCP)

- **GitHub identity link:** `POST/DELETE /link/github` (+ gmail variants)
  on the auth service (`services/authentication_service/src/api/link/mod.rs:13-21`);
  hand-rolled OAuth (`crates/github/src/outbound/github_oauth_client.rs:34-88`);
  `github_links` table.
- **GitHub App installs** are the only *team-scoped* connections:
  `github_app_installation` (+installer, +request) with source_type ∈
  team|user (`migrations/20260527141944_github_app_installation_sources.sql`).
- **Sync is webhook-push, GitHub-only:** webhooks → sync handlers mirror
  PRs into the workspace as entities backed by `foreign_entity` records
  (`crates/github/src/domain/service/sync/*`,
  `domain/models/pull_request.rs:316`).
- **`crates/foreign_entity`** is a generic mirror store
  `{foreign_entity_id, source, metadata JSONB, stored_for user|team}`
  (`src/domain/models.rs:11-100`;
  `migrations/20260526175912_create_foreign_entity_table.sql`) — no sync
  engine of its own; consumers: github, documents, memory, soup, ai_tools.
- Name traps: `crates/connection` = websocket cache-invalidation events;
  `contacts_connections` = user↔user contact edges. Neither is a connector.

### A6. Old-side tables

| Table | Migration (`crates/macro_db_client/migrations/`) | Scope |
|---|---|---|
| `mcp_servers` | 20260512000001 | per-user, encrypted creds, `enabled` flag |
| `foreign_entity` | 20260526175912 | user- or team-scoped JSONB mirror |
| `import_entity` / `import_run` | 20260720221050 | staged-import ledger + gather-job state; 3 hardcoded sources |
| `github_links` | 20260226142003 | user↔GitHub identity |
| `github_app_installation` (+2) | 20260527141944 … | team/user app installs |
| `github_pr_tasks` | 20260305182148 | PR↔task |

There is **no generic** `integrations`/`oauth_tokens` table — everything is
per-connector.

## B. What the CF-OS kernel already provides

The kernel's connectivity model is the **Gatekeeper** system — richer than
the old MCP client and different in shape: capability-based, per-resource
grants, approval-gated, typed-RPC surfaces instead of tool schemas.

- **Contract** (`[CF] packages/workshop-shared/src/gatekeeper.ts`): one
  connector = one Worker discovered from `GATEKEEPER_*` bindings.
  `GatekeeperVendor` (:378-446) → `connectAccount` (OAuth), URLPattern
  resource types with grantable flags and incremental scope expansion
  (:204-223, :536-543), `getTypeScriptTypes()` feeding the agent's type
  database; `GatekeeperUser` (:482-569) with revoke/reconnect/
  `credentialsExpired`; `Gatekeeper<Session>` (:591-726) where **every read
  is an authorized observation and every side effect queues for approval**
  with simulation, revert, auto-approve tags
  (`workshop-backend/src/auto-approval.ts:1-40`).
- **MCP support is substantially complete**: `gatekeeper-mcp` (user pastes
  endpoint; each tool becomes a typed session method generated from its
  inputSchema; grant = whole server or named tools), `gatekeeper-mcp-portal`
  (admin-vetted portal, single-upstream grants), `mcp-shared` (bounded
  HTTP client, official-SDK OAuth incl. DCR + rejection detection, per-
  account DO credential store with three auth kinds none/oauth/token,
  read/action trust classification honoring `readOnlyHint`
  (`tools.ts:17-87`), endpoint blocklists, claim-once action store, and an
  **owner-only sharing rule** — MCP-backed workspaces refuse observers
  because MCP has no per-record ACL (`sharing-policy.ts:1-12`)).
- **How agents get connectivity** (`workshop-backend/src/agent.ts`): not a
  tool list — named bindings in the chat's `env`; the agent calls
  `describeBinding` for typed APIs, uses them from `executeCode`, and can
  `requestConnection({vendorId, resourceUrl, bindingName})` → accept/deny
  card → resource appears as `env.<name>` on approval (:340,:618-622,
  :2752-2801,:3000-3053).
- **Grant topology:** connected accounts in the per-user DO
  (`user.ts:1070-1139,1442-1489`); binding edges per-gadget in the Overseer
  (`overseer.ts:203-248,328,761-766`).
- **Existing fleet:** cloudflare, confluence, context, email, github,
  google, homeassistant, linear, notion, scheduler, slack, spotify,
  supabase, **zoominfo** — zoominfo is the closest outreach-adjacent
  reference (OAuth2+PKCE, whole-account resource, lookup/search/enrich/
  copilot/usage session; `gatekeeper-zoominfo/README.md:1-30`).
- **No Instantly.ai connector exists in either codebase** (grep: zero hits).

## C. The delta — gaps present in neither codebase

Facts, not designs:

1. **Connector catalog as data.** Old: frontend constant + hardcoded Rust
   enum. New: catalog = deployed Workers (deploy-time, code-defined).
   Neither has a runtime-managed catalog (add/curate/feature without a
   deploy) or Composio-style catalog metadata.
2. **Instantly (or any outreach-tool) connector** — absent from both.
3. **Per-team/org credential vault.** Old: MCP creds strictly per-user;
   only GitHub App installs are team-scoped. New: per-user DO accounts,
   MCP grants owner-only by explicit policy. "One admin connects it, the
   whole team's agents use it" exists nowhere.
4. **Generic OAuth broker for non-MCP APIs** (register any OAuth2 API +
   token store + refresh, used by thin connectors — the Composio core
   primitive). Old: MCP-specific or hand-rolled per connector. New:
   per-gatekeeper, each Worker owns its flow.
5. **Continuous external-data sync.** Old: one-shot copy (import, 3
   sources), webhook push (GitHub only), live-on-demand (MCP). New:
   live-on-demand sessions + scheduler + hooks. A generic pull-sync/
   trigger engine over connectors exists in neither.
6. **Dynamic per-session tool narrowing** of an existing grant (this
   session may only use the read tools of an already-granted server) as a
   first-class runtime operation — the new side has static per-grant tool
   pinning, which is close but not per-session.
7. **Cross-connector tool search.** Old solved prompt-bloat with a
   SearchTools catalog; new solves it with per-binding typed `.d.ts`.
   Neither has "search all my connected tools" across connectors.
8. **A generalized import/staging ledger.** Old's `import_entity`/
   `import_run` + cheap gather agents is the strongest analogue of "pull
   external data into the workspace" and exists nowhere in the kernel.
9. **Server-side auth-failure state** — an old-side-only gap; the kernel
   already has `credentialsExpired` (`user.ts:28`, `gatekeeper.ts:462`).

## D. Open design questions for David

1. **Instantly: MCP-first or API-first?** Bespoke gatekeeper (zoominfo
   pattern — typed, curated, credit-aware) vs. generic MCP endpoint via
   gatekeeper-mcp. Decides how much "Composio layer" P1 actually needs.
2. **Where does the catalog live** — deploy-time Workers (kernel
   invariant) vs. a data-driven registry? A runtime catalog conflicts with
   binding auto-discovery and the type-database pipeline.
3. **Team credential sharing vs. the kernel's owner-only invariant.** The
   sharing policy refuses observers *because* MCP has no per-record ACL; a
   team vault collides with that reasoning head-on. Which yields?
4. **Approval posture for outreach.** Old had no approvals at all; the
   kernel approval-gates every write. "Send 500 emails" stresses the
   model — batch approvals? auto-approve tags per connector?
5. **Copy-in vs. live-reference** for external records (old
   `import_entity` vs. `foreign_entity` split) — decides whether an
   import-ledger port is needed at all.
6. **Connect-once-everywhere (old per-user model) vs. per-workspace
   explicit bindings (kernel model)** — simpler UX vs. safer granularity.
7. **Does the gather pattern port** (cheap agent + locked staging tool) as
   the Instantly ingestion mechanism, or is ingestion deterministic API
   sync?

## E. Coverage

Read in full/relevant part `[NW]`: mcp_client (models, ports, toolset,
router, repo, provider registry, oauth outline), mcp_service,
mcp_auth_proxy (README + routes), DCS wiring, import crate (lib, models,
service head), foreign_entity, github oauth + sync file map, auth link
routes, all named migrations, the integrations/settings UI. `[CF]`:
gatekeeper.ts (~600/1102 lines), the three MCP packages' READMEs +
targeted excerpts (oauth.ts, account.ts, tools.ts, sharing-policy.ts),
agent.ts tool/requestConnection regions, user.ts gatekeeper regions,
overseer.ts binding regions (grep-level), zoominfo README.

Not examined (lower confidence, unlikely to change the delta):
`persisting_credential_store.rs` internals, mcp_client `oauth.rs` full
body, ai_toolset's SearchTools implementation, import service tail
(Notion importer/finalize), the Overseer's full grant-record lifecycle and
chat binding-map construction, gatekeeper-github/google full OAuth
implementations, workshop-frontend connector UI. If a design depends on
how the Overseer validates account-to-binding assignment at chat start,
that needs a follow-up read.
