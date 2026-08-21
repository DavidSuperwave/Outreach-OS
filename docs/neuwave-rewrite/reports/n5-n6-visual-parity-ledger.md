# N5/N6 visual + keyboard parity ledger

Neuwave visual reference pin: `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`.
This agent cannot read `DavidSuperwave/Neuwave` (GitHub 404 from the cloud
principal). Gate 7 therefore cannot run screenshot regression against that pin
until the reference repo is readable. Keyboard/a11y (gate 6) is proven from
the command ledger (`03-command-hotkey-ledger.csv`) plus live shell tests.

## Surfaces in this slice

| Surface | Old source evidence | Target | Automated proof | Manual proof | Intentional difference | Status |
|---|---|---|---|---|---|---|
| `/login` `/signup` | ledger PublicApi chrome; kernel `passwordHash.ts` argon2id | `LoginPane` + hydrate `/api` | shell 18; kernel-password unit; live Chromium signup | Chromium `/signup` → `/tasks` | Kernel stock screens are transitional (OD-11). No Macro trade dress. | partial |
| `/tasks` compose | `create-menu.task` / `c` then `t` (ledger L8) | compose popover `data-scope=task-compose-popover` | slice command test; chrome `c`+`t` opens compose without navigating; hydrate focuses title after open | Chromium `c` then `t` opens popover | Live hydrate focuses compose (does not auto-create). In-process `bindSliceCommands` still creates. | partial |
| Soup task list | next-soup list + entity property commands | table `data-surface=soup.tasks` + tabs 1/2/3 | shell SSR; Soup status/priority projection; live create/mark-done | Chromium row + done toggle | No kanban/grid (N8). No Macro icons. OKLCH tokens, not extracted CSS dump. | partial |
| Status / priority / assignee | `soup-entity.status` shift+cmd+s, `priority` shift+cmd+p, `assignee` shift+cmd+a, `properties` shift+cmd+o | cells + `chordFromEvent` → CommandRegistry | slice 15-identity dispatch; shell chord builder | Chromium selects persist (status/priority) | Tags field is read-only until N8 `setTags`. | partial |
| Subscribe reconnect | WP-040 live update/reconnect | `/subscribe` replay from cursor; hydrate `attachTaskSubscribe` | workers Keep v2; unit drop → replayFrom → reopen | n/a | Query-token subscribe is browser-only (WS cannot set Authorization). | in-slice |
| Visual regression | 07 §Visual parity process | none yet | blocked | blocked | Reference screenshots cannot be captured without Neuwave @ 9f7a26b. | blocked |

## Keyboard (gate 6) — slice identities

Proven in `packages/task-slice/src/slice.test.tsx` (15 ids dispatched through
`CommandRegistry` + `chordFromEvent`) and live hydrate `registerSliceHotkeys`
after `registerChromeHotkeys` (slice overrides win):

- `global.create` (`c` leader)
- `create-menu.task` (`t` in create-menu — live opens compose and focuses title; in-process creates)
- `launcher.task` (`t` in detached launcher scope — same compose-open path)
- `command-menu.open-category.tasks` (`o` then `t`)
- `go-to.tasks` (`g` then `t`)
- `soup.tab-1/2/3` (All / Open / Done)
- `soup.open` (`enter`)
- `soup-nav` `j`/`k`/`arrowdown`/`arrowup` through `CommandRegistry` (toolbar buttons `soup-nav.down-j` / `soup-nav.up-k`)
- `soup-entity.mark-done` (`e`) / `mark-not-done` (`shift+e`)
- `soup-entity.rename` (`r`)
- `soup-entity.status` (`shift+cmd+s`) / `priority` (`shift+cmd+p`) / `assignee` (`shift+cmd+a`)
- `soup-entity.properties` (`shift+cmd+o`) / `tags` (`t` on the soup split)

## Keyboard (gate 6) — N5 chrome

`packages/shell/src/n5-hotkeys.ts` registers every keyed row from
`03-command-hotkey-ledger.csv` (`N5_KEYED_BINDINGS`). Unkeyed rows
(command-menu only, including killed `global.hotkey-debugger`) stay in
`N5_UNKEYED_IDS`. Settings tabs `1`–`9` register on `detached` so they do not
steal soup tabs on a split. `cmd+k` toggles `data-surface=command-menu`.
`g` then `t` is `go-to.tasks`. `c` then `t` stays on `command-scope-create-menu`
(`chromeActiveScope` does not flip the launcher to `detached`). Slice
registration still wins on `/tasks`. Compose starts closed; `c` opens
`data-surface=create-menu` and `t` opens `task-compose-popover`.
