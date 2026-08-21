# Domain specification — Cutover + launch (N21 / SUP-568)

## Verdict and source evidence

Branch A cutover is light: DNS/switch-on, old-repo archive, per-domain release
gates against `09-TESTING-PARITY-AND-RELEASE-GATES.md`. There is no legacy
production data to retire (OD-19: no automated retention deletion).

This node cannot flip production DNS from a cloud agent (no `pnpm deploy`, no
Cloudflare quota). The wrapper freeze is the gate checklist plus Instantly
reads-only assertion.

## User journeys

Operator runs `pnpm test` + `pnpm governance`. Kernel submodule is pristine.
Instantly session has no send/activate/start. Seed fixtures load.

## Invariants

Do not merge kernel patches. Do not implement Instantly writes. Rollback =
previous worker + previous seed; there is no dual-run store.

## Tests and parity fixtures

`packages/seed` cutover checklist: required domain packages exist,
`STORAGE_OWNERS` covers Wave 4 rows, Instantly forbidden methods stay closed,
per-domain `DOMAIN_RELEASE_SIGNOFF` covers all ten 09 gates, kernel pin is
pristine (182-cap freeze), `deployment.jsonc` still has `<PLACEHOLDER>` values,
Branch A dual-run / data-migration / agent-deploy flags stay false. Rollback
strategy is `previous-worker-and-seed`. Fixture gallery `#cutover`.

## Open decisions

Live DNS and Cloudflare account placeholders in `deployment.jsonc` stay
`<PLACEHOLDER>` until a human fills them. `pnpm check` failing on those values
is expected, not a gate failure. Old-repo archive is a human leftover.
