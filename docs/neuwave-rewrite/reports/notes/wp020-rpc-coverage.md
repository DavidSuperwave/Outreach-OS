# WP-020 — Cloudflare OS RPC inventory: coverage note

Source of truth: `cloudflare-os/packages/workshop-shared/src/api.ts` (2,904 lines) at submodule pin
`bf7f762d7fa73553284d731ab6a978d3ea17be24`. The **entire file was read manually**, including all
comments (which carry the semantic contract recorded in the ledger). Ledger:
`docs/neuwave-rewrite/reports/02-rpc-compatibility-ledger.csv` (182 rows).

## Final method count — what is proven

| Count | What it is | Status |
|---|---|---|
| **181** | Named callable members across all 16 interfaces in `api.ts` | **Proven exact.** Three independent enumerations agree: (1) the mechanical parser (181 rows), (2) an awk re-parse of the pinned file producing the same 181 `(interface, method)` pairs with correct line numbers, (3) manual read of the whole file. |
| **+1** | Anonymous function-typed callback capability `RpcStub<(metadata: GadgetMetadata) => void>` — the parameter of `Overseer.subscribeToMetadata` (api.ts:1305) | **Proven exact.** `grep` for `=>` over the whole file shows this is the *only* bare arrow-function type in `api.ts`; a second grep confirms there are **zero** function-typed properties (`name: (...) => ...` members). |
| **= 182** | Total callable RPC surfaces in `api.ts`, and total ledger rows | Proven. |

Per-interface breakdown (all proven by enumeration): PublicApi 8, LoginAttempt 1,
ConnectedAccountsSubscriber 3, ObserverConfigCallback 1, AuthenticatedApi 51, AdminApi 16,
CodeSubscriber 2, Overseer 64 (+1 anonymous callback), ActionsSubscriber 2, AiChatSubscriber 7,
ConsoleLogSubscriber 1, WorkpiecesSubscriber 3, WorkpieceClient 4, GadgetClient 12,
GatekeeperClient 3, PresenceSubscriber 3.

Checked-for and confirmed absent: method overloads (none), generic *methods* (none — only the
generic *interface* `GatekeeperClient<Session>`), function-typed properties (none), type aliases
carrying callable members (none — all `export type`s in the file are data shapes; verified during
the full read).

## Comparison to prior counts

- **Mechanical parser (181):** correct on membership — it missed no named method (multiline
  signatures like `createAccount`, `startResourceConfigurator`, `subscribeConnectedAccounts` were
  all caught). It missed only the one anonymous callback capability.
- **Old plan estimate (~187):** an overcount by 5–6. No evidence was found of removed methods at
  this pin; the estimate was simply approximate and should be retired. **182** is the number the
  compatibility freeze applies to.

## What the mechanical parser missed (and why)

1. **Line-number drift (every row).** The parser's `source_line` values are wrong by up to ~330
   lines (e.g. `PublicApi.login` recorded at 65, actually at 91; `ActionsSubscriber.entry`
   recorded at 2345, actually 2346). The drift grows with preceding comment volume, i.e. the
   parser counted lines in a comment-stripped view. The ledger's line numbers were re-extracted
   from the raw pinned file and spot-verified by direct reads.
2. **The anonymous callback capability** at api.ts:1305 (see above) — invisible to a
   method-signature regex because it is a bare arrow type inside a parameter's `RpcStub<...>`.
   Added as ledger row `Overseer / subscribeToMetadata.callback`.
3. **Disposal as an operation.** Every `subscribe*` method returns `RpcStub<{}>` — a handle with
   *no* methods whose disposal is the unsubscribe operation; `LoginAttempt` disposal abandons the
   sign-in. No parser sees this; it is recorded per-row in `subscriptions_callbacks` /
   `reads_side_effects`. Contract tests must cover dispose-cancels semantics.
4. **Dynamic (unfreezable) surfaces.** `GadgetClient.connectToGadget(): RpcStub<any>` (the
   gadget-authored DO facet) and `GatekeeperClient.openSession(): RpcStub<Session>` (vendor-defined
   session; 19 `gatekeeper-*` packages) return capabilities whose method sets live outside
   `api.ts`. The ledger records the minting methods; the surfaces behind them need per-gadget /
   per-vendor contracts and are explicitly out of this ledger's scope.
