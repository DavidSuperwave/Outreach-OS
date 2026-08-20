# ADR-002 — API/RPC compatibility boundary

- Status: Proposed (Draft — owner decides)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

> **Status note (Ruled 2026-08-20, see `../06-owner-decisions-needed.md`
> OD-16):** the auth-mount open question (standing deferral **B**) is closed —
> the custom shell consumes the kernel's `PublicApi`/`LoginAttempt` auth flow
> directly; no legacy mount paths are preserved (consistent with the OD-1
> fresh-start ruling — no live sessions exist). References to deferral B below
> are read as resolved. OD-12 (a/b/c) remains open.

## Context

The kernel exposes exactly **182 callable RPC capabilities** in
`cloudflare-os/packages/workshop-shared/src/api.ts` @ `bf7f762` (2,904 lines):
181 named members across 16 interfaces plus one anonymous callback capability
(`Overseer.subscribeToMetadata`'s `RpcStub<(metadata: GadgetMetadata) => void>`,
api.ts:1305). Proven by three independent enumerations
(`reports/notes/wp020-rpc-coverage.md`); per-row dispositions in
`reports/02-rpc-compatibility-ledger.csv` (182 rows: 178 `preserve`,
4 `needs-review`). Auth is a capability chain: PublicApi → AuthenticatedApi →
AdminApi/Overseer → WorkpieceClient/GadgetClient/GatekeeperClient, carried over
Cap'n Web on the `/api` WebSocket.

The rewrite adds Neuwave domains. The question is where new surface lives and
what is frozen.

## Source and ruling constraints

- 03-IMPLEMENTATION-PRINCIPLES §2: the RPC surface is a compatibility ledger;
  no opportunistic rename/merge/removal.
- Route ruling **R3** (research/nuewave-longtail @ `13c2847`,
  `merge/route-reconciliation.md`): RPC-first with a small explicit
  HTTP-required list. **C2**: `/hooks/<source>/*` unified inbound-webhook
  ingress. **L1**: lifted services mounted with stripped prefixes. **C1**:
  connection_gateway superseded by kernel `/api` session push. Deferred: **B**
  (auth mount), **C3** (`/.well-known`/native links).
- 04-TARGET: HTTP routes reserved for webhooks, OAuth callbacks, file
  delivery, streaming protocols, `/.well-known`.
- Kernel-change budget (ADR-014): no edits to `api.ts` without an ADR.

## Decision

**Proposed:**

1. **Freeze the 182-capability kernel surface at `bf7f762`.** Names,
   signatures, semantic comments, ordering/replay guarantees
   (replay-then-`ready()`, dispose-cancels, `startAfter`/`fromVersion`), and
   the non-callable wire contract (`SERVICE_SALT`, `validateBindingName`,
   `OPEN_GADGET_ERROR_CODES`, limit constants, validator helpers) are all part
   of the freeze. The stale "~187" estimate is retired.
2. **New product surface is wrapper-owned capabilities, not kernel edits.**
   Neuwave domains expose typed RPC capabilities minted from a wrapper entry
   capability (obtained after kernel authentication), or Worker service-binding
   interfaces for worker-to-worker calls. Namespacing: one capability
   interface per domain family (05-MAP), versioned as its own ledger from day
   one.
3. **HTTP is reserved for physical-protocol needs only:** `/hooks/<source>/*`
   inbound webhooks (C2), OAuth callbacks, file upload/download byte paths
   (R2-backed), streaming byte paths (e.g. raw proxy/unfurl bytes), and
   `/.well-known` (pending C3). Everything else is RPC per R3. The legacy
   Neuwave REST endpoints (857-line backend inventory) are **not** recreated
   as HTTP; they collapse into domain RPC methods (their semantics tracked in
   the domain specs, not by URL).
4. **Dynamic surfaces are explicitly out of the freeze** and get their own
   contracts: per-gadget `GadgetClient.connectToGadget(): RpcStub<any>` facets
   and per-vendor `GatekeeperClient.openSession(): RpcStub<Session>` sessions
   (19 `gatekeeper-*` packages) — per-package inventories or an explicit
   out-of-scope ruling.

## Alternatives considered

1. **Extend `api.ts` with Neuwave methods.** Rejected: violates the
   kernel-change budget, couples every domain iteration to kernel rebases, and
   bloats the frozen surface.
2. **HTTP/REST recreation of Neuwave's endpoint inventory.** Rejected by R3
   (ruled 2026-08-19): `/api` is not a REST namespace; the old REST shapes are
   AWS topology, not behavior.
3. **One monolithic wrapper RPC interface.** Rejected: recreates the
   graphql_soup problem (killed by ledger ruling) — an unowned wire layer over
   everything; per-domain capabilities keep authority boundaries visible.

## Compatibility impact

- The 182-row ledger becomes the acceptance artifact; the 06-COMPAT freeze
  rule (ledger update + compatibility note + contract tests + migration
  behavior) applies to any change.
- 6 methods have zero frontend call sites today (e.g. `getPreferredModel`,
  `Overseer.listActions`); they remain `preserve` — absence of a caller is not
  a removal warrant.
- 4 `needs-review` rows (`authenticateFromCfAccess`; the Cloudflare
  usage/limits trio) stay preserved pending OD-12.

## State and authorization impact

Wrapper capabilities must reproduce the kernel's capability-attenuation
pattern: a capability is minted only from an authenticated parent, and
default-deny wrappers gate collaborator roles (the `UseOverseerInterface` /
`UseGadgetClientInterface` compile-time default-deny pattern at
`overseer.ts:8767/9258` is adopted for wrapper interfaces). Domain
capabilities perform receipt checks (ADR-004) server-side; the RPC layer is
never the authority.

## Migration and rollback

- No data migration. Rollback of any wrapper capability is a wrapper deploy
  revert; the kernel surface is untouched by construction.
- The client-side argon2id password scheme keyed on `SERVICE_SALT`
  (login/createAccount/changePassword) is a migration dependency for any
  Neuwave user import — see OD-14 and ADR-013.

## Operational consequences

- Contract-test suites per test class already assigned in the ledger:
  `contract:req-resp`, `contract:capability-lifecycle`, `contract:streaming`
  (`downloadBlueprint`/`importBlueprint`/`exportPdf` ReadableStreams),
  `parity:subscription-replay`, `parity:streaming`.
- CI check: `api.ts` hash pinned; any diff fails until an ADR lands.

## Tests and acceptance

- Full 182-row contract suite green against the pinned kernel.
- Dispose-cancels semantics tested for every `subscribe*` stub and
  `LoginAttempt` abandonment.
- Wrapper capabilities each ship a ledger row (same 12-field schema as
  06-COMPAT) before first use by the shell.
- Negative test: no wrapper HTTP route outside the reserved list (router
  audit).

## Follow-up decisions

- **OD-12 (new)**: (a) pin current method names vs adopt the
  `TODO(multi-gadget)` renames (`openGadget`→`openWorkspace` etc.) before the
  freeze; (b) dispositions for `authenticateFromCfAccess` and the Cloudflare
  limits/usage trio; (c) scope ruling for per-vendor gatekeeper session
  contracts and per-gadget facets.
- Deferral **B** (auth mount): **RULED 2026-08-20 via OD-16** — kernel
  `PublicApi`/`LoginAttempt` flow adopted directly, no legacy mounts; closed.
  Deferral **C3** (`/.well-known`) must still be ruled before the
  HTTP-reserved list is final (owner; existing deferral, → OD-17).
- Per-domain RPC namespace shapes belong to
  `reports/04-target-architecture-decisions.md`.
