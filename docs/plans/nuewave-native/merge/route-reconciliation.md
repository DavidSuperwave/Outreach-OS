# Route reconciliation — unified route map design

> Created 2026-08-19 by the merge-review pass (workstream 2 of
> `next-agent-prompt.md`). Grounded in `endpoint-inventory-backend.md`
> (authoritative for endpoints; not re-derived), the proxy table in
> `../reference/platform-context/platform-canvas.md`, and fresh source reads
> of the CF-OS router and the lifted services. Pointers: `[NW]` = Neuwave
> clone @ `9f7a26b`, `[OS]` = this repo; `path:line` from each repo root.
>
> **Status: proposal.** Every resolution below is an option set for David;
> nothing here is ruled. The ruling batch is §9.

## 1. The two routing worlds

**Old world (Neuwave).** Two different schemes existed at once:

- *Deployed:* no path prefixes at all — every service had its own hostname
  (`auth-service.macro.com`, `cloud-storage.macro.com` = DSS,
  `document-cognition.macro.com`, `connection-gateway.macro.com` wss, …) —
  `[NW] apps/web/src/lib/core/constant/servers.ts:25-40`.
- *Local/dev:* a generated Caddy single-origin proxy with **prefix
  stripping** — `/auth`, `/dss`, `/cognition`, `/contacts`, `/email`,
  `/notification`, `/unfurl`, `/image-proxy`, `/connection-gateway` (WS)
  from the xtask inventory
  (`[NW] tooling/xtask/crates/xtask_local/src/local/inventory.rs:85-226`),
  plus special routes `/sync`, `/lexical`, `/ai-editing` (stripped),
  `/i/*` (not stripped), `/static-file` (split-routed), `/websocket`
  (`[NW] tooling/xtask/crates/xtask_local/src/local/proxy.rs:79-167`).
  The prefix is stripped before forwarding, so services never know their
  mount point.

Additional old-world quirk that must NOT be recreated: every Rust service
double-mounts its router under a **wildcard** `/{version}` segment
(`.nest("/{version}", r).merge(r)` — verified
`[NW] services/document_storage_service/src/api/mod.rs:282-291`). Any first
path segment matches — DSS effectively claims `/anything/documents`. DSS
additionally wraps itself under `/dss` (so `/dss/{version}/foo` also
resolves). Lifted verbatim onto one shared origin, these wildcards would
shadow every other service. The specs only ever emit literal `/v1`/`/v2`.

**New world (CF-OS router).** `[OS] cloudflare-os/packages/router/src/index.ts`
(69 lines):

1. `GATEKEEPER_*` service bindings → `/gatekeeper/<name>/*` prefixes,
   forwarded **unstripped** — gatekeepers self-route on their full path via
   a `BASE_URL` convention (representative:
   `[OS] cloudflare-os/packages/gatekeeper-github/src/github.ts:357-364,936-1006`).
   Note: `packages/custom-gatekeeper` referenced in `agent-brief.md` does
   not exist at the current submodule pin; gatekeeper-github is the
   registration reference.
2. `/api`, `/api/*`, `/blueprint-screenshot`, `/blueprint-screenshot/*` →
   workshop-backend (index.ts:37-41).
3. Everything else → static assets with SPA fallback
   (`run_worker_first: ["/api","/api/*","/blueprint-screenshot","/blueprint-screenshot/*","/gatekeeper/*"]`,
   `[OS] cloudflare-os/packages/router/wrangler.jsonc:20-31`).
4. Inbound email → `GATEKEEPER_EMAIL.email()` (index.ts:62-68).

Reserved prefixes today are exactly `/api`, `/blueprint-screenshot`,
`/gatekeeper/*`. **Everything else belongs to the SPA.**

## 2. The central finding: `/api` is not a REST namespace

