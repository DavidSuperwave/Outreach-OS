# Cloudflare OS capability map

> Workstream A of the Nuewave-native rebuild planning set.
> Ground truth for every other plan in `docs/plans/nuewave-native/`.
> Verified against: wrapper repo `DavidSuperwave/Outreach-OS` @ branch
> `david/sup-536-home-cannot-load-ai-models-for-openrouter`, submodule
> `cloudflare-os` pinned at upstream `bf7f762` (August 2026 release, "v2").
> Date: 2026-08-19.

## Why this document exists

The Nuewave pilot (Macro × CF-OS merge-by-contract) cannot ship as a Macro fork
for license reasons. The team green-lit a **concept-level rewrite**: rebuild the
shell and the needed product concepts natively on Cloudflare OS, drop AWS
entirely, and never copy Macro/Neuwave source. The Outreach OS pilot folds into
this effort rather than remaining standalone. This document maps what the
Cloudflare OS build in this repo actually provides, where the extension points
are, and where the hard walls are.

**License rule for all plans:** the Macro platform-context docs (in
`DavidSuperwave/Neuwave` branch `cursor/platform-context-docs-2f7d`,
`docs/internal/platform-context/`) may be used as *concept references* —
feature inventories, UX vocabulary, flow shapes. No Macro source code, schema,
or asset may be ported. Everything here is written from Cloudflare OS and
wrapper sources only.

---

## 1. Repo topology

| Layer | Location | Role | Change policy |
|---|---|---|---|
| Wrapper repo | repo root (`Outreach-OS`) | Deployment controls, custom Gatekeepers, error reporter, deploy scripts (`scripts/deploy.mjs`), `deployment.jsonc` | Ours; free to change |
| Pinned kernel | `cloudflare-os/` git submodule @ `bf7f762` | The whole OS: kernel, frontend, gatekeepers, router | Upstream's. `AGENTS.md` (wrapper): "do not fork `workshop-backend`". `docs/customization.md`: prefer wrapper Workers + service bindings; modify upstream only as reviewable commits, never generated overlays |
| Kernel patches | `patches/sup-536-openrouter-kernel.patch` | Parked kernel diffs (OpenRouter as first-class provider) | Applied manually inside the submodule; shipping requires a pin/fork decision (unresolved) |

Upstream (`cloudflare-os/AGENTS.md`) defines the trust gradient explicitly:
`workshop-backend` is **the kernel**, held to the highest review bar;
`workshop-shared/src/api.ts` is the frontend↔backend RPC contract; UI and
gatekeeper code are explicitly held to a *lower* bar. Upstream is not seeking
outside contributions beyond trivial fixes, so "contribute it upstream" is a
slow path, not a plan of record.

Deploy pipeline: `pnpm deploy` derives temporary Wrangler configs from
upstream base configs, builds the frontend in Cloudflare Access mode
(`VITE_CF_ACCESS_MODE=true`), deploys Error Reporter and Gatekeepers before the
Workshop, and never writes secrets into tracked config. Sign-in is Cloudflare
Access by default; password accounts and auth-Gatekeeper sign-in
(`AUTH_GATEKEEPERS`, `DISABLE_PASSWORD_AUTH`) exist upstream but need deploy
script changes (`docs/customization.md#sign-in-methods`).

## 2. Runtime architecture

Everything is Cloudflare Workers + Durable Objects. No Postgres, no queues, no
external search engine, no AWS anywhere.

```
Browser (React SPA, Cap'n Web RPC over one WebSocket)
   │
   ▼
router worker (packages/router/src/index.ts, ~70 lines)
   ├─ /api/*, /blueprint-screenshot/*  → workshop-backend (the kernel)
   ├─ /gatekeeper/<name>/*             → any Worker bound as GATEKEEPER_*
   └─ everything else                  → ASSETS (built SPA) — dev: falls through
   └─ email()                          → GATEKEEPER_EMAIL if bound
```

Key kernel objects (`packages/workshop-backend/src/`):

- **User DO** (`user.ts`, ~1.7k lines) — one per account. Sessions, connected
  accounts, configured AI models (BYOK), blueprint library, workspace list.
  `getGatekeeperClassFor()` is the single chokepoint enforcing admin
  disable policy before any capability is minted.
