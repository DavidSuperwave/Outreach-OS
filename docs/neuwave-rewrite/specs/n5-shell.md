# Domain specification — React shell (N5 / SUP-552)

## Verdict and source evidence

ADR-001 Accepted with amendment (OD-11): original React shell, 1:1 Neuwave parity, stock kernel
screens transitional only. Wave-2 skeleton: boots, 27-route map, split codec, OKLCH tokens,
command registry scope tree, 160 chrome command rows. Visual regression grows with domains.
Neuwave visual reference @ `9f7a26b`. Kernel pin untouched.

## User journeys

Signed-in user lands on home; `c` then `t` is enabled for N6 task compose; `g` leader opens go-to;
URL round-trips a multi-split layout; `cmd+k` in a soup split shadows the global command menu.

## Invariants

No `macro-*` identifiers, theme names, or storage keys (OD-24). Web-only (OD-9). Nothing at
`/.well-known` (OD-17). Dev-only splits are killed. Shell owns no authority; it renders what
receipts allow.

## Storage and indexes

Client layout state; URL is the durable encoding. Per-user last-route persistence is User DO later.

## RPC/API contract

Consumes 154 of 182 frozen kernel rows (AuthenticatedApi 51, Overseer 65, subscriber/client 38).
Does not implement Instantly send/activate. PublicApi / LoginAttempt / AdminApi stay N1.

## Commands and UI surfaces

160 chrome rows (`global` 23, `launcher` 27, `command-menu` 15, `go-to` 15, `create-menu` 13,
`theme` 40, `settings` 12, `split` 8, `scope` 4, `popover-split` 1, `home` 1, `block` 1).
Leaders `g` / `o` / `c`. Domain rows remain on N2/N4/N6.

## Tests and parity fixtures

`packages/shell/src/shell.test.tsx` — 27 routes, codec round-trip, brand tripwire, 160 commands,
154 RPC freeze, scope-tree shadowing/leaders/input-focus/touch, Shell SSR boot.

## Failure modes and rollback

Route-decode throws on unknown or killed splits. Rollback = revert wrapper assets.
