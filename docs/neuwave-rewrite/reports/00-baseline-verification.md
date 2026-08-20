# Verification report — WP-000 ground truth and source pins

Date: 2026-08-20. Executed per `docs/neuwave-rewrite/work-packets/WP-000-GROUND-TRUTH.md` using the template `docs/neuwave-rewrite/templates/verification-report.md`.

## Scope

Verify repository pins, branch roles, worktree safety, toolchain constraints, and safe commands; locate the canonical decision ledger, ruling documents, audits, endpoint inventories, schema harvests, route reconciliations, design tokens, and environment/secret documentation; compare observed reality against `manifest/source-pins.json` and package claims. Read-only against all git history and branches; writes confined to `docs/neuwave-rewrite/reports/`.

## Repositories and pins

All commits below were observed directly with git commands in this session unless marked otherwise.

| Source | Package pin (`manifest/source-pins.json`) | Observed | Match |
|---|---|---|---|
| Implementation worktree `/Users/david/Projects/Outreach-OS/.claude/worktrees/neuwave-cloudflare-rewrite-3e5a28`, branch `claude/neuwave-cloudflare-rewrite-3e5a28` | `dec12f2df3d205965838526076b910cdb8a845ce` (Outreach-OS main) | HEAD = `dec12f2df3d205965838526076b910cdb8a845ce` = `origin/main` | YES |
| `cloudflare-os` submodule / gitlink | `bf7f762d7fa73553284d731ab6a978d3ea17be24` | `git submodule status` and `git ls-tree HEAD cloudflare-os` both = `bf7f762d…`; same gitlink on both planning branches | YES |
| Neuwave reference `/Users/david/Projects/Neuwave` | `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` | `git rev-parse HEAD` = `9f7a26bccb85…`, detached HEAD (`## HEAD (no branch)`), `git status --short` clean, no submodules | YES |
| Planning branch `merge/nuewave-docs` | observed `8c3cf7a4e3c25ada27bb89850964702d07a34988` | **Local branch = `05436fed2280420b169a2f0f73f8e936daf84273`** — one commit ahead ("Research pass: six highest-leverage ledger rows + two deep audits"). `origin/merge/nuewave-docs` = `8c3cf7a…` (matches the pin). `05436fe` is contained in `origin/research/nuewave-longtail`, so no unpushed unique content exists. | **NO (local branch ahead of pin; origin matches)** |
| Research branch `research/nuewave-longtail` | observed `13c2847543326f8c2ce8485b26a1c1f0520cfa1b` | Local = origin = `13c2847…` | YES |

Remote: `origin  https://github.com/DavidSuperwave/Outreach-OS.git` (fetch+push); Neuwave remote `https://github.com/DavidSuperwave/Neuwave.git` (both recorded in `reports/generated/baseline.json` and re-confirmed live).

### Branch roles and topology (verified)

- `claude/neuwave-cloudflare-rewrite-3e5a28` @ `dec12f2` — implementation baseline (equals main pin). All new work lands here.
- `merge/nuewave-docs` — planning evidence only. Ancestry: `git merge-base --is-ancestor merge/nuewave-docs research/nuewave-longtail` → true.
- `research/nuewave-longtail` @ `13c2847` — long-tail audit evidence only; strict superset of the merge branch (adds `dss-native-chrome-audit.md`, `standalone-services-audit.md`, ledger updates, roadmap log — verified by `git diff --stat`).
- **The planning branches are NOT ancestors of the implementation baseline.** `git merge-base --is-ancestor dec12f2 merge/nuewave-docs` → false; common ancestor is `fd493c0`. Main-only since the fork: `dec12f2` (Cursor Cloud docs). Planning-branch-only: `27d9be8` ("Park SUP-536 OpenRouter Path B"), `8c3cf7a`, `05436fe`, `13c2847`. Consequence: none of the ledger/audit/inventory files exist in the implementation worktree's checked-out tree; they must be read via `git show <branch>:<path>` (done read-only throughout this packet).

## Worktree safety