`[OS] cloudflare-os/packages/workshop-backend/src/server.ts:781-865`: the
backend serves `/api/site-logo`, `/api/client-errors`,
`/blueprint-screenshot/{id}`, and — at exact path `/api` — the **entire
product API as one capnweb workers-RPC WebSocket session**
(`newWorkersRpcResponse(req, new PublicApiImpl(...))`). Everything else
404s. The server even documents that OAuth callbacks moved to
`/gatekeeper/<name>/oauth` and "the backend no longer hosts /auth/*"
(server.ts:794-797).

Consequence: the phrase "rebuilt domains get new routes under `/api/*`"
cannot mean REST paths. Three coherent models for rebuilt-domain surfaces:

- **Option R1 — RPC-first (kernel-native).** Rebuilt domains become typed
  RPC methods on `PublicApiImpl` (or namespaced sub-objects of it). No new
  HTTP paths except where HTTP is physically required (webhooks, WS
  protocols, redirects, CDN-style GETs). This matches the Soup ruling
  ("typed RPC, not GraphQL") and the kernel's own direction.
- **Option R2 — new REST namespace.** Add one new reserved prefix (e.g.
  `/svc/<domain>/*`) dispatched by the router to domain workers, keeping
  old REST shapes 1:1 under it. Faithful to old wire shapes, but recreates
  ~490 endpoints the new frontend doesn't need verbatim (the UX is being
  recreated, not the SDK).
- **Option R3 — hybrid (proposed default).** RPC-first per R1; a small
  explicit HTTP surface for the cases RPC cannot serve (§6 webhooks,
  §5 WebSockets, file/CDN GETs, `/.well-known`). This is what the rest of
  this document assumes; if David rules R2, §3's "RPC" cells become
  `/svc/*` paths instead.

**Ruled: R3 (David, 2026-08-19)** — RPC-first with the small explicit
HTTP surface (webhooks, WebSockets, file/CDN GETs, `/.well-known`).
§3's map stands as written.

## 3. Proposed unified route map (one origin)

| Path space | Owner (proposed) | Old analogue | Notes |
|---|---|---|---|
| `/` + all unclaimed paths | SPA (rebuilt frontend, split-layout shell) | `apps/web` at `/app` | SPA fallback per router |
| `/api` (exact) | workshop-backend capnweb RPC — hosts all rebuilt-domain methods (documents, projects, channels, soup lists, CRM, mailbox, calendar, reminders, favorites, activity, search…) | `/dss`, `/cognition`, `/contacts`, most of `/email`, `/notification` | Option R3; per-domain method surfaces are design-time work in each domain audit |
| `/api/site-logo`, `/api/client-errors`, `/blueprint-screenshot/*` | workshop-backend (existing) | — | unchanged kernel surface |
| `/gatekeeper/<name>/*` | gatekeepers (existing ~17 + new connectors from the connectivity layer) | `mcp_service`, auth `/link/*`, `scheduled_action` | unstripped; names from binding keys — collision-check new names against existing packages |
| `/sync/*` | **lifted sync-service** | local proxy `/sync` (stripped) — `[NW] proxy.rs:119-123` | see §4; includes collab WS `/sync/document/{id}/connect` |
| `/lexical/*` | **lifted lexical-service** | local proxy `/lexical` (stripped) | internal-auth-gated except health; docs UI at its root — decide expose/disable |
| `/ai-editing/*` | **lifted ai-editing-worker** | local proxy `/ai-editing` (stripped) | browser-called `POST /ai-editing/edit`; CORS allowlist becomes moot same-origin but config still encodes old hostnames |
| `/auth/*` | rebuilt real auth (mount model = ruling §9-B) | `/auth` proxy → authentication_service (~79 endpoints) | OAuth callbacks land on `/gatekeeper/<provider>/oauth` per kernel model |
| `/hooks/*` | webhook ingress (§6) | auth Stripe webhooks, `/gmail/webhook`, DSS `/webhook`, `/cal/webhook` | HTTP-required; cannot be RPC |
| `/files/*` (or signed R2 URLs) | file serving replacement for static_file_service | SFS `/api/file/*` + CDN `/file/{id}` | design-time choice; SFS's `/api/*` prefix is a hard collision (§7-1) and dies |
| `/.well-known/*` | router special-case or static assets (§6) | AASA + OAuth metadata | only if native-app links / MCP OAuth host are kept |
| `/health` | one router-level health (optional) | 16 per-service `/health`s | per-prefix healths survive inside `/sync`, `/lexical`, `/ai-editing` |