- **Overseer DO** (`overseer.ts`, ~9.5k lines) — **one per workspace**. Owns
  workpieces (gadgets), chats, the action/approval queue, hooks, sharing graph,
  code (a single Yjs doc, one root map per gadget), presence, blueprints.
- **Gadgets** — each runs in a **Dynamic Worker Facet** of the workspace DO,
  internet access disabled; client UI runs in a sandboxed iframe speaking
  Cap'n Web over `postMessage`. Gadget server code gets its own SQLite (DO
  storage) and only the bindings explicitly wired to it.
- **Gatekeepers** — separate Workers implementing
  `workshop-shared/src/gatekeeper.ts` (`GatekeeperVendor` → `GatekeeperUser`
  (account) → `Gatekeeper` DO → typed `Session`). They install facets into
  workspaces; every read is an **observation**, every side effect is an
  **action** that queues for approval with local simulation so the agent never
  blocks. Auto-approval per action-kind, per workspace (`auto-approval.ts`).
- **Agent** (`agent.ts`, ~3.2k lines) — a Code Mode agent loop
  (`@earendil-works/pi-agent-core`): the model writes TypeScript executed
  against the chat's `env` of named bindings (gadgets + gatekeepers). Context
  compaction is built in (`agent-compaction.ts`). Chats live per workspace;
  proposed code changes are chat-scoped branches merged or reverted by the
  user (`mergeChanges`/`revertChanges`).
- **AdminSettings DO** (`admin-settings.ts`) — authoritative `AdminConfig`
  (instructions, banners, connector policy, featured blueprints, formats),
  mirrored to one KV key for cheap hot-path reads.
- **External message gateway** (`external-message-gateway.ts`, shared type in
  `workshop-shared/src/external-message-gateway.ts`) — a service-binding RPC
  (`submitExternalMessage`) that lets a *trusted* wrapper Worker inject a chat
  message for any user (keyed by verified email), routed to a workspace/chat by
  stable keys, with an at-least-once response callback. This is the sanctioned
  seam for inbound email/Slack/webhook-driven agent runs.

### Client↔server contract

`packages/workshop-shared/src/api.ts` (2.9k lines, fully doc-commented) is the
complete RPC surface: `PublicApi` → `AuthenticatedApi` (profile, models,
gadget/workspace listing, connected accounts, blueprints, gatekeeper apps,
admin) → `Overseer` (per-workspace: metadata, presence, workpieces, Yjs code
sync, gatekeepers, actions, hooks, chats + streaming, slash commands,
blueprints, collaborators, share links). **Any alternative frontend that
speaks this protocol over `/api` gets the whole OS.** Cap'n Web gives promise
pipelining; stubs must be disposed.

## 3. Extension points that need no kernel fork

| Extension point | Mechanism | What it can do | What it cannot do |
|---|---|---|---|
| Custom Gatekeeper | New wrapper package + `GATEKEEPER_*` service binding on router & workshop (see `packages/custom-gatekeeper`, bound as `GATEKEEPER_CUSTOM`) | Full integration surface: OAuth, URL-scoped resources, observations, simulated writes w/ approval, hooks (async wake-ups), slash commands, per-account singleton sessions, full-page management UI (`startAppUi`), resource configurator UI | Cannot self-declare ambience (admin policy decides); cannot bypass observation/action accounting; UI runs in sandboxed `srcDoc` iframe |
| Ambient/auto-provisioned accounts | `VendorDescription.autoProvisionsAccount` + admin mode disabled/optional/enabled (`provisioning-policy.ts`) | Zero-OAuth org capabilities present in every chat env as a named binding (e.g. `CUSTOM`, `CONTEXT`) | — |
| Context Library | `gatekeeper-context` (own DOs + KV, optional Git-backed Artifacts storage; `deployment.jsonc#context`) | Private/public curated document collections agents read as observations; admin-published org knowledge; management UI at `/gatekeepers/context` | Not a vector DB; no search index — collections are read wholesale as observations |
| Scheduler | `gatekeeper-scheduler` (ambient; `ScheduleDriver` DO + alarms) | Persistent scheduled callbacks into workspaces → cron-style agent/gadget automation | — |
| MCP | `gatekeeper-mcp` (user-pasted endpoints) and `gatekeeper-mcp-portal` (admin-vetted portal; only source of auto-applied writes via `MCP_PORTAL_TRUST_ANNOTATIONS`) | Reach any external MCP tool with the same observation/approval discipline | Non-read-only tools always queue unless portal-vetted |
| Admin config | `/admin` UI (no redeploy) | Site name/logo/accent, announcements, **agent instructions** (8k chars), connector availability, featured blueprints, output formats, signup behavior | Auth config deliberately excluded (env-var only) |
| Blueprints | `.gadget` archives; per-deployment **format blueprints** — `FORMAT_BLUEPRINTS_DIR` lets a wrapper ship its own set without touching the submodule | Reusable app templates with binding requirements; admin-promoted "New Document/Slides/…" formats | Capture code only — no data, chats, or credentials |
| External message gateway | Wrapper Worker with a service binding to the backend | Inbound email/Slack/webhooks → agent chats; responses called back | Trusted seam — the backend believes `callerEmail`; keep the gateway Worker private |
| Email | `gatekeeper-email` + router `email()` handler | Email Routing into the OS (needs a zone) | Dormant until custom domain + Email Routing configured |
| AI catalog | `deployment.jsonc#aiGateway` + `CF_AI_GATEWAY_API_TOKEN` | Deployment-funded model catalog via AI Gateway (anthropic/openai/google/cloudflare/openrouter), Workers AI direct or gatewayed | OpenRouter needs the SUP-536 kernel patch (see §5) |
| Storage reuse | `deployment.jsonc#resources` | Bind existing KV/R2 instead of auto-provisioning | — |

