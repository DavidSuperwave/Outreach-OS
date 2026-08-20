# ADR-001 — Custom shell vs stock/hybrid shell

- Status: **Accepted with amendment** (Ruled 2026-08-20, see
  `../06-owner-decisions-needed.md` OD-11)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

## Amendment (Ruled 2026-08-20, OD-11)

The owner accepted the custom-shell strategy with one amendment: **ALL UI/UX
screens are rebuilt from scratch to 1:1 Neuwave parity — including surfaces the
stock Cloudflare OS shell already provides** (its component set is far thinner
than Macro/Neuwave's). The proposed embed list (admin config, approval queue,
gadget iframes) is hereby **reclassified from permanent to transitional**:
stock kernel screens may be rendered in as an interim measure only, are subject
to the same 1:1 parity bar, and must ultimately be rebuilt with the new
component library. Statements below describing embeds as a lasting "bounded
hybrid" or as permanently saved rebuild cost are read under this amendment.

## Context

The rewrite needs a product shell: routing, splits, Soup lists, blocks, command
palette, hotkeys, and business surfaces. Two candidate baselines exist:

- The **stock Cloudflare OS shell** (`cloudflare-os/packages/workshop-frontend`
  @ `bf7f762`): a workspace/gadget/chat-centric React SPA speaking Cap'n Web
  over the `/api` WebSocket.
- **Neuwave's shell** (Neuwave @ `9f7a26b`, `apps/web`): a SolidJS app with 27
  top-level routes (`apps/web/src/routes/Root.tsx:223`), 52 split registrations
  (`componentRegistry.tsx`; 28 always + 19 LOCAL_ONLY + 5 DEV_MODE_ENV), 16
  concrete block types, a 12-tab settings surface, and a command system of
  **379 static commands + 4 runtime markers** across leader-key scopes
  `g`/`o`/`c` and per-split/per-block DOM scopes
  (`reports/03-command-hotkey-ledger.csv`, 387 rows;
  `reports/notes/wp020-hotkey-coverage.md`).

`04-TARGET-CLOUDFLARE-ARCHITECTURE.md` requires this decision to be recorded as
an ADR; the owner's stated end goal points toward a custom shell, but the first
pass must estimate the compatibility cost rather than assume it.

## Source and ruling constraints

- 07-UI-UX-REWRITE-RULES.md: no Macro branding/trade dress; no mechanical
  SolidJS→React translation; behavior parity is the bar (focus, keyboard scope
  and shadowing, optimistic states, split semantics).
- Ledger (research/nuewave-longtail @ `13c2847`,
  `docs/plans/nuewave-native/merge/merge-ledger.md`): soup ruled
  "Faithful UX on native data (2026-08-19)"; graphql_soup killed; route ruling
  R3 (RPC-first) and L1 (lifted-prefix mounts) fix the wire model the shell
  must speak.
- Kernel-change budget (04-TARGET): shell choices must not require kernel
  changes.

## Decision

**Proposed: a wrapper-owned custom React shell** that recreates Neuwave's
interaction model (routes, splits, Soup, blocks, command registry, leader-key
scopes) as original code, speaking:

1. the frozen kernel RPC contract (182 capabilities, ADR-002) for everything
   the kernel owns (auth session, workspaces/gadgets, AI chat, gatekeepers,
   approvals, admin);
2. wrapper-owned domain RPC capabilities (ADR-002, ADR-005) for Neuwave
   domains (entities, Soup projections, notifications, files, search).

Selected upstream surfaces (admin configuration, gadget/workpiece iframes,
approval queue UI) **may be embedded transitionally only** (amended per OD-11,
Ruled 2026-08-20): every such surface remains subject to the 1:1 parity bar and
must ultimately be rebuilt with the new component library. The stock shell is
**not** forked: `workshop-frontend` remains pristine at the submodule pin.

## Alternatives considered