Not mounted (superseded — §8): `/cognition`, `/dss`, `/contacts`,
`/notification`, `/unfurl`, `/image-proxy`, `/connection-gateway`,
`/websocket`, `/i/*`, `/mcp`, `/static-file`, `/{version}` wildcards.

## 4. Lifted services — mount design

**The strip question (applies to all lifted services).** The old local
proxy stripped prefixes; the CF-OS router forwards unstripped. Two options:

- **L1 — router strips for lifted prefixes (proposed).** Add a small
  "lifted services" dispatch block to the router that strips `/sync`,
  `/lexical`, `/ai-editing` before forwarding to their service bindings.
  Services stay byte-for-byte lifted (the point of the lift ruling);
  exactly mirrors the old local proxy behavior they already ran under.
- **L2 — services learn `BASE_URL`** (gatekeeper pattern). Keeps the
  router dumb but modifies the lifted code — contradicts "lift as-is".

**Ruled: L1 (David, 2026-08-19)** — router strips the lifted prefixes;
services stay byte-for-byte. The three prefixes `/sync`, `/lexical`,
`/ai-editing` are confirmed as named.

Per service:

| Service | Routes at pin | Mount | Notes |
|---|---|---|---|
| sync-service (Rust/WASM, DO+D1+R2+KV) | worker: `/`, `/health`, `/schema`, `/document/{id}/copy`, `/document/{id}/{*rest}` → DO (13 DO routes incl. WS `/document/{id}/connect`) — `[NW] services/sync-service/src/cf_worker.rs:118-134`, `durable_object.rs:849-903` | `/sync/*` | No routes/custom-domains in its wrangler.toml (workers.dev only) — mount point is genuinely free to choose. Couplings to rewire at design time: it calls back into DSS (`DSS_URL`) incl. DSS's `/sync_service/wakeup`, and SPS — these targets dissolve with DSS and need kernel-side replacements. Frontend `service-sync` client has the path shape baked in; base URL is config. |
| lexical-service (TS Hono) | `/`, `/health`, `/plaintext/:docId`, `/cognition/:docId`, `/cognitionv2/:docId`, `/cognition/presigned`, `/search/:docId`, `/markdown/:docId`, `/xml/:docId`, `/snapshot/markdown`, `/mentions`, `/internal/health` — `[NW] services/lexical-service/src/index.ts:97-120` | `/lexical/*` | Internal-auth-key gated; mounting under a prefix dissolves its `/cognition`/`/search` name clashes (§7-7/8). Its `GET /` OpenAPI docs UI should probably not ship publicly — flag for design. Service binding to sync-service carries over. |
| ai-editing-worker (TS Hono) | `POST /edit`, `GET/DELETE /traces/:documentId` — `[NW] services/ai-editing-worker/src/endpoints/edit.ts:98`, `traces.ts:33,48` | `/ai-editing/*` | Browser-called; auth = document permission token in body. Env points at sync-service WS + DSS + contacts + auth — the DSS/contacts/auth targets dissolve; rewire at design time. D1 `TRACES_DB` comes with it. |
| coding-agent-worker | **Empty at the pin.** `git ls-tree` shows only `bun.lock`; the commit that added it ("agent runtime protocol #5000") actually delivered `crates/agent_runtime_protocol` (a WS/ACP protocol library, no HTTP router). | **nothing to mount** | The lift ruling for this service has no object at `9f7a26b`. Needs David's acknowledgment (§9-A3): drop from the lift set, or track as future-only if source lands on a later SHA (which would break the pin). |

