# Domain specification — Agent connectivity layer (N10 / SUP-554)

## Verdict and source evidence

P1 outreach centerpiece. Ledger 2026-08-19; OD-4 ruled 2026-08-20: first track of
Wave 4a, immediately post-slice. Scope leads with: the sandboxed agent reads
external data through governed connectors (Gatekeepers / MCP). Instantly is
**reads only**. Instantly send/activate is out of scope until a separate owner
order. Kernel pin untouched (ADR-014). Wrapper `ConnectorsApi` / `WebhooksApi` /
`AutomationsApi` / `MemoryApi` / `ImportApi` / `CompletionsApi` follow ADR-002
(not added to kernel `api.ts`). Batch 4 (OD-5) is scope authority. OD-2 keeps
the MCP server surface and a **governed** `/chat/completions` passthrough.
OD-28: memory refreshes on activity, not a daily whole-workspace sweep. OD-6
still blocks webhook egress parity — all outbound HTTP sits behind `safe-fetch`.
OD-29 is open; this node implements the recommended Team-DO custody wrapper
without a kernel change.

## User journeys

An agent opens an Instantly Gatekeeper session and **reads** campaigns / accounts
/ leads / analytics as observations. Connecting GitHub (reference connector)
mirrors PRs as `foreign_entity` (`github_pull_request`). The agent may propose a
GitHub write; the approval queue gates it; after apply the session resumes
(05-MAP row 14). A team registers an outbound webhook, receives HMAC-signed
deliveries with the 5×[30/60/120/300s] ladder, and a duplicate `(webhook_id,
event_id)` is a no-op (05-MAP row 15). A saved prompt + cron in an IANA timezone
fires as `ActionKind::Agent` via a per-automation alarm. Import gathers Linear /
Notion / Slack candidates into a staging ledger; the user confirms or discards.
Memory prepends a 1–3k-word profile refreshed on activity. External MCP servers
are consumed via kernel `gatekeeper-mcp` (old `mcp_client` killed after OAuth +
catalog harvest). Macro-as-MCP-server stays behind a kill switch (OD-2).

## Invariants

One agent runtime: the kernel. Instantly session types contain no send / activate
/ start methods; a generic dispatcher still throws `read_only`. Webhook owner is
user XOR bot. Signing secrets are read-once at create. Reserved `x-macro-*`
headers cannot be supplied by subscribers. Document events `content_uploaded`,
`sync_content_updated`, and `purged` are never forwarded. GitHub ingress accepts
exactly six event types and skips unknown. Import latitude is on content, never
on shape. Completions force `stream=false`, stamp `AiFeature`, and allow-list
models. Memory never schedules a workspace-wide daily sweep. MCP tool annotations
are untrusted unless the portal marks the server `vetted`. Egress never calls
`fetch()` on request-derived URLs except through `safe-fetch`.

## Entities and identifiers

Registry: `foreign_entity` (`fgn_`, source `github_pull_request`). Wrapper-local
ids: webhook endpoints, deliveries, automations, import runs, connections.
Connectors are Gatekeeper-owned account records, not a new EntityType.

## Authority and consistency

One DO per webhook endpoint (single-writer drain, alarm retry, DO-local dedupe).
Team-scoped credentials live in wrapper `TeamConnectionStore` (OD-29 rec a);
sessions are minted per use. Memory is a User-DO field. Automations are
per-action alarm state keyed by `(automationId, scheduledTick)`. Kernel Overseer
owns agent sessions, approvals, and MCP client runtime — this package maps UX
and wrapper capabilities only.

## Storage and indexes

N3 `STORAGE_OWNERS` rows: `webhook_endpoint`, `team_connections`, `user_memory`.
Delivery-status projection is rebuildable from the webhook outbox. PR mirrors
register `foreign_entity` rows; Soup decoration is N4/N7 and is not owned here.

## RPC/API contract

Typed capabilities (ADR-002), not kernel `api.ts`:

- `ConnectorsApi` — catalog, connect, mint session, revoke. Instantly vendor is
  read-only.
