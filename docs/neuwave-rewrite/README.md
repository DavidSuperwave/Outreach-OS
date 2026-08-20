# Neuwave → Cloudflare OS: Codex implementation kickstart

This package is a **drop-in implementation control plane** for a new repository derived from `DavidSuperwave/Outreach-OS`.

Its purpose is to make Codex verify the source truth, challenge the existing plan, close the compatibility inventories, and produce an implementation-ready build graph **before** broad product work begins.

It is not a claim that the Neuwave product has already been rewritten. It is the operating package for doing that rewrite safely and systematically.

## What is inside

- A source-of-truth and decision hierarchy.
- The Cloudflare-native target architecture.
- Domain, UI/UX, data, migration, testing, and operating rules.
- Codex-specific instructions and a paste-ready first prompt.
- Work packets for the verification and planning phase.
- Templates for gap registers, ADRs, parity tables, and implementation plans.
- Cross-platform scripts to verify repository pins and generate the first RPC/hotkey inventories.

## Fastest way to use it

### Option A — unzip directly into the new repository

Unzip this folder at:

```text
docs/neuwave-rewrite/
```

Then open `CODEX-KICKSTART-PROMPT.md`, replace the two repository path placeholders, and paste it into Codex from the repository root.

### Option B — use the installer

From the extracted package folder:

```bash
python scripts/install_into_repo.py --target /path/to/new-repo
```

On Windows PowerShell:

```powershell
python .\scripts\install_into_repo.py --target C:\path\to\new-repo
```

The installer never overwrites an existing root `AGENTS.md`. It creates a pointer file and prints the small instruction block to add manually.

## First-pass command

After installation, from the new repository root:

```bash
python docs/neuwave-rewrite/scripts/run_first_pass.py \
  --repo . \
  --neuwave ../Neuwave \
  --output docs/neuwave-rewrite/reports/generated
```

PowerShell:

```powershell
python .\docs\neuwave-rewrite\scripts\run_first_pass.py `
  --repo . `
  --neuwave ..\Neuwave `
  --output .\docs\neuwave-rewrite\reports\generated
```

This command is read-only with respect to product code. It writes verification and inventory reports only.

## Expected first-pass outputs

Codex should produce or complete:

1. `reports/00-baseline-verification.md`
2. `reports/01-plan-gap-review.md`
3. `reports/02-rpc-compatibility-ledger.csv`
4. `reports/03-command-hotkey-ledger.csv`
5. `reports/04-target-architecture-decisions.md`
6. `reports/05-implementation-build-graph.md`
7. `reports/06-owner-decisions-needed.md`

Codex should stop before broad product implementation and present the build graph for owner review.

## Core rule

**Outreach OS is the baseline implementation repo. Neuwave is the behavior and design reference.**

Do not reconstruct Neuwave's AWS topology on Cloudflare. Preserve product behavior and contracts while selecting Cloudflare primitives from actual consistency, ownership, ordering, retry, latency, durability, query, and recovery requirements.
