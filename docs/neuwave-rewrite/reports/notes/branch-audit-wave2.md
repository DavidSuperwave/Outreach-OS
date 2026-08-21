# Branch audit — wave 2 Cursor agent branches (N0–N5)

Date: 2026-08-20. READ-ONLY audit of `origin/cursor/n{0..5}-*-7c12` against the node
scopes/gates in `reports/05-implementation-build-graph.md` §3, the OD rulings recorded
there (OD-7/-11/-16/-27, ADR-014 zero-kernel-patch), and `reports/04-target-architecture-decisions.md`.
Baseline: `origin/main` @ `8cba737` (PR #2 = N0 already merged).

Verification method: every branch diffed with `git diff origin/main...origin/<branch>`;
the N5 tip tree (which contains the full stack, see §0) was extracted via `git archive`
into a scratchpad, the pinned `cloudflare-os` submodule copied in, `pnpm install
--frozen-lockfile` + full test run executed. **327 package tests pass across the stack**
(identity 23+9, registry 5, authz 253, control-plane 8, soup 16, shell 13) — with one
environment caveat recorded under N1.

## 0. Structural facts (apply to all branches)

1. **The branches are STACKED, not independent.** Each tip contains all lower nodes:
   N1 ⊂ N2 (`1c11673` contains `eb76512`) ⊂ N3 (`aa67c03`) ⊂ N4 (`11bfda1`) ⊂ N5
   (`9e8ad99`). Merging N5 merges everything; PRs must be reviewed/merged in order or
   as one train. Per-node deltas below are incremental diffs, not diffs vs main.
2. **ADR-014 / zero-kernel-patch: CLEAN on every branch.** `git ls-tree <branch>
   cloudflare-os` = `bf7f762d7fa73553284d731ab6a978d3ea17be24` on N1 and N5 tips
   (identical to main); `git diff origin/main...<branch> -- cloudflare-os .gitmodules
   patches/ scripts/` is empty for all five unmerged branches. No kernel file, gitlink,
   or patch-budget change anywhere. The one kernel *read* is a test import
   (`packages/identity/__tests__/worker.ts` imports
   `cloudflare-os/packages/workshop-backend/src/user.js`), which is consumption, not
   modification.
3. Each branch adds a per-node spec (`docs/neuwave-rewrite/specs/n{1..5}-*.md`) and
   wires its package into the root `package.json` test chain.
4. **No CI config exists on any branch** (no `.github/`), and the root `pnpm test`
   fails out of the box on a fresh checkout (see N1 caveat) — nothing enforces these
   suites on merge.

## 1. Per-branch findings

### N0 — `cursor/n0-kernel-governance-7c12` (MERGED as PR #2, merge `8cba737`, content `51a3842`)

- **Diff (what main gained):** 18 files, +688 −18. `scripts/governance/{kernel-budget,rpc-contract,parse-api,pins,csv}.mjs`, three `node --test` suites, `KERNEL-STATUS.md`, `patches/README.md`, `.nvmrc`/engines pin, deploy-discipline test.
- **Real vs stub:** real. `kernel-budget.mjs` checks gitlink==pin `bf7f762`, submodule pristine, no unadmitted `patches/*.patch`, frozen sha256 of `workshop-shared/src/api.ts`. `rpc-contract.mjs` parses `api.ts` capabilities and reconciles them against the 182-row `02-rpc-compatibility-ledger.csv` (sha-pinned), incl. the non-callable contract exports from wp020 §5. Verified: 16/17 script tests pass in the extracted tree; the single failure (`kernel gitlink…match ADR-014`, `scripts/kernel-budget.test.mjs`) is an extraction artifact (no `.git` dir in a `git archive` tree), not a code defect.
- **Gate coverage (N0: gates 1/2/8, `contract:req-resp` bootstrapped, ADR-014 active):** met. Deploy discipline tested (`scripts/deploy-discipline.test.mjs`).
- **Verdict: SUBSTANTIVE.** Linear "Done" **defensible**. Residual gap: governance runs only when someone invokes `pnpm governance`/`pnpm test` — no CI hook.

### N1 — `cursor/n1-identity-auth-spine-7c12` (tip `eb76512`; delta vs main: 39 files, +2,520)

- **Contains:** `packages/identity` — `TeamDurableObject` (SQLite DO, `team-do.ts`) over a pure `TeamAuthority` core (237 LOC: membership, roles, single-use invites, idempotency keys), kernel session-token protocol, `kernel-auth-bridge.ts` (OD-16: bind kernel username → wrapper principal *after* kernel auth; explicitly does not re-implement credentials), typed ids (`usr_`/`team_`/…), seed-parity fixtures, Miniflare workers tests.
- **Real vs stub:** real code, meaningful tests. The headline OD-16 proof is genuine: `vitest.workers.config.ts` + `__tests__/worker.ts` run the **actual pinned kernel `UserDurableObject`** (imported from the submodule) through `createAccount → login → authenticate → whoami`, then resolve effective role through the wrapper Team DO (05-MAP row 1 semantics). Verified passing (9 workers tests) — **but only after building the kernel's `@gadgets/typed-storage` package** (`cloudflare-os` ships no `dist/`; `user.ts` imports it by its `dist/` export). On a fresh checkout `pnpm --filter identity test` fails with "Failed to resolve entry for package @gadgets/typed-storage". This prerequisite is undocumented; root `pnpm test` is red out of the box.
- **Gate coverage:** effective-role parity proof: test-level yes. OD-16 "consumes PublicApi/LoginAttempt directly": partial — the real kernel **User DO** is consumed; `PublicApi`/`LoginAttempt`/`AdminApi` themselves are local test doubles shaped to the kernel contract (`__tests__/kernel-public-api.ts`, `__tests__/pending-login.ts`, `src/login-attempt.ts`). Of the 28 RPC rows assigned to N1, only the User-DO subset is exercised; AdminApi's 16 rows are reduced to an `ADMINS`-set agreement check (`assertAdminPolicyAgrees`). **No served surface**: `wrangler.jsonc` binds only `TEAM`; there is no worker route, no `/api` mount, no browser sign-in — "existing user signs in" exists only inside Miniflare.
- **Verdict: SUBSTANTIVE (library + harness), PARTIAL (deployable auth spine).** "Done" **defensible only under a wave-2 contract-freeze reading**; not done as a runnable sign-in spine.

### N2 — `cursor/n2-entity-ontology-receipts-7c12` (tip `1c11673`; delta vs N1: 65 files, +2,455)

- **Contains:** `packages/registry` (16-type `EntityType` vocabulary matching OD-7 — task is a `DocumentFacet`, thread = `email_thread`; typed-prefix ids; tombstones; tenant binding) and `packages/authz` (`PolicyEngine.mint` as sole receipt mint path, fail-closed on tombstone/cross-tenant/unregistered; per-type policy code; 14 extractors under `src/extractors/`; 13 query modules + lattice under `src/queries/`; command-enablement for the 26 `block-entity`/`entity`/`property-editor` rows; SEC-1/2/3 as named regression tests in `authz.test.ts`; generated cartesian behavior matrix in `fixtures/behavior-matrix.ts` + `matrix.test.ts`).
- **Real vs stub:** the strongest branch. 253 tests pass, and they are behavioral (matrix cells assert allow/deny per actor×setup×level×type; on-behalf-of bot minting; project/folder inheritance walks; channel role lattices; revocation SEC-1). Compiles and runs (verified).
- **Gate coverage:** ontology + receipts semantics: yes, as an **in-memory model**. `AccessStore` is explicitly "in-process stand-in for owning-DO share state" (`access-store.ts`); there are no Durable Objects, no persistence, no wiring to kernel session context, and no D1 `entity_access_index`. The original subsystem being recreated is 6,448 non-test / 13,519 test LOC (01 §2.2); this distillation is ~1.2k/1.2k — semantics are asserted against the authors' own matrix, not against Neuwave-derived fixtures, so "recreates entity_access semantics" is self-certified.
- **Verdict: SUBSTANTIVE (contract + semantics freeze), PARTIAL (production access core).** "Done" **defensible** for the wave-2 contract-freeze purpose (ADR-003/ADR-004 shape is real and tested); flag the self-certification gap for the N6 authz-matrix gate.

### N3 — `cursor/n3-domain-control-plane-7c12` (tip `aa67c03`; delta vs N2: 18 files, +682)

- **Contains:** `packages/control-plane` — `EventEnvelope` w/ deterministic event ids, `Outbox` (append-dedupe, drain, poison-at-5, projection checkpoints, replay-from-checkpoint w/ `checkpoint_gap` error), `IdempotencyStore`/`runOnce`, `RequestContext` (correlationId, receipt-as-control-plane-type), 12-product-topic freeze with `com`/`activity_events` forbidden (corrected E3), `ActivityLog` (OD-21 10-action vocabulary), storage `ownership.ts` map, `redis-map.ts` (OD-20 successor map), secret redaction. Also adds `adrs/ADR-005-storage-ownership-rules.md` addendum.
- **Real vs stub:** real but thin — everything is in-process by declared design ("Physical DO storage rides domain nodes", `outbox.ts`), which the node table permits for a library node. 8 tests in one 181-line file pass; they do cover idempotency and replay (gate 4's stated proof) but 8 tests for ~10 modules is light (e.g. `ownerOf`, redis-map, secrets get one assertion each).
- **Gate coverage:** envelope/outbox/checkpoint contracts frozen: yes. Gate 4 unit proofs: minimally present. Tracing/correlation: a UUID field, no propagation story.
- **Verdict: SUBSTANTIVE-minimal.** "Done" **defensible** for a wave-2 library node; the contract only becomes credible when N6 pushes a real DO-backed write through it.

### N4 — `cursor/n4-soup-projection-7c12` (tip `11bfda1`, prior `3c963f3`; delta vs N3: 21 files, +1,651)

- **Contains:** `packages/soup` — `ProjectionPlane` (OD-27: one plane, `lists` + `search` schema families, `ProjectionConsumer` shared framework with per-family checkpoints and drop-and-rebuild), `SoupIndex` (filters, sort, cursor pagination, grouping/collapse, tombstone drop, live `SoupListener` deltas w/ reconnect replay), `SearchIndex` (7-type ADR-007 coverage, `email→email_thread`, `call_record→call`), `FavoritesIndex` (500 cap, fractional order, **read-side receipt recheck** — addresses the ledger:42 favorites gap named in the node's blocking-OD list), 59-command freeze (`soup` 28 + `soup-entity` 22 + `soup-nav` 8 + `favorites` 1) with enablement tests.
- **Real vs stub:** the projection *logic* is real and tested (16 tests pass; `soup.test.ts` walks the 05-MAP row-4 parity proof: mixed list filters/order/pagination/live updates, gate-5 rebuild, reconnect replay without duplication). **But there is no D1.** State is `Map`s; the D1 DDL exists only as string constants (`LIST_SCHEMA_DDL` etc. in `schemas.ts`, "Physical D1 is 4a"). No Queues, no single-writer DO, no subscription transport — single-writer is a comment, not a mechanism.
- **Gate coverage:** OD-27 topology honored structurally (verifiably: one consumer, two families, no shared storage). Node table sets the wave-2 bar at "minimal, slice-sufficient → hardened in 4a", and the deliverable literally says "cross-entity **D1** index"; a slice can run on this in-memory plane, but nothing here proves D1 semantics (SQL typing, cursor behavior under SQLite, write amplification).
- **Verdict: PARTIAL (by design).** "Done" **defensible only as the wave-2 minimal cut** and only if the Linear issue text says minimal; if the issue claims the D1 plane, it is not done.

### N5 — `cursor/n5-react-shell-7c12` (tip `9e8ad99`; delta vs N4: 16 files, +1,276)

- **Contains:** `packages/shell` — `CommandRegistry` (real scope-tree dispatch: leader keys g/o/c with re-parent + jettison, override/add registration, priority ordering, first-capture-wins, input-focus gate, touch disable, cmd→ctrl translation), 160-command id freeze (`n5-command-ids.ts`), 27-route constant map + `/*splits` (`routes.ts`, OD-9/OD-17 handled), split codec + `SplitManager` (28 always-splits, killed dev splits), OKLCH theme tokens for 12 themes with OD-24 brand tripwire (`assertNoMacroBrand`, `outreach-*` storage keys), `kernel-surface.ts` (154-of-182 consumed-RPC list), and `Shell.tsx`.
- **Real vs stub:** split cleanly. The **command registry and split codec are real** — the 13 tests exercise genuine dispatch semantics (shadowing, the `h` triple-booking priority case, leader jettison, codec round-trip for all 28 split types) and pass. The **shell is a stub**: `Shell.tsx` is 40 lines rendering empty `<div>`/`<section>` data-attributes; there is no router, no screen, no widget, no interactivity, no keyboard listener attached to the registry, no Cap'n Web `/api` client (the 154 RPC rows are string constants, consumed by nothing), no app entrypoint, no vite/build config, no dev server. **Nothing boots.** The wave-2 bar itself ("skeleton: shell boots, registry core, one route") is therefore only half met — registry core yes, bootable shell no. Against OD-11's node bar (ALL screens rebuilt to 1:1 Neuwave parity, gates 6/7) it is ~0% of the screen surface.
- **Verdict: STUB with one substantive component (registry core).** Linear "Done" **not defensible** — at best "started".

## 2. Compact verdict table

| Branch (tip) | Delta | Tests (verified) | Verdict | "Done" defensible? |
|---|---|---|---|---|
| N0 `51a3842` (merged `8cba737`) | +688/18 files | 16/17 pass (1 env artifact) | SUBSTANTIVE | Yes |
| N1 `eb76512` | +2,520/39 | 23 unit + 9 workers pass (needs kernel typed-storage build) | SUBSTANTIVE lib / PARTIAL spine | Only as contract freeze |
| N2 `1c11673` | +2,455/65 | 253 + 5 pass | SUBSTANTIVE (in-memory) | Yes, as contract freeze |
| N3 `aa67c03` | +682/18 | 8 pass | SUBSTANTIVE-minimal | Yes (library node) |
| N4 `11bfda1` | +1,651/21 | 16 pass | PARTIAL (no D1, by design) | Only as wave-2 minimal cut |
| N5 `9e8ad99` | +1,276/16 | 13 pass | STUB (+ real registry core) | **No** |

ADR-014: all six clean — gitlink `bf7f762` unchanged everywhere, no kernel files, no patches.

## 3. Three worst gaps

1. **N5 has no bootable shell** — no entrypoint, no build, no router, no `/api` client;
   `Shell.tsx` renders empty data-attribute divs. Even the wave-2 "shell boots, one
   route" skeleton gate is unmet, and every OD-11 parity obligation (387-command wiring
   to real DOM scopes, 27 real routes, gates 6/7) is still ahead. This is the branch
   whose Linear status most misrepresents reality.
2. **Nothing in wave 2 touches real substrate.** N2 receipts, N3 outbox, N4 projections
   are all in-process Maps; N4's "D1 index" is DDL-in-a-string; N1's auth spine has no
   served worker. The four foundational contracts are frozen as *types + in-memory
   semantics only* — every hard risk (DO storage, D1 semantics, Queues, single-writer,
   session wiring) is deferred to N6+, so the slice inherits substrate risk the spine
   nodes were nominally supposed to retire.
3. **The test story is unenforced and breaks on fresh checkout.** No CI on any branch;
   root `pnpm test` fails until `cloudflare-os` is pnpm-installed and
   `@gadgets/typed-storage` is built (undocumented prerequisite of N1's kernel-DO
   tests) — meaning the 327-test green state this audit verified is invisible to a
   reviewer and can rot silently after merge.

Minor additional notes: branches must merge in stack order (or as one train); N2's
entity_access semantics are self-certified against author-written matrix fixtures, not
Neuwave-derived ones; N4's live-subscription model has no transport (listener callbacks
only).