## 5. WebSocket map

Four distinct WS surfaces, four protocols — all need stable non-overlapping
paths:

| WS | Protocol | Old path | Proposed new path | Status |
|---|---|---|---|---|
| Kernel RPC session | capnweb | — | `/api` (exact) | exists; taken |
| Collab editing (sync-service) | binary bebop | `/document/{id}/connect` (own hostname / `/sync` local) | `/sync/document/{id}/connect` | follows §4 mount |
| connection_gateway fan-out | JSON (`track_entity`, `stream_events`; carries AI stream) | `GET /` on its own hostname — `[NW] services/connection_gateway/src/api/connection/mod.rs:34` | none — **propose supersede** | Ledger proposes DO hibernatable WebSockets; the kernel's `/api` session is the natural carrier for entity/stream push. If a dedicated fan-out WS survives design, it needs a new path (e.g. `/ws`) + a rebuilt worker — its old upgrade-at-root shape cannot be lifted. Unruled row; flagged in §9. |
| Soup GraphQL-WS | graphql-ws (`soupUpdates`) | DSS `/items/soup/graphql/ws` | none — dies with `graphql_soup` (ruled killed 2026-08-19) | soup push arrives via native RPC/WS per the Soup ruling |

## 6. HTTP-required surfaces (cannot be RPC)

- **Webhooks.** Old inbound webhooks: Stripe (rides on authentication_service),
  Gmail push (`/gmail/webhook` on email_service), calendar
  (`/cal/webhook` on DSS), generic webhook ingestion (`/webhook` on DSS,
  `crates/webhook`), GitHub. Proposal: one reserved `/hooks/<source>/*`
  ingress prefix routed to the owning rebuilt domain/gatekeeper —
  vs. the alternative of per-gatekeeper webhook paths under
  `/gatekeeper/<name>/hooks`. Either works; pick one convention (§9-C2).
  Note the router already has an `email()` handler for Cloudflare Email
  Routing — a design-time option to replace Gmail push entirely for
  inbound mail (mailbox audit will inform this).
- **`/.well-known/*`.** Old: `apple-app-site-association`
  (`[NW] crates/native_app_service/src/inbound.rs:42`) and the MCP OAuth
  metadata (`/.well-known/oauth-protected-resource*`,
  `oauth-authorization-server*` — RFC-mandated at origin root). Under
  CF-OS these fall to the SPA today. If native-app deep links or a
  first-party MCP host survive design, the router needs a `/.well-known`
  special case; OAuth metadata is config-dependent and can't be a static
  asset.
- **File/CDN GETs.** Old SFS CDN route `GET /file/{file_id}` (CloudFront →
  S3) and `/api/file/*` API. Replacement is R2-native at design time:
  signed R2 URLs vs. a `/files/*` worker route. Either kills the `/api/*`
  collision (§7-1).
- **Desktop auto-update feed** (`/update/*` on auth service) — only if the
  desktop app survives; park with business-chrome-adjacent decisions.

## 7. Collision register

Each: the collision → proposed resolution. Full detail for anything already
summarized above is in the sections referenced.

1. **SFS owns `/api/file/*`** vs. CF-OS `/api` → workshop-backend 404s it.
   *Resolution:* SFS is not lifted; file serving rebuilt on R2 (§6). No
   old `/api/*` path survives.
2. **`/api` semantics** — REST vs. capnweb RPC. *Resolution:* ruling §9-A1
   (R1/R2/R3).
3. **`/.well-known/*`** swallowed by SPA. *Resolution:* §6; only if kept.
4. **~490 old root-level paths** (`/documents`, `/chats`, `/login`,
   `/search`, `/user_notifications`, …) all fall to SPA. *Resolution:* by
   design — they are not recreated as paths; domains surface via RPC (R3)
   or under new reserved prefixes (R2). The frontend recreation must not
   assume old fetch paths.