5. **Non-callable contract surface (correctly excluded, listed here so it isn't lost):** wire-level
   constants and helpers that are part of the client/server contract even though they are not RPC —
   `SERVICE_SALT` (api.ts:30, input to the login hash), `OPEN_GADGET_ERROR_CODES` (255),
   `validateBindingName` (177, includes prototype-pollution guard), `MAX_ANNOUNCEMENT_LENGTH` /
   `MAX_SITE_NAME_LENGTH` / `MAX_INSTANCE_INSTRUCTIONS_LENGTH` / `MAX_SITE_LOGO_*`,
   `BANNER_COLORS`, `AMBIENT_GATEKEEPER_MODES`, `OUTPUT_ICONS`, `SUGGESTED_MODELS`,
   `WORKERS_AI_OUTPUT_LIMIT`, `isTextLikeAttachmentMimeType`, `blueprintScreenshotUrl`, and the
   validator helpers (`isHexColor`, `isBannerColor`, `isOutputIcon`, `isAmbientGatekeeperMode`,
   `resolveSiteName`, `createOpenGadgetError`/`getOpenGadgetErrorCode`). Freeze these alongside the
   methods.

## Caller-surface coverage — what is proven vs sampled

- **Proven (exhaustive grep):** every one of the 156 named request methods (non-subscriber
  interfaces) was grepped individually against `workshop-frontend/src` (`\.method(`) and
  `workshop-backend/src` (`\bmethod(`, excluding `api.ts`). Every method has ≥1 backend reference.
  Six have **zero frontend call sites**: `getPreferredModel`, `Overseer.createGadget` (agent-tool
  only; FE renders the tool record), `getGatekeeperById`, `Overseer.listActions` (FE deliberately
  uses `subscribeToActions` instead — see `useActions.ts` comment), `getChatMessage`,
  `GatekeeperClient.openSession` (agent env wiring). These are noted per-row; all kept `preserve`.
- **Sampled (named files):** concrete caller files were identified for ~20 high-traffic methods
  (e.g. `openGadget` → `useWorkspaceOpen.ts`/`GadgetList`/`SidebarWorkspaces`/`outputs` route;
  `subscribeConnectedAccounts` → 7 files; billing trio → `components/billing/*`; admin →
  `AdminPage.tsx`). For the remaining rows the `caller_surface` column names the interface-level
  surface (grep-verified to exist) rather than a specific file. Method-name greps can also match
  same-named locals; the per-file lists above were eyeballed, the raw counts were not.
- **Backend implementations located** (state-owner column grounded in code):
  `server.ts` — `PublicApiImpl`, `AuthenticatedApiImpl`, `LoginAttemptImpl`;
  `admin-settings.ts:554` — `AdminApiImpl`; `overseer.ts:7108` — `OverseerClientInterface`,
  `overseer.ts:8993` — `GadgetClientImpl`, `overseer.ts:9334` — `GatekeeperClientImpl`.
  Authorization detail worth preserving verbatim: `UseOverseerInterface` (overseer.ts:8767) and
  `UseGadgetClientInterface` (overseer.ts:9258) are compile-time **default-deny** wrappers for the
  "use" collaborator role — any new interface method breaks their build until a use-role decision
  is made. The rewrite should keep this pattern.

## Dispositions

178 of 182 rows: `preserve` (kernel surface, per WP-020 default). 4 rows `needs-review`
(all `preserve` provisionally, flagged for an owner decision):

1. `PublicApi.authenticateFromCfAccess` — only meaningful when deployed behind Cloudflare Access.
   Is Access-mode auth in scope for the Neuwave deployment?
2. `AuthenticatedApi.getCloudflareUsage` / `listCloudflareAccounts` / `selectCloudflareAccount`
   (plus `ServerConfig.cloudflareLimitsEnabled`) — the optional Cloudflare free-tier limits /
   top-up flow. Keep live, keep-but-disabled, or defer?

## Other owner decisions needed

- **`TODO(multi-gadget)` renames** in source: `openGadget`→`openWorkspace`, `newGadget`→
  `newWorkspace`, `GadgetMetadata`→`WorkspaceMetadata`, plus the `defaultGadgetId` backfill
  migration. Decide whether the freeze pins the current names (recommended) or adopts the renames
  with aliases before the freeze.
- **Password-hash contract**: `login`/`createAccount`/`changePassword` fix a client-side argon2id
  scheme keyed on `SERVICE_SALT`. Any Neuwave user migration must either reproduce this scheme
  client-side or force credential reset — this is a migration-plan dependency, not a code detail.
- **Per-vendor gatekeeper session contracts** (19 packages) and **per-gadget `connectToGadget`
  facets** need their own inventory or an explicit out-of-scope ruling; this ledger cannot freeze
  them.

## Test obligations summary (from the ledger's `contract_or_parity_test` column)

- `contract:req-resp` — plain request/response methods.
- `contract:capability-lifecycle` — methods minting/consuming stubs (`authenticate`, `openGadget`,
  `getAdminApi`, `create/getGadget`, `getBinding`, `openSession`, frames) incl. dispose semantics.
- `contract:streaming` — `downloadBlueprint`, `importBlueprint`, `exportPdf`
  (RPC-carried `ReadableStream`).
- `parity:subscription-replay` — all subscriber interfaces: replay-then-`ready()`, in-order
  delivery, dispose-cancels, `startAfter`/`fromVersion` resumption, and the
  `AiChatSubscriber.streamGeneration` restart-vs-reconnect protocol.
- `parity:streaming` — `AiChatSubscriber.stream` provisional-event discard protocol.
