# WP-000 — Ground truth and source pins

## Objective

Establish the exact repositories, commits, branch roles, decision authority, local constraints, and test baseline.

## Inputs

- Implementation repo.
- Neuwave reference repo.
- This package.
- Any existing rewrite package or planning branches.

## Steps

1. Inspect git status, remotes, HEADs, branches, submodules, and untracked work.
2. Locate all applicable `AGENTS.md` files.
3. Verify Node/pnpm/Python versions and safe local commands.
4. Locate the canonical closed ledger, ruling batches, audits, endpoint inventories, schema harvests, and source artifacts.
5. Compare observed references with `manifest/source-pins.json`.
6. Record mismatches and their effect on source pointers.
7. Run existing non-deploy tests that are safe/offline; distinguish configuration-placeholder failures from code failures.

## Deliverable

`reports/00-baseline-verification.md` using the verification-report template.

## Acceptance

- Every repo and submodule has an exact commit.
- Branch roles are explicit.
- Worktree safety is documented.
- Canonical verdict source is identified.
- Safe tests and local launch commands are proven or failures recorded.
- No product code changed.