5. **`/auth` model clash** — old service owns `/login`, `/oauth2/*`,
   `/session`, etc.; kernel moved OAuth to gatekeepers and dropped backend
   auth routes. *Resolution:* ruling §9-B — auth-as-gatekeeper
   (`providesAuth: true` pattern, `[NW→OS analogue] gatekeeper-github.ts:1022`)
   vs. dedicated `/auth/*` reserved prefix on a rebuilt auth worker.
6. **`/email` double-claim** — auth's verification routes
   (`/email/verify/fusionauth/{id}` — note spec-drift flag #1) vs.
   email_service's whole surface. *Resolution:* dissolves under R3 (both
   become RPC/gatekeeper surfaces); if R2, rename auth's to
   `/auth/email-verification/*`.
7. **lexical `/cognition/:docId` vs. old `/cognition` (DCS) prefix** —
   *Resolution:* dissolves — DCS's `/cognition` prefix is not mounted
   (superseded), and lexical lives under `/lexical/*`.
8. **lexical `GET /search/:docId` vs. DSS `POST /search`** — same first
   segment. *Resolution:* dissolves under the `/lexical` prefix; search is
   RPC.
9. **Three services claim `GET /`** (lexical docs UI, sync root marker,
   connection_gateway WS upgrade) vs. SPA root. *Resolution:* prefixed
   mounts (§4) + connection_gateway superseded (§5).
10. **16× `/health`** — *Resolution:* per-prefix healths survive under
    lifted prefixes; rebuilt domains don't get path healths (kernel
    observability instead).
11. **`/proxy` twice** (unfurl_service, image_proxy_service — identical
    path, different services). *Resolution:* both unruled rows; if kept,
    they become worker fetches behind RPC or distinct prefixes
    (`/unfurl/*`, `/image-proxy/*`). Flag to their ledger rows.
12. **sync `/document/{id}` vs. rebuilt documents domain** — no literal
    collision (singular vs. plural `/documents`), and documents become RPC
    anyway; prefix mount removes residual confusion.
13. **ai-editing CORS/hostname config** — allowlist + `SYNC_WS_BASE`
    encode old Macro origins. *Resolution:* config-only change at lift
    time (allowed — config, not code).
14. **coding-agent-worker empty** — §4; ruling §9-A3.
15. **WS path space** — §5.
16. **`/{version}` wildcard mounts** — *Resolution (proposed):* not
    recreated. New surfaces are unversioned; literal `/v1` only if some
    lifted client demands it (none found).