The upstream skill `.agents/skills/write-gatekeeper/SKILL.md` is the canonical
guide for gatekeeper work.

## 4. The frontend shell — what "rebuild the shell" can mean

`packages/workshop-frontend` is a pure client-side React SPA: TanStack Router
(file routes in `src/routes/`: home `index.tsx`, `workspaces`, `workspace.$id`,
`gadget.$id`, `blueprints`, `blueprint.$id`, `explore`, `outputs`,
`gatekeepers`, `gatekeepers_.$appId`, `providers`, `context`, `profile`,
`admin`, `signup`), Kumo UI components, Phosphor icons, Vite. Shell chrome
lives in `src/components/AppShell/` (AppShell, Sidebar, CommandPalette,
HomeTaskSuggestions…). Chat UI in `src/ChatInterface.tsx` +
`src/components/chat/`; gadget editor in `GadgetEditor.tsx`/`GadgetUI.tsx`.

Facts that decide the rebuild strategy:

1. **There is no frontend plugin system.** Branding (name/logo/accent/banners)
   is the only runtime UI customization. No slots, no route injection, no
   theme system beyond accent color.
2. **The frontend is not the kernel.** Upstream's own review bar and the
   wrapper's no-fork rule single out `workshop-backend`. UI code is explicitly
   lower-bar. Forking or replacing the *frontend* is a materially smaller
   deviation than kernel changes.
3. **The entire product is reachable over the documented Cap'n Web API** from
   §2. The router serves whatever is in its `ASSETS` binding; in production
   that is the built SPA. A wrapper-owned frontend build (custom shell speaking
   the same protocol) can be substituted at the router's asset binding by the
   deploy script — a wrapper-side change, zero kernel edits.
4. Gadget UIs and gatekeeper management UIs are self-contained sandboxed
   iframes handed over RPC (`getUiBundle()`, `getGatekeeperApp()`), so a custom
   shell can host them exactly like the stock shell does.

So the realistic shell options, in ascending cost:

| Option | What it is | Cost/risk |
|---|---|---|
| A. Stock shell + admin config | Use upstream UI; brand it; encode product behavior in instructions, Context, blueprints, gatekeepers | Zero UI ownership; fastest; UX is generic CF-OS |
| B. **Custom shell as wrapper asset build** (recommended candidate) | New wrapper package (own React/Solid/whatever app) implementing the Nuewave UX against `workshop-shared` API; deploy script points router `ASSETS` at it | We own 100% of UX without touching the kernel; must track `api.ts` on upgrades; must re-implement chat/editor surfaces we want (or embed stock pages selectively) |
| C. Fork workshop-frontend | Patch upstream UI in place | Merge burden every upgrade; still no kernel risk; viable for targeted tweaks, bad as a strategy |
| D. Fork kernel | Only where the API itself is missing a concept | Last resort; SUP-536 shows the pain (patch file + pin decision parked) |

