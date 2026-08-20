# Start here

## Mission

Create a new Cloudflare-native product from the Outreach OS baseline that faithfully recreates the ruled Neuwave features, architecture semantics, workflows, command behavior, and UI/UX—without copying Rust implementation code or Macro branding.

The first Codex session is a **verification and implementation-planning session**, not a broad coding session.

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

Run the first-pass script, inspect the generated reports, and then complete WP-000 through WP-030.

Do not begin domain implementation until these conditions are true:

- Repository pins and branch roles are verified.
- The current closed decision ledger has been located and reconciled.
- The exact Cloudflare OS RPC inventory exists.
- The exact Neuwave command/hotkey inventory exists, including dynamically registered entries.
- Every stateful domain has a proposed authoritative owner.
- Plan contradictions and premise-breaking facts have been escalated rather than silently resolved.
- A representative vertical slice has been selected and approved.