1. **Stock shell + apps/gadgets.** Rejected for parity: the stock shell has no
   split-pane navigation, no Soup/list engine, no block system, no leader-key
   command scopes, and its information architecture is workspace/chat-first.
   Rebuilding Neuwave surfaces as sandboxed gadgets puts the entire product
   behind the gadget iframe boundary, which cannot express cross-split focus
   transfer, global hotkey scope walking, or the 88 command-menu-only commands.
2. **Targeted frontend fork of `workshop-frontend`.** Rejected: converts every
   upstream release into a rebase (G-012 risk; the program has already patched
   the kernel once — `patches/sup-536-openrouter-kernel.patch` on the planning
   branches), and inherits stock IA that must then be deleted, the worst of
   both costs.
3. **Full hybrid (stock chrome, Neuwave surfaces inside).** Rejected: the shell
   IS the product in Neuwave (splits + Soup + commands are the top-level
   chrome); a hybrid inverts ownership of exactly the surfaces with the highest
   parity requirements.

## Compatibility cost estimate (the deliverable of this first pass)

| Surface to recreate | Size (verified) | Cost class |
|---|---|---|
| Routes + deep links + route-state codec | 27 routes | Medium |
| Split registry + per-split DOM scopes | 52 registrations; per-split scope re-registration semantics | Large |
| Command registry + hotkeys | 379 static commands, 4 runtime markers, 3 leader scopes, shadowing/priority semantics (documented per-row in the ledger) | Large |
| Blocks | 16 block types + aliases | Large |
| Soup/list engine UX | soup ruling "faithful UX" | Large (depends on ADR-006) |
| Settings | 12 nav tabs | Small–Medium |
| Design tokens | OKLCH token file → governed token layer (07-UI-UX) | Medium |
| Kernel-surface reuse (chat, approvals, admin, connected accounts) | 0 rebuild if embedded/reused — **transitional only per OD-11 (Ruled 2026-08-20)**: the saving is interim; these surfaces are ultimately rebuilt to the same parity bar | Saves Large (interim) |

Kernel-change cost of the custom shell: **zero** — the shell consumes existing
`api.ts` interfaces only (verified callable from any wrapper client;
`reports/02-rpc-compatibility-ledger.csv` records caller surfaces).

## State and authorization impact

None directly: the shell owns no state authority. It must render only what
receipts allow (ADR-004) and must not cache across tenant boundaries. The
kernel's default-deny "use"-role wrappers (`overseer.ts:8767`, `:9258`) remain
the pattern for any embedded upstream surface.

## Migration and rollback

- No data migration. Rollback = the shell is wrapper code; reverting it cannot
  affect kernel or domain state.
- If the custom shell slips, the bounded-hybrid embeds (stock admin/approvals)
  are the fallback interim UI — this is the cheap insurance the hybrid option
  buys.

## Operational consequences

- The wrapper owns a full SPA build, visual-regression fleet, and the command
  registry as a compatibility ledger (06-COMPAT freeze rule applies to
  `reports/03-command-hotkey-ledger.csv`).
- Upstream shell upgrades do not touch product surfaces (no fork), only
  embedded panels need re-validation on kernel bumps (ADR-014).

## Tests and acceptance

- Route parity: reload/share a multi-split route without losing layout state
  (05-MAP first parity proof).
- Command parity: automated ledger-driven tests for scope walking, shadowing
  (soup `cmd+k` over global; canvas undo/redo; the triple-booked `h`),
  input-focus gating, and leader-scope re-parenting.
- Visual regression per 07-UI-UX process; zero `macro-*` assets shipped
  (tripwire scan).
- Zero diffs under `cloudflare-os/` (kernel pristine check).

## Follow-up decisions

- **OD-11 — RULED 2026-08-20** (see `../06-owner-decisions-needed.md` OD-11):
  custom-shell strategy accepted; the embed list (admin config, approval
  queue, gadget iframes) is reclassified transitional — all screens are
  ultimately rebuilt to 1:1 Neuwave parity, stock surfaces included.
- OD-9: native/desktop scope (Tauri shell harvestable; mobile not) bounds the
  shell's platform matrix.
- Per-surface design choices (split state model, Soup rendering) belong to
  `reports/04-target-architecture-decisions.md`, not this ADR.
