# Standing brief for merge agents

> Created 2026-08-19. Read `README.md` (rulings) first, then this. Applies to
> every agent working the merge: research agents filling inventories, ledger
> agents drafting rows, and the eventual Linear scope-map agent.

## The two repos and where things are

**Reference (read, never build here):** `C:\Users\Kecin\Projects\Neuwave`,
pinned `main@9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`.

| What you need | Where |
|---|---|
| Rust domain logic | `crates/<domain>/` — hexagonal; HTTP inbound usually `src/inbound/axum_router.rs` |
| Service composition roots | `services/<name>/src/api/mod.rs` (router entrypoints) |
| Frontend app | `apps/web/src/` — routes in `routes/Root.tsx`, splits in `componentRegistry.tsx`, blocks in `lib/core/block.ts`, features in `features/*` |
| OpenAPI specs / clients | `packages/sdk/specs`, `orval.config.ts`, per-service `openapi.json` |
| GraphQL SDL | `static_assets/schema.graphql` |
| Postgres schemas | migration dirs per crate/service — see `schema-harvest.md` |
| Old team's own decisions | ~~`19_BUILD_HANDOFF.md`, `18_DECISION_RECORD.md`, `BUILD_STATUS.md`~~ **do not exist at the pin** (verified 2026-08-19). Use `docs/PROPERTY_TARGET_ENTITY_TYPE_PLAN.md` (design pain report) + `docs/internal/platform-context/` |
| Already-Cloudflare code | `sync-service`, `lexical-service`, `ai-editing-worker`, `coding-agent-worker` — direct-harvest candidates |

**Build (all new code lands here):** `C:\Users\Kecin\Projects\Outreach-OS`,
kernel pinned via `cloudflare-os` submodule.

| What you need | Where |
|---|---|
| Kernel capability ground truth | `../cf-os-capability-map.md` |
| Router model | `cloudflare-os/packages/router/src/index.ts` — `/api/*`, `/gatekeeper/<name>/*` |
| Session/agent runtime | `cloudflare-os/packages/workshop-backend/src/{user,overseer,agent}.ts` |
| Typed storage | `cloudflare-os/packages/typed-storage/src/index.ts` |
| Model layer (OpenRouter, SUP-536) | `docs/sup-536-openrouter-changes.md`, `patches/sup-536-openrouter-kernel.patch` |
| Gatekeeper authoring | `cloudflare-os/.agents/skills/write-gatekeeper/SKILL.md`, `packages/custom-gatekeeper` |

## Rules that bind you

1. **Two tripwires** (the only content restrictions left): no Macro branding
   (icons, trade dress, "Macro agent" identity), no Rust code reuse (rewrite
   only — reading as reference is expressly allowed, including for faithful
   UI/UX recreation). The old clean-room §2 in `../roadmap.md` is superseded.
2. **Pointers must pin.** Every code reference you write:
   `path/from/clone/root:line` + implicitly the pinned SHA. Never reference a
   branch that can move.
3. **Verdicts are David's.** Research fills every column except `Verdict:`.
   You may propose; you may not rule. Conflicts between old docs get surfaced,
   not silently resolved.
4. **No git commits, no Linear writes** unless the session's human explicitly
   ordered that step.
5. **Slices state their coverage.** If you fill part of an inventory, say
   exactly what is covered and what is not — silent truncation poisons the
   audit.
6. **Source over Linear (David, 2026-08-19).** When describing what a
   capability *is or does*, the authority is the code at the pinned SHA —
   never Linear issue text, plan docs, or inference from context. Linear
   tells you what was *planned*; only the codebase tells you what *exists*.
   What each kept capability becomes in the new build is decided by David +
   agent at design time, not assumed from old descriptions.

## Contract for the Linear scope-map agent (runs after the ledger is ruled)

Input: `merge-ledger.md` with every row `✔ ruled` + `README.md` rulings +
`original-linear-plan-review.md` dispositions.
Output: one new Linear project **"Nuewave T"** (team Superwave), milestones
per the ruled phase structure, issues generated from ledger rows — each issue
carrying its old-source pointers and CF-target from the ledger row so build
agents start with exact locations. Then, only after explicit confirmation:
archive "Nuewave Pilot" and "Outreach OS pilot" with pointer comments.
Do not invent scope not present in a ruled row.