- `InstantlySession` (proposed, implemented as reads) — `listCampaigns`,
  `getCampaign`, `listAccounts`, `getAccount`, `listLeads`, `getLead`,
  `listEmails`, `getCampaignAnalytics`. **Stop for David** before any write
  method.
- `WebhooksApi` — create / list / pause / disable / inspect / validate
  (rate-limited). HMAC `x-macro-signature` over `timestamp + "." + raw body`;
  `x-macro-timestamp`.
- `AutomationsApi` — cron + IANA timezone, `ActionKind` = `Agent` only.
- `MemoryApi` — get / refresh-on-activity / 24h stale-while-revalidate.
- `ImportApi` — gather / confirm / discard for Linear, Notion, Slack.
- `CompletionsApi` — governed `POST /chat/completions` passthrough.
- `McpSurfaceApi` — harvested OAuth strategies + searchable tool catalog;
  MCP **server** expose/kill-switch (OD-2). No `mcp_auth_proxy`.

Kernel consumption (do not extend): `GatekeeperClient` 3 + `GadgetClient` 12.

## Commands and UI surfaces

`settings.connections`, `settings.mcp`, `settings.bots`, `chat.stop`,
`chat.retry`, `automation.create`, `import.start`. Settings tabs; no dedicated
hotkeys (matches source). Chat send stays on the kernel.

## Authorization matrix

Webhook CRUD: owner principal (user XOR bot). Team connector install: team admin
receipt. `foreign_entity`: owner + explicit shares; membership never grants
visibility. Agent domain writes use the same receipts as humans plus the
approval queue. `AiAdminApi` usage rollup is admin-only (403 otherwise).
Completions require `ChatModelAccess` (allow-list) and a named owner.

## Events, jobs, retries, and replay

Topic `webhooks`. Retry ladder `[30, 60, 120, 300]` seconds after the first
attempt (5 attempts total). Duplicate `(webhook_id, event_id)` is a no-op.
Automation ticks re-arm without double-run. Import serialize per `(userId,
source)`. Replay of webhook events is safe because of dedupe.

## External providers

| Provider | Posture |
|---|---|
| Instantly | Reads only. Session API proposed; no send/activate. |
| GitHub | Reference connector. Wrapper Worker `packages/github-hooks` serves `POST /hooks/github/*`. Six events. HMAC `X-Hub-Signature-256`. |
| MCP BYO / portal | Kernel `gatekeeper-mcp` / `gatekeeper-mcp-portal`. |
| Linear / Notion / Slack | Import gather via hosted MCP URLs. |
| OpenAI-compatible proxy | Governed `/chat/completions` (OD-2 entry 2a). |

## Migration and reconciliation

OD-1 Branch A: shapes + fixture mapping dry run. No Postgres load. GitHub
installs cannot be transplanted; they re-authorize. Delivery history is not
migrated. Memory/projections regenerate, never ETL.

## Tests and parity fixtures

`packages/connectivity/src/*.test.ts` plus `packages/github-hooks/src/*.test.ts` — Instantly read-only + forbidden methods;
row 14 read-propose-approve-resume; row 15 duplicate webhook; HMAC; retry ladder;
OD-6 blocked egress; GitHub six-event goldens; cron/DST; Notion 32-hex collapse;
AiFeature tagging; on-activity memory; MCP harvest + kill switch; SEC-3
cross-tenant; XOR webhook owner.

## Observability/SLOs

Delivery success + attempt histogram; endpoint pause rate; p95 delivery lag
target < 60s on the healthy (non-OD-6) path; per-`AiFeature` spend; automation
on-time rate; import success; memory regen cost; MCP per-tool invocation log;
completions allow-list rejects.

## Failure modes and rollback

`ConnectivityError`. Poison webhook endpoints auto-pause. Completions and MCP
server each have an independent kill switch. Wrapper rollback = redeploy
previous wrapper; kernel untouched. Safe-fetch swap when OD-6 lands.

## Open decisions

- **OD-6** — SSRF / safe-fetch mechanism (blocks live webhook egress parity).
- **OD-29** — team-scoped credential ruling (recommendation implemented).
- **OD-12(c)** — per-vendor Gatekeeper session inventories.
- **Instantly writes** — not started; Session API is read-only pending David.
