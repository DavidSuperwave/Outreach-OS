# Authority and scope

## Ground truth order

When sources conflict, use this order:

1. **Current owner rulings** recorded in the closed decision ledger.
2. **Current code at verified pins** for what the old and target systems actually do.
3. **Generated contracts and migrations**: RPC interfaces, OpenAPI, GraphQL, schemas, storage migrations, route registries.
4. **Verified audits and inventories** that cite pinned source locations.
5. **Planning prose and prior agent summaries**.

An audit can establish a fact. It cannot silently overturn an owner verdict.

A new fact that breaks the premise of a verdict must be written to `reports/06-owner-decisions-needed.md` with evidence and impact.

## Repository roles

| Repository | Role | Rule |
|---|---|---|
| New repo derived from Outreach OS | Implementation home | All new code and living implementation docs land here. |
| Outreach OS | Baseline/reference for wrapper, deployment, and Cloudflare OS integration | Preserve its deploy and secret discipline unless a documented ADR changes it. |
| Neuwave | Product behavior, architecture, UI/UX, and compatibility reference | Read and verify. Rewrite from scratch. Do not copy Rust code or Macro branding. |
| `cloudflare/cloudflare-os` submodule | Kernel and platform primitive source | Prefer extension points. Kernel changes require an explicit ADR and compatibility budget. |

## Scope policy

The default for the closed ledger is **faithful recreation unless explicitly killed, replaced, or deferred by an owner ruling**.

Do not revive stale provisional “drop” decisions from earlier planning drafts when the closed ledger says otherwise.

Known explicit non-goals or replacements that must be re-verified against the current ledger:

- AWS substrate is replaced by Cloudflare-native services.
- FusionAuth is replaced rather than recreated.
- GraphQL Soup is replaced by typed RPC rather than recreated as an internal wire protocol.
- Macro branding, trade dress, and `macro-*` icons do not ship.
- Rust code is not ported line-for-line.

## Deliberate exceptions

Prior rulings identified four deliberate exceptions. Treat them as controlled exceptions, not cleanup bugs, unless a newer owner ruling supersedes them:

1. MCP server remains in the pilot.
2. The ungoverned OpenAI proxy remains.
3. Seven-source search remains.
4. The self-hosted converter remains.

For each exception, Codex must document:

- boundary and owner;
- threat and failure model;
- observability;
- deployment and rollback;
- why it does not become the default pattern for adjacent features.

## Change safety

The first verification pass may add reports, inventory scripts, and ADR drafts. It must not:

- deploy;
- create or rotate secrets;
- push or commit without explicit instruction;
- rewrite product code;
- modify the closed ledger’s verdicts;
- erase uncommitted user work;
- mass-format unrelated files.
