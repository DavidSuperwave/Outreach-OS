# Start here

## Mission

Create a new Cloudflare-native product from the Outreach OS baseline that faithfully recreates the ruled Neuwave features, architecture semantics, workflows, command behavior, and UI/UX—without copying Rust implementation code or Macro branding.

Wave-1 verification and planning is complete. Implementation starts at Linear **SUP-547** (N0 kernel governance) and proceeds issue-by-issue. Do not re-litigate owner rulings in `reports/06-owner-decisions-needed.md`.

## Read order

1. `01-AUTHORITY-AND-SCOPE.md`
2. `02-BASELINE-PINS-AND-REPOS.md`
3. `03-IMPLEMENTATION-PRINCIPLES.md`
4. `04-TARGET-CLOUDFLARE-ARCHITECTURE.md`
5. `06-API-RPC-COMMAND-COMPATIBILITY.md`
6. `10-DELIVERY-PLAN.md`
7. `CODEX-INSTRUCTIONS.md`
8. `work-packets/WP-000-GROUND-TRUTH.md`

## First action

Verify pins (`KERNEL-STATUS.md`, `pnpm governance`), read the assigned Linear issue, and implement only that issue. Wave-1 reports already exist under `reports/`.

Domain implementation (N1+) starts only after N0 (SUP-547) lands. The vertical slice (N6 / SUP-553) remains the hard gate before wave-4 fan-out.
