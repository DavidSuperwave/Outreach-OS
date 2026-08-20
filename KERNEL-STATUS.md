# Kernel status

Living ADR-014 ledger. Agents must not patch `cloudflare-os/` or bump this pin without an ADR.

| Field | Value |
|---|---|
| Kernel pin | `bf7f762d7fa73553284d731ab6a978d3ea17be24` (2026-08-05) |
| Wrapper observation pin | `dec12f2df3d205965838526076b910cdb8a845ce` (package generation) |
| Wrapper HEAD at N0 | `026760c` (`main`: curl in Cursor image + rewrite control plane) |
| `api.ts` sha256 | `30a2cade8a3425e69664fc4d6c71d370d0a28aa1c42c676f1126d4d13ed15ef3` |
| RPC ledger | `docs/neuwave-rewrite/reports/02-rpc-compatibility-ledger.csv` (182 rows) |
| Carried patches | **none** (zero-patch budget, OD-10) |
| Parked, not admitted | `patches/sup-536-openrouter-kernel.patch` lives on planning branches only; needs a retroactive ADR before it may land |
| Last upgrade rehearsal | N0 bootstrap 2026-08-20 — pin verified locally; upstream `cloudflare/cloudflare-os` head not fetched (no pin bump) |

## Commands

```sh
pnpm governance          # kernel budget + 182-row RPC freeze
pnpm test                # includes governance tests
pnpm check               # deploy dry-run; FAILS on committed <PLACEHOLDER> values by design
pnpm --dir cloudflare-os run-local   # Workshop at http://localhost:8787
```

## Deploy discipline

`deployment.jsonc` ships with annotated placeholders (`<CLOUDFLARE_ACCOUNT_ID>`, worker names, Access issuer/audience). `scripts/deploy.mjs --check` (`pnpm check`) must reject those placeholders. That failure is **not** an environment bug and is **not** a reason to skip Node/pnpm/submodule setup. Fill real Cloudflare account values only when deploying; do not commit secrets.

## Extension ladder (before any kernel patch)

wrapper worker / service binding → custom shell (ADR-001) → gadget/workpiece → Gatekeeper → new wrapper capability namespace (ADR-002) → kernel patch proposal with ADR + upgrade-cost estimate + owner sign-off.

## How CI asserts this

`scripts/governance/kernel-budget.mjs` fails the build when:

1. the `cloudflare-os` gitlink or checkout is not the pin;
2. the submodule worktree is dirty;
3. `api.ts` does not match the frozen sha256;
4. a `patches/*.patch` file exists without an ADR reference and a row in this file.