## 5. AI/model layer

- Providers (`api.ts` `AiModelProvider`): `openai | anthropic | google |
  cloudflare | ollama` — plus `openrouter` **only with the SUP-536 patch**.
- Per-user BYOK models (`addModel` w/ `AiModelConfig`: provider, model, token,
  optional `apiUrl`), a "quick model" for cheap tasks (titles), a preferred
  model, and `SUGGESTED_MODELS` per provider.
- Deployment-funded catalog: AI Gateway config (`CF_AI_GATEWAY`,
  `CF_AI_GATEWAY_ACCOUNT_ID`, `CF_AI_GATEWAY_API_TOKEN`,
  `CF_AI_GATEWAY_PROVIDERS`). Inference stays fail-closed on missing gateway
  credentials.
- SUP-536 status (`docs/sup-536-openrouter-changes.md`): Path B makes
  OpenRouter a first-class provider (chat-completions routing, catalog
  no-throw on half-configured gateway, attachment rules, UI label). Wrapper
  side is committed on the branch; kernel side lives in
  `patches/sup-536-openrouter-kernel.patch`; submodule still pinned at
  `bf7f762`. **Shipping needs a pin-vs-fork decision.** Known local-dev trap:
  two launch modes persist DO state in different `.wrangler/state` dirs →
  "invalid session token"; sign out/in, not a code bug.

## 6. Storage & data primitives for our code

| Primitive | Where used | Idioms for us |
|---|---|---|
| DO storage + **typed-storage** (`packages/typed-storage`) | Kernel DOs; available to wrapper Workers | Typed collections with unique/non-unique indexes, cursors, prefix/range list — the house ORM for DO SQLite |
| Gadget SQLite | Every gadget facet | Gadgets keep their own relational state; blueprints don't carry data |
| Yjs | Workspace code doc | Code sync/collab is already CRDT-based |
| KV | Admin config snapshot, blueprints index, avatars, Context snapshots | Cheap read-mostly snapshots; DO remains the writer |
| R2 | Blueprint content, screenshots, site logo | Blob storage |
| Artifacts (optional) | Context collections | Git-compatible storage for curated context |
| D1 / Queues / Vectorize | **Not used by the OS today** | Available to wrapper Workers if a plan needs them, but nothing in-kernel expects them |

## 7. Nuewave concepts → CF-OS reality (gap table)

Concept vocabulary from the Macro platform docs, mapped to what exists here.
"Wrapper" = new wrapper Worker/gatekeeper/shell code; "Cut" = drop from scope.

| Nuewave/Macro concept | CF-OS equivalent today | Gap & recommended path |
|---|---|---|
| Workspace / split-pane shell, Soup lists, blocks | Workspace list + per-workspace editor; no multi-pane shell, no unified cross-entity lists | **Custom shell (Option B)**; "blocks" become gadget UIs hosted in shell panes |
| Documents/tasks/notes editors | Gadgets (arbitrary apps) + output formats (document/slides blueprints) | Ship task/doc blueprints; heavy collaborative editors are a scope decision, not a kernel feature |
| Channels/messaging | Chats are agent-centric per workspace; multi-human chat possible (`modelId: null`) with presence + collaborators | Nearest fit: shared workspace + null-model chat. Real channel UX = custom shell + maybe wrapper DO; do **not** rebuild Macro comms stack |
| Work tab / task board | None built in | Task-board **gadget/blueprint** over workspace data, or shell view over `listGadgets`/`listOutputs` |
| Flow / AgentSession | Chats + agent spawner gatekeepers (`newAgentSpawnerGatekeeper`, `AgentSpawnerConfig`) + scheduler + hooks | Durable, resumable agent state exists per chat (DO-backed, survives restart). Orchestration policy = wrapper/gadget code |
| Broker / runner / provider switch | Model picker per message; BYOK per user; agent spawners pick models | Provider-neutral "Broker" collapses to model config + spawners. ECS runner fleet: **cut — Workers/DO replace it** |
| GitHub verifier ("only Done setter") | `gatekeeper-github` + hooks + action approval | Verification policy is a wrapper concern (gatekeeper hook + scheduler), not a kernel change |
| Approvals / decision queue | Action approval queue with simulation, auto-approve rules, `subscribeToActions` | Built in — stronger than the Macro plan. Surface in shell |
| Email sync/inbox | `gatekeeper-email` (inbound via Email Routing) + Google gatekeeper | No mailbox product. Outreach scope: **Instantly reads via a custom read-only gatekeeper** (Outreach OS pilot scope stands: propose Session API → stop for David; no send/activate) |
| Notifications/realtime | Per-workspace subscriptions (chat, actions, presence, code) over the WebSocket | No global notification center; shell aggregates subscriptions if needed |
| Search (OpenSearch) | None (blueprint/gadget lists only) | Cut or wrapper (D1/Vectorize) later; not v1 |
| CRM (companies/contacts) | None | Gadget + Context collections (Intraplex ICP); ZoomInfo gatekeeper exists upstream as reference |
| Identity/teams (FusionAuth) | Cloudflare Access (deployed) / password / auth gatekeepers; `admins` list; verified-email account key | FusionAuth: **cut**. Access is the pilot's answer |
| Sharing/permissions | Collaborators (`build`/`use`), share links, observer verification (read-through permission enforcement) | Built in, arguably ahead of the Macro model. Don't reinvent |
| Scheduled actions/automations | Scheduler gatekeeper + hooks | Built in |
| MCP | mcp + mcp-portal gatekeepers | Built in |
| Kafka/SQS/Redis/DynamoDB/S3 topology | DO + KV + R2 + alarms | **Cut wholesale** — this is the point of going CF-native |