17. **DSS-served "standalone-looking" services** — properties, public
    search, calls have their own specs/frontend clients
    (`service-properties`, `service-search`, `service-call`) but are
    mounted IN DSS. *Resolution:* route map keys on services, not
    frontend clients; these become RPC method groups of their rebuilt
    domains, not separate mounts. (Trap documented so the Linear scope-map
    agent doesn't create phantom services.)
18. **Gatekeeper name collisions** — new connector gatekeepers (connectivity
    layer) must not collide with the ~17 existing package names
    (cloudflare, confluence, email, github, google, homeassistant, linear,
    mcp, mcp-portal, notion, scheduler, slack, spotify, supabase, zoominfo…).
    *Resolution:* naming check at design time; no path collisions possible
    (binding-derived).
19. **Functional overlaps (not path):** old auth `/link/github|gmail` ↔
    gatekeeper-github/google; DCS `/mcp/servers*` + mcp_service ↔
    gatekeeper-mcp/mcp-portal; scheduled_action ↔ gatekeeper-scheduler.
    *Resolution:* mark superseded (§8); their ledger rows get this
    cross-ref.
20. **`/i/*` analytics-proxy** (already a CF worker, unstripped
    convention) — outside the four-service lift ruling. *Resolution:*
    unruled ledger row; if kept, keep `/i/*` as-is (it's collision-free).

## 8. Superseded prefixes — do not mount

`/dss`, `/cognition`, `/contacts`, `/notification`, `/connection-gateway`,
`/websocket`, `/static-file`, `/unfurl`, `/image-proxy`, `/mcp` (+
mcp_auth_proxy's `/authorize`, `/register`, `/token`), `/{version}`
wildcards, and auth's `/link/*`. Rationale per §7-4/5/19. Their
*capabilities* keep their ledger rows; only the old wire locations die.

## 9. Ruling batch this document produces

**Batch A — route model.**
- A1: rebuilt-domain surface model — R1 RPC-first / R2 REST namespace /
  **R3 hybrid (proposed)**.
- A2: lifted-service mounting — **L1 router strips (proposed)** / L2
  services learn BASE_URL. Also confirm the three prefixes `/sync`,
  `/lexical`, `/ai-editing`.
- A3: coding-agent-worker is empty at the pin — drop from lift set, or
  re-pin question. (Recommend: drop; revisit only if David knows where the
  real worker source lives.)
  **Ruled: dropped from the lift set (David, 2026-08-19)** — an
  all-refs/all-history search of both repos (agent, 2026-08-19) found no
  source ever committed anywhere; the bun.lock (`daytona-bun-hello`: Bun +
  Daytona SDK + Ink CLI, zero Cloudflare deps) was never a CF Worker. The
  lift set is three services. A future coding-agent capability is tracked
  as a ☐ ledger row (new scope on the kernel agent runtime, not a lift).

**Batch B — auth mount** (interacts with the auth rebuild design, not just
routes): auth-as-gatekeeper vs. dedicated `/auth/*` worker prefix.

**Ruled: deferred (David, 2026-08-19)** — the mount choice is explicitly
deferred to auth design time (it depends on the session/token-custody
architecture). `/auth/*` stays reserved in the §3 map until then; both
options stand for that session.

**Batch C — conventions.**
- C1: connection_gateway — supersede by kernel `/api` session push
  (proposed) vs. rebuild a dedicated `/ws` fan-out.
  **Ruled: supersede by kernel `/api` session push (David, 2026-08-19)**
  — the gateway's event types (track_entity/stream_events, AI stream,
  email refresh) become kernel session events at domain design time; no
  dedicated `/ws` service.
- C2: webhook ingress convention — `/hooks/<source>/*` vs.
  per-gatekeeper webhook paths.
  **Ruled: `/hooks/<source>/*` unified ingress (David, 2026-08-19)** —
  all external webhook callers land on the one reserved prefix; router
  dispatches by source. Per-gatekeeper paths are not the convention
  (existing kernel gatekeeper OAuth callbacks are unaffected).
- C3: `/.well-known` special-case — needed only if native-app links /
  first-party MCP host survive (can be deferred to those rows' rulings).
  **Ruled: deferred (David, 2026-08-19)** — decision explicitly deferred
  to the native-app-links / first-party-MCP-host ledger rows; the
  special-case is added only if one of those survives.

## 10. Coverage

Inherited and new caveats — do not trust silently:
- Endpoints come from `endpoint-inventory-backend.md` (its own caveats
  apply: ~20 queue/Lambda workers and TS-service internals never
  extracted). Spot-verified in source: DSS double-mount, sync worker
  router, both TS lifted services' full routers, the xtask proxy
  generation, `servers.ts`.
- The workshop-backend `PublicApiImpl` RPC method surface was **not**
  enumerated — the R1/R3 model's "method namespace" design needs that
  enumeration at domain-design time.
- sync-service DO routes taken from the inventory (worker-level forward
  verified; DO router not re-read line-by-line).
- Old deployed-infra routing (CloudFront config for `/file/{id}`, DNS for
  `*.macro.com`) not inspected beyond `servers.ts`.
- Other gatekeepers' fetch handlers beyond gatekeeper-github not
  individually checked.
- coding-agent-worker verified empty at `9f7a26b` via `git ls-tree`; later
  history not searched.
