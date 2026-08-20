# ADR-014 — Kernel-change and upstream-patch budget

- Status: **Accepted** (Ruled 2026-08-20, see `../06-owner-decisions-needed.md`
  OD-10: zero-patch budget bound from wave 0; exceptions need their own ADR
  with an upgrade-cost estimate and owner sign-off; SUP-536 requires a
  retroactive ADR if it is ever to land)
- Date: 2026-08-20
- Owners: David (decision); WP-030 drafting agent (proposal)

## Context

The kernel is the `cloudflare-os` submodule pinned at
**`bf7f762d7fa73553284d731ab6a978d3ea17be24`** (dated 2026-08-05; gitlink
identical on the implementation baseline and both planning branches —
verified, `reports/00-baseline-verification.md`). It is early-access software
with unverifiable upstream velocity (offline), and the program **has already
patched the kernel once**: the planning branches carry
`patches/sup-536-openrouter-kernel.patch` (SUP-536 OpenRouter work) — so the
kernel-change budget is not hypothetical (WP-010 L3, gap G-012; OD-10).

Every kernel divergence compounds three costs: rebase burden on upstream
bumps, invalidation of the frozen 182-capability contract tests (ADR-002),
and re-validation of embedded shell surfaces (ADR-001).

## Source and ruling constraints

- 04-TARGET kernel-change budget: a kernel change is allowed only when (1)
  the concept cannot be expressed via API/Gatekeepers/gadgets/wrapper
  workers/custom shell; (2) a compatibility impact report exists; (3)
  upgrade/rebase cost is estimated; (4) the change is isolated and tested;
  (5) an ADR records why an edge extension was insufficient.
- 01-AUTHORITY repo roles: prefer extension points; kernel changes require an
  explicit ADR and compatibility budget.
- OD-10 (existing): budget enforcement from wave 0, and the SUP-536 patch's
  status.

## Decision

**Proposed:**

1. **The budget is binding from wave 0** (not wave 2). Default posture:
   **zero kernel diffs** — the submodule stays bit-identical to the pin;
   CI asserts a clean gitlink and no patch application in the build.
2. **Extension ladder (must be exhausted, in order, before any patch):**
   wrapper worker/service binding → custom shell (ADR-001) → gadget/workpiece
   → Gatekeeper/connector → new wrapper capability namespace (ADR-002) →
   only then a kernel patch proposal.
3. **Patch admission** requires all five 04-TARGET criteria plus: a named
   owner approval (dated), a carried `patches/*.patch` file with an ADR
   reference, and an **upstreaming plan** (a patch with no credible upstream
   path is a fork by installment and needs explicit owner acceptance of
   permanent carry cost).
4. **SUP-536**: the existing OpenRouter kernel patch does **not** land in the
   implementation repo unless it passes this admission retroactively (its own
   ADR + compatibility report). Until then it stays parked on the planning
   branches.
5. **Upgrade cadence**: an upstream-rebase rehearsal at least once per
   delivery wave — fetch upstream head into a throwaway worktree, replay
   carried patches, run the 182-row contract suite and shell smoke — so
   upgrade cost is measured, not discovered. Pin bumps are themselves
   ADR-lite events: recorded with the contract-suite result and any surface
   diff (new/changed `api.ts` members enter the ledger via the 06-COMPAT
   freeze rule).
6. **Budget size**: the working allowance is **zero carried patches** in
   pass 1; each admitted patch consumes explicit owner sign-off, and more
   than **two** concurrent carried patches triggers a mandatory
   fork-vs-upstream strategy review with the owner.

## Alternatives considered

1. **Soft budget (activate at wave 2, per the package's original phasing).**
   Rejected: model-layer work starts immediately and is exactly where the
   first patch precedent (SUP-536) appeared; un-budgeted drift begins on day
   one (OD-10 evidence).
2. **Hard freeze (no patches ever until first upgrade rehearsal).** Viable
   (OD-10 option c) and strictly safer, but removes the escape valve for a
   genuine kernel blocker (e.g. a bug in the frozen surface itself); the
   admission process gives the same protection with an exit.
3. **Fork the kernel now.** Rejected: converts every upstream improvement
   into manual labor and abandons the early-access stream the platform bet
   depends on; contradicts 01-AUTHORITY's "prefer extension points."

## Compatibility impact

- The frozen 182-capability surface (ADR-002) is the kernel's contract
  fingerprint: any pin bump or patch must re-run the full contract suite; a
  surface diff without a ledger update violates the freeze rule.
- Wrapper deploy discipline (Outreach-OS `deployment.jsonc` placeholder
  checks, `scripts/deploy.mjs`) is preserved per 01-AUTHORITY repo roles.

## State and authorization impact

- None directly. Indirectly: kernel patches touching auth/capability code
  (the chain PublicApi→…→GatekeeperClient, default-deny wrappers) are
  **category-forbidden** without owner sign-off, because they move the
  platform's trust boundary.

## Migration and rollback

- No data. Rollback of a pin bump = revert the gitlink (one commit); carried
  patches make this harder, which is itself an argument the admission process
  weighs. Contract suite green on the reverted pin is the rollback proof.

## Operational consequences

- CI jobs: submodule-pristine check (fails on any diff under
  `cloudflare-os/`), patch-manifest check (every patch ↔ ADR link), and the
  per-wave rebase rehearsal pipeline.
- A visible `KERNEL-STATUS.md`-style ledger (pin, carried patches, last
  rehearsal result) so upgrade burden is always observable (G-012).

## Tests and acceptance

- CI proves: gitlink == `bf7f762…` (until a ruled bump), zero tracked diffs
  in the submodule, zero patches without ADR references.
- Rehearsal artifact per wave: upstream delta summary + contract-suite
  result + estimated rebase cost.
- The 182-row contract suite is the regression net for every kernel event.

## Follow-up decisions

- **OD-10 — RULED 2026-08-20** (see `../06-owner-decisions-needed.md` OD-10):
  wave-0 enforcement and the zero-patch default are ratified; the kernel
  submodule stays pinned and unmodified; any exception requires its own ADR
  with an upgrade-cost estimate and owner sign-off; SUP-536 stays parked
  pending a retroactive ADR.
- Upstream relationship (can the program upstream needs to
  `cloudflare/cloudflare-os`?) — owner/vendor conversation, out of agent
  scope.
- Per-feature extension-point choices belong to
  `reports/04-target-architecture-decisions.md`.