## 8. Constraints to respect (honest list)

1. **Kernel API gaps require kernel changes.** Anything the `Overseer`/
   `AuthenticatedApi` surface can't express (e.g. cross-workspace queries,
   a global inbox feed, new workpiece types) means patch/fork/upstream-ask.
   Today's only parked kernel change is SUP-536; every new one compounds the
   upgrade burden. Treat kernel deltas as a budget, spend near zero.
2. **No cross-workspace data plane.** The User DO lists workspaces and
   outputs; there is no join across workspace contents. A "unified list"
   shell view is limited to metadata/outputs unless we add wrapper-side
   indexing (a gatekeeper/Worker that workspaces report into — design
   carefully around the sharing model).
3. **Sharing carries observer verification.** Any shared workspace whose
   gatekeepers read restricted data forces recipients to verify their own
   access. Plans that assume "just share the ops workspace with everyone"
   must check which gatekeepers it binds.
4. **Early-access software.** Upstream is v2, moving fast, and not accepting
   substantive contributions. Pin discipline + upgrade reviews
   (`docs/customization.md#upgrade`) are part of the operating cost.
5. **Windows dev friction is real** (pnpm spawn ENOENT; split `.wrangler`
   state). Standardize on one launch command per the SUP-536 notes.
6. **Secrets discipline**: never in Linear, never in tracked files;
   `.dev.vars` locally, `wrangler secret put` in prod. Human-only:
   Cloudflare login, DNS/Access, OpenRouter/Instantly keys.

## 9. Open questions

1. **Shell strategy decision** — Option B (wrapper-owned frontend on the
   documented RPC API) vs Option A (stock shell + config). Needs a
   spike: how much of ChatInterface/GadgetUI hosting must a custom shell
   re-implement to be useful? (Estimate before committing.)
2. **SUP-536 endgame** — pin a fork of the submodule with the patch applied,
   or hold Path B until upstream ships OpenRouter? Blocks the model catalog
   for the pilot.
3. **Cross-workspace index** — does the pilot actually need unified lists in
   v1, or do `listGadgets`+`listOutputs` cover the Work-tab-like view?
4. **Instantly gatekeeper** — read-only Session API sketch exists as scope in
   Linear (SUP-469); confirm it becomes a wrapper gatekeeper with
   observation-only methods and no action kinds.
5. **Multi-human channel UX** — is null-model chat + presence acceptable for
   the pilot's collaboration story, or is that scope cut entirely?
6. **workerd self-host** — upstream says "coming soon"; irrelevant for pilot
   but note for the runtime.superwave.io idea from the old plan.
7. **Which Linear issues survive** — the Nuewave board's AWS/infra lanes
   (SUP-482…489, 502, 512, 513…) are obsolete under this map; roadmap
   workstream should mark supersessions explicitly.