- Implementation worktree is clean except three untracked additions: `AGENTS.neuwave-rewrite.md`, `CODEX_START_HERE.md`, `docs/neuwave-rewrite/` (the installed planning package). Because the package is untracked, edits to it (including the lead's script fix, below) have no git diff.
- No checkout, merge, rebase, branch move, commit, push, or submodule operation was performed. All branch content was read with `git show` / `git ls-tree` / `git log`.
- Neuwave reference repo untouched and re-verified clean at the end of the packet. **Incident disclosure:** one chained shell command in this session briefly created empty directories (`docs/neuwave-rewrite/reports/notes`) inside `/Users/david/Projects/Neuwave` by mistake; they were removed immediately, `git status --short` is empty, and empty directories are invisible to git in any case. No tracked or untracked file content was ever created or modified there.

## Applicable instructions

- `/…/3e5a28/AGENTS.md` (root, tracked @ `dec12f2`) — pnpm-only, Node 24 / pnpm 11, secrets discipline, safe-command list, known test caveats (lines 17–52).
- `/…/3e5a28/AGENTS.neuwave-rewrite.md` (untracked) — package authority order; first pass is verification/planning only.
- `/…/3e5a28/docs/neuwave-rewrite/AGENTS.md`, `CODEX-INSTRUCTIONS.md`, `01-AUTHORITY-AND-SCOPE.md` — change-safety rules honored (no deploy, no secrets, no commits, no product code, no ledger modification).
- `cloudflare-os/` contains its own instructions files (not restated here; kernel untouched).
- Neuwave repo `AGENTS.md`/`CLAUDE.md` exist at the pin; used read-only.

## Canonical decisions and evidence

### The canonical decision ledger

**Location:** repo `DavidSuperwave/Outreach-OS`, branch `research/nuewave-longtail`, commit `13c2847543326f8c2ce8485b26a1c1f0520cfa1b`, path `docs/plans/nuewave-native/merge/merge-ledger.md`. This is the newest ledger state on any local or origin ref and supersedes the copies at `05436fe` and `8c3cf7a` (same path).

**Status — the ledger is research-complete but NOT verdict-complete.** Row-status glyph counts (counted mechanically per commit):

| Commit | ✔ ruled | ◐ researched, awaiting verdict | ☐ unresearched |
|---|---|---|---|
| `8c3cf7a` (package pin for merge branch) | 43 | 32 | 26 |
| `05436fe` (local merge branch head) | 43 | 38 | 20 |
| `13c2847` (canonical) | 43 | 57 | 1 |

The single remaining `☐` (ledger line 87, "Coding-agent capability (future)") already carries a dated verdict from ruling A3; the roadmap explicitly calls its glyph "a status inconsistency, not open research" and says only David should reconcile it (`roadmap.md` status log, research branch).

**How the package's "closed ledger" premise holds:** the ledger's own default ruling — "**Default ruling (2026-08-19, Q19):** every row not explicitly ruled or parked is **KEEP — faithful recreation**" (`merge-ledger.md` header) — is exactly the operating rule in `01-AUTHORITY-AND-SCOPE.md` line 28. So every row has an effective disposition (43 explicit verdicts + 57 default-KEEP + parked business chrome). But the roadmap status log's own "Next" is "David rules the researched rows in batches", and it names items that **cannot** be defaulted (see Premise-breaking findings). Two standing deferrals also remain open: **B** (auth mount) and **C3** (`/.well-known`) — `route-reconciliation.md` / roadmap.

### Ruling documents (all at `research/nuewave-longtail` @ `13c2847`, path prefix `docs/plans/nuewave-native/`)

- `merge/README.md` — the eight-ruling set (2026-08-19, confirmed by David): harvest rules replacing clean-room, two tripwires (no Macro branding, no Rust reuse), the three-service lift carve-out (A3 corrected: `coding-agent-worker` dropped), full absorption, Linear endgame D1, name D2 ("Nuewave" / "Nuewave T"), re-audit-everything, full endpoint extraction + schema harvest.
- `merge/merge-ledger.md` — verdict slots ("filled only by David's dated rulings").
- `merge/route-reconciliation.md` — ruled 2026-08-19: R3, L1 (+prefixes), A3 drop; B and C3 deferred; C1, C2 ruled.
- `merge/pattern-review.md` — ruled 2026-08-19: 1a/2a/3a/4a with riders (the "D1/1a", "D3/3a" targets cited throughout the ledger).
- `merge/reference-packet.md` — curated index; ruling state "all five batches ruled".
- `merge/original-linear-plan-review.md` — the inverted original plan.
- `roadmap.md` — dated status log of both research passes (the closest thing to ruling minutes).

### Audits (7 files, `merge/audits/` on the research branch; the first 5 also exist at `8c3cf7a`)

`connectivity-layer-audit.md`, `crm-audit.md`, `company-mailbox-audit.md`, `documents-audit.md`, `lambda-batch-families-audit.md`, and (research branch only) `dss-native-chrome-audit.md`, `standalone-services-audit.md`.

### Inventories, harvests, reconciliation

- Backend endpoints: `merge/endpoint-inventory-backend.md`. Frontend routes/splits: `merge/endpoint-inventory-frontend.md`.
- Schema harvest (4 Postgres DBs): `merge/schema-harvest.md`. Known hole (recorded by the standalone-services audit): the `static_file_service` DynamoDB metadata table was never harvested — only `BulkUploadRequest` was.
- Route reconciliation: `merge/route-reconciliation.md` (unified route map, 20-item collision register).
- Deliberate-exception documentation trail (MCP server, OpenAI proxy, seven-source search, self-hosted converter — per `01-AUTHORITY-AND-SCOPE.md`): referenced across the audits; the converter is covered in `standalone-services-audit.md` (`convert_service` embeds LibreOffice).

### Design tokens

- Documented: `reference/platform-context/ui-ux-component-catalog.md`, section "Tokens, assets, and visual language" (line 432; subsections "Global semantic tokens" 434, "Theme authoring" 452) — research branch @ `13c2847`.
- Live source at the Neuwave pin `9f7a26b`: `apps/web/src/features/theme/` (signals, utils incl. `themeMigrations.ts`/`themeValidation.ts`, editor components), `apps/web/src/lib/core/component/Themes.tsx`, `apps/web/src/features/dynamic-ui/tokens.ts`. (Hotkey tokens, distinct concept: `apps/web/src/lib/core/hotkey/tokens.ts`, already harvested into the mechanical CSV.)

### Environment / secret documentation

- Root `AGENTS.md` (@ `dec12f2`): Secrets section (lines 28–30) — never commit `.dev.vars`/keys; local secrets in `cloudflare-os/.dev.vars` (verified gitignored: `cloudflare-os/.gitignore` lines 25, 37–41); Cursor Cloud agents use environment secrets.
- `.cursor/environment.json` — install chain (`git submodule update --init && pnpm install && pnpm --dir cloudflare-os install`), port 8787, repositoryDependencies `github.com/cloudflare/cloudflare-os`.
- `.cursor/Dockerfile` — `FROM node:24-bookworm-slim`, `corepack prepare pnpm@11.9.0`.
- `deployment.jsonc` — all account/worker/access values are `<NAMED_PLACEHOLDER>` tokens; `docs/customization.md` and `docs/observability.md` exist and are the referenced setup docs.

## Commands/tests run

Read-only git and filesystem commands only: `git status --short --branch`, `git remote -v`, `git rev-parse`, `git submodule status --recursive`, `git ls-tree`, `git log`, `git merge-base --is-ancestor`, `git diff --stat`, `git show`, `git for-each-ref`, `git grep`, plus `ls`/`grep`/`find`/`wc` and file reads.

**No installs, no servers, no test suites were executed.** `node_modules/` is absent in both the worktree root and `cloudflare-os/`, and this packet's instructions prohibit installs. Test-command verification is therefore documentary (script text vs. claims), not execution:

| Documented command (root `AGENTS.md`) | Exists? | Evidence |
|---|---|---|
| `pnpm test` (root) | Yes | `package.json` scripts.test = `node --test scripts/*.test.mjs && pnpm --filter custom-gatekeeper test && pnpm --filter error-reporter test`; `scripts/deploy.test.mjs`, `packages/custom-gatekeeper/__tests__/`, `packages/error-reporter/src/format.test.ts` all present |
| `pnpm check` (root) — documented as intentionally failing on placeholders | Yes | scripts.check = `node scripts/deploy.mjs --check`; `scripts/deploy.mjs:97-98` throws `Replace deployment placeholder <…>` on any `<[^>]+>` token; `deployment.jsonc` ships `<CLOUDFLARE_ACCOUNT_ID>` etc. → **configuration-placeholder failure by design, not a code failure** |
| `pnpm --dir cloudflare-os run-local` (port 8787) | Yes | `cloudflare-os/package.json` scripts.run-local = `node scripts/run-local.mjs`; script file present; not launched |
| `pnpm --dir cloudflare-os test` | Yes | scripts.test = `node --test scripts/*.test.js && pnpm run --recursive --if-present test`; caveat in root `AGENTS.md:48`: needs `@gadgets/typed-storage` built first (package present at `cloudflare-os/packages/typed-storage/`) or 6 workshop-backend vitest files fail on entry resolution |
| `pnpm --dir cloudflare-os lint` | Yes | scripts.lint = `pnpm run lint:check && pnpm run types:check` (oxlint + recursive tsc) |
| `pnpm deploy` | Exists; **not run** (prohibited) | scripts.deploy = `node scripts/deploy.mjs` |

## Verified facts

1. All five package source pins match observed reality except the local `merge/nuewave-docs` branch head (table above); the origin copy of that branch does match the pin.
2. The `cloudflare-os` gitlink is `bf7f762…` on `HEAD`, `merge/nuewave-docs`, and `research/nuewave-longtail` alike — the kernel pin is consistent across all planning and implementation refs.
3. The canonical ledger and every ruling/audit/inventory document live **only on the planning branches**, not in the implementation baseline tree; canonical reads must target `research/nuewave-longtail` @ `13c2847`.
4. Ledger disposition: 43 explicit dated verdicts; 57 rows researched with empty `Verdict:` slots covered only by the Q19 default-KEEP ruling; 1 glyph-inconsistent row already ruled by A3; deferrals B and C3 open.
5. Toolchain claims: "Node 24, pnpm 11" (root `AGENTS.md:26`) is backed by `.cursor/Dockerfile` (`node:24-bookworm-slim`, corepack `pnpm@11.9.0`) and root `package.json` `"packageManager": "pnpm@11.9.0"`. **No `engines` field exists in root `package.json` or `cloudflare-os/package.json`, and no `.nvmrc`/`.node-version` exists anywhere** — outside a Dockerfile-built environment, Node 24 is convention, enforced by nothing; pnpm 11 is enforced wherever corepack honors `packageManager`. Local Python is 3.12.8 (package scripts are stdlib-only).
6. First-pass generated artifacts exist and are well-formed: `reports/generated/baseline.json` (its recorded git facts match my independent re-verification), `reports/generated/cf-os-rpc-mechanical.csv` (181 data rows + header, from `cloudflare-os/packages/workshop-shared/src/api.ts`), `reports/generated/neuwave-hotkeys-mechanical.csv` (264 data rows + header). Every row carries `review_status=mechanical-needs-manual-review`; neither CSV is a reviewed inventory yet (that is WP-020).
7. Package defect found and fixed (by the lead, before this packet ran): `docs/neuwave-rewrite/scripts/inventory_cf_os_rpc.py` originally failed on `api.ts` because its brace matcher treated apostrophes inside comments as string openers. A quote-aware comment-masking pass was added (`mask_comments`, lines 48–94: comments blanked to spaces with newlines preserved; `//` inside string literals correctly ignored). The package directory is untracked, so no git diff of the fix exists; the fix's presence and the successful CSV output are the observable evidence. **Recorded as a package defect + fix.**
8. `deployment.jsonc` placeholders are named tokens (`<CLOUDFLARE_ACCOUNT_ID>`, `<WORKSHOP_WORKER_NAME>`, …), and `deploy.mjs --check` rejects any `<…>` token — confirming root `AGENTS.md:50`'s substance (its literal `<PLACEHOLDER>` wording is generic, cosmetic difference only).

## Corrections

1. **Handed-down context correction:** the packet brief stated both planning branches locally match the package pins. Observed: local `merge/nuewave-docs` = `05436fe`, one commit ahead of the pin/origin (`8c3cf7a`). Harmless (the extra commit is contained in `origin/research/nuewave-longtail`), but source pointers citing "merge/nuewave-docs" should be resolved against the pinned commit or, preferably, against the canonical research branch.
2. **"Closed ledger" wording:** package documents (`01-AUTHORITY-AND-SCOPE.md`, `00-START-HERE.md`, kickstart prompt) treat the ledger as closed. It is closed only in the Q19-default sense; 57 rows await explicit verdicts and the roadmap's own next step is further ruling batches. See Premise-breaking findings.

## Unverified claims and coverage limits

- **No test suite was executed** (no installs allowed; no node_modules present). The pass/fail claims in root `AGENTS.md:48-50` (root `pnpm test` passes offline; cf-os tests pass after typed-storage build; `pnpm check` fails on placeholders) are verified structurally against scripts and file contents, not by execution. `pnpm check`'s failure mode is proven from source (`deploy.mjs:97-98`), the others are documented-but-unexecuted.
- Ledger row counts are mechanical glyph counts of `^| [☐◐✔]` table rows (101 rows at `13c2847` per the roadmap; my counts 43+57+1=101 agree). I did not re-read all 101 rows in full; deep row-by-row reconciliation is WP-010/WP-020 territory.
- The two mechanical CSVs were spot-checked (headers + first rows), not reviewed line-by-line; they are explicitly marked needs-manual-review.
- Neuwave-side content (endpoints, schemas, tokens) was located, not re-audited; the audits' factual claims were not independently re-derived.
- GitHub-side state (whether origin has branches/commits not fetched locally) was not checked — no network git operations were run. All "origin" statements reflect the local remote-tracking refs.

## Premise-breaking findings

**PB-1 — The ledger is not verdict-complete, and some open items cannot be defaulted.** The package's authority chain rests on "current owner rulings recorded in the closed decision ledger". Observed: 57 rows carry research but empty `Verdict:` slots, and the roadmap status log (research branch @ `13c2847`, `docs/plans/nuewave-native/roadmap.md`) explicitly lists items that "need David rather than more research": splitting the `documents` and Lambda mega-rows; **DLP has no ledger row** (a daily job that deletes user content on policy); **Redis** has no named CF successor; **ffmpeg** has no Workers-native successor; plus the long-tail pass adds: the **SSRF-by-DNS** blocker (three services + connectors; Workers cannot resolve hostnames), `convert_service`/**LibreOffice** must be ruled with the documents content model, `notification_service`'s provisional "Drop" is load-bearing, **frecency** and the **activity_events vocabulary have no ledger rows**, and a second **DynamoDB table was never harvested**. The Q19 default ("KEEP — faithful recreation") papers over ordinary rows but cannot rule on missing rows, substrate gaps, or row splits. Escalated to `reports/notes/wp000-owner-decisions.md` (and future `reports/06-owner-decisions-needed.md`) rather than silently resolved.

## Owner decisions needed

See `docs/neuwave-rewrite/reports/notes/wp000-owner-decisions.md` (9 items). Headlines: confirm the Q19-default reading of "closed ledger" for the 57 unruled rows; rule the roadmap's four "need David" items; rule the standing deferrals B and C3; create/rule the missing rows (frecency, activity_events, DLP); resolve the merge-branch pin drift.

## Files changed

Only under `docs/neuwave-rewrite/reports/`:

- `docs/neuwave-rewrite/reports/00-baseline-verification.md` (this report)
- `docs/neuwave-rewrite/reports/notes/wp000-owner-decisions.md`

No product code, no kernel files, no ledger content, no git state, and nothing in the Neuwave reference repo was modified (see incident disclosure under Worktree safety). Nothing was committed or pushed.

## Product implementation status

**Product implementation has not begun.** This packet produced verification reports only.
