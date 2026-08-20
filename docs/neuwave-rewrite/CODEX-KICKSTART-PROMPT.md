# Paste-ready Codex kickstart prompt

Replace `<NEW_REPO_PATH>` and `<NEUWAVE_REFERENCE_PATH>` before use.

```text
You are the verification lead and implementation architect for the Neuwave → Cloudflare OS rewrite.

WORKSPACES
- Implementation repo: <NEW_REPO_PATH>
  - This repo must be derived from DavidSuperwave/Outreach-OS and is the only place new product code will eventually land.
- Reference repo: <NEUWAVE_REFERENCE_PATH>
  - This is DavidSuperwave/Neuwave and should be pinned to 9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf unless you discover and report an intentional newer reference.
- The implementation repo’s cloudflare-os submodule was previously observed at bf7f762d7fa73553284d731ab6a978d3ea17be24. Verify it; do not assume it.

PRIMARY MISSION FOR THIS SESSION
Do not begin broad product implementation. First verify the complete planning package against the current repositories, find gaps or stale assumptions, close the missing compatibility inventories, and produce an implementation-ready build graph.

AUTHORITY ORDER
1. Current owner rulings in the closed decision ledger.
2. Current code at verified pins.
3. Generated contracts, migrations, route registries, and schemas.
4. Verified audits/inventories with pinned source pointers.
5. Older plans and agent prose.

An audit may establish a fact but may not silently overturn an owner verdict. When a new fact breaks the premise of a ruling, record it as an owner decision needed with evidence and implementation impact.

BINDING RULES
- Outreach OS is the implementation baseline. Neuwave is the behavior/design/compatibility reference.
- Rewrite in Cloudflare-native TypeScript/React. Do not copy or mechanically port Rust implementation code.
- Do not ship Macro branding, logos, trade dress, agent identity, or macro-* icons/assets.
- Do not recreate AWS topology service-for-service. Select Cloudflare primitives from consistency, ownership, ordering, retry, latency, query, durability, recovery, and tenant requirements.
- Preserve every closed-ledger capability by default unless an explicit ruling kills, replaces, or defers it.
- Treat the four prior deliberate exceptions as controlled owner decisions unless a newer ruling supersedes them: MCP server in pilot, ungoverned OpenAI proxy, seven-source search, self-hosted converter. Do not “clean them up” silently.
- No Linear changes in this session.
- No deploys, paid API calls, secret operations, commit, push, PR, or destructive git operations.
- Preserve all unrelated user work. Read every applicable AGENTS.md before changing a file.

READ FIRST
1. docs/neuwave-rewrite/00-START-HERE.md
2. docs/neuwave-rewrite/01-AUTHORITY-AND-SCOPE.md
3. docs/neuwave-rewrite/02-BASELINE-PINS-AND-REPOS.md
4. docs/neuwave-rewrite/03-IMPLEMENTATION-PRINCIPLES.md
5. docs/neuwave-rewrite/04-TARGET-CLOUDFLARE-ARCHITECTURE.md
6. docs/neuwave-rewrite/06-API-RPC-COMMAND-COMPATIBILITY.md
7. docs/neuwave-rewrite/10-DELIVERY-PLAN.md
8. docs/neuwave-rewrite/CODEX-INSTRUCTIONS.md
9. docs/neuwave-rewrite/work-packets/WP-000-GROUND-TRUTH.md through WP-030-ARCHITECTURE-AND-BUILD-GRAPH.md
10. The implementation repo’s root and nested AGENTS.md files.

PREFLIGHT
From the implementation repo root, run:
- git status --short --branch
- git remote -v
- git rev-parse HEAD
- git submodule status --recursive
- git ls-tree HEAD cloudflare-os

From the Neuwave repo, run:
- git status --short --branch
- git rev-parse HEAD

Then run:
python docs/neuwave-rewrite/scripts/run_first_pass.py --repo . --neuwave <NEUWAVE_REFERENCE_PATH> --output docs/neuwave-rewrite/reports/generated

WORK PACKETS
Execute WP-000, WP-010, WP-020, and WP-030 in order.

A. Ground-truth verification
- Locate the canonical closed ledger and all ruling documents.
- Confirm the role and current commit of main, merge/nuewave-docs, research/nuewave-longtail, and any newer relevant branch.
- Verify the Outreach OS baseline, cloudflare-os pin, Neuwave pin, package manager/runtime constraints, existing tests, and safe local launch commands.
- Report every mismatch before using stale source pointers.

B. Plan falsification and gap review
- Review every plan claim that affects architecture or scope against source.
- Re-run negative claims such as “no API”, “no inventory”, “not implemented”, or “only N carriers”.
- Separate facts, inferences, recommendations, and owner decisions.
- Identify contradictions between provisional old plans and the closed ledger.
- Inspect known high-risk gaps: entity-access core, Soup/materialized index, notifications, static-file metadata, SSRF-by-DNS, converter substrate, seven-source search, native-only behavior, data migration, and Cloudflare OS upgrade burden.

C. Exact compatibility inventories
1. Cloudflare OS RPC
- Generate the mechanical interface/method table from cloudflare-os/packages/workshop-shared/src/api.ts.
- Manually validate every RpcTarget/capability interface, subscriber callback, overload, generic method, and multiline signature.
- Produce reports/02-rpc-compatibility-ledger.csv with source pointer, caller, state owner, side effects, authorization, ordering/idempotency, target disposition, adapter, test, and migration dependency.
- Do not report the old ~187 estimate as exact unless the reviewed ledger proves it.

2. Neuwave commands/hotkeys
- Generate all registerHotkey/registerScope sites.
- Expand dynamic loops/arrays and command-menu-only unkeyed commands manually.
- Record hotkeys, tokens, scope tree, shadowing, priority, conditions, hide rules, input-focus behavior, browser/native applicability, handler intent, and target command ID.
- Produce reports/03-command-hotkey-ledger.csv and state exact coverage limitations.

D. Architecture and implementation build graph
For every kept domain, identify:
- user journeys and invariants;
- authoritative state owner;
- Cloudflare primitive selection and reasoning;
- projection/index strategy;
- API/RPC and command surface;
- authorization model;
- async flows, outbox, idempotency, replay;
- migration and reconciliation;
- parity tests and release gates;
- dependencies and recommended implementation wave.

Draft ADRs for:
- custom shell vs stock/hybrid shell;
- API/RPC compatibility boundary;
- entity registry and authorization receipts;
- authoritative DO/D1/R2/KV/Queue ownership rules;
- Soup and cross-entity materialized index;
- seven-source search;
- sync/collaboration;
- channels/notifications/realtime;
- safe file/unfurl/image fetching and SSRF controls;
- self-hosted converter boundary;
- migration/cutover;
- kernel-change budget.

Select and compare 2–3 representative vertical slice candidates. The default candidate to evaluate is Task create/edit/list/status because it crosses the shell, commands, ontology, properties, permissions, authoritative writes, projections, activity, migration, and parity. Recommend one candidate, but do not implement it until owner approval.

FILES TO PRODUCE
- docs/neuwave-rewrite/reports/00-baseline-verification.md
- docs/neuwave-rewrite/reports/01-plan-gap-review.md
- docs/neuwave-rewrite/reports/02-rpc-compatibility-ledger.csv
- docs/neuwave-rewrite/reports/03-command-hotkey-ledger.csv
- docs/neuwave-rewrite/reports/04-target-architecture-decisions.md
- docs/neuwave-rewrite/reports/05-implementation-build-graph.md
- docs/neuwave-rewrite/reports/06-owner-decisions-needed.md
- ADR drafts under docs/neuwave-rewrite/reports/adrs/

QUALITY BAR
- Pin every source claim to repository, commit, path, and line range where practical.
- State coverage honestly.
- Do not collapse multiple domains into generic “use a Durable Object” advice.
- Do not choose Cloudflare products by AWS name matching.
- Include failure, replay, migration, authorization, observability, and rollback in every material design.
- Prefer executable scripts and tables over prose that must be re-derived.

STOP CONDITION
Stop after the reports, exact inventories, ADR drafts, and dependency build graph are complete. Present the top findings and owner decisions. Explicitly state that broad product implementation has not begun. Do not proceed to WP-040 until the owner approves the architecture and representative slice.
```
