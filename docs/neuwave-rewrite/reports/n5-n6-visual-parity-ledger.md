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
| `/tasks` compose | `create-menu.task` / `c` then `t` (ledger L8) | compose popover `data-scope=task-compose-popover` | slice command test; hydrate `c`+`t` focuses title | Chromium compose submit | Popover is always open on `/tasks` (no launcher dialog yet). | partial |
| Soup task list | next-soup list + entity property commands | table `data-surface=soup.tasks` + tabs 1/2/3 | shell SSR; Soup status/priority projection; live create/mark-done | Chromium row + done toggle | No kanban/grid (N8). No Macro icons. OKLCH tokens, not extracted CSS dump. | partial |
| Status / priority | `soup-entity.status` shift+cmd+s, `soup-entity.priority` shift+cmd+p | `<select>` cells calling `TaskSessionApi.setStatus/setPriority` | slice list after setStatus; shell SSR options | pending live Chromium select | Chords shift+cmd+s/p not yet dispatched (modifier chord builder). Cells are the N6 edit path. | partial |
| Subscribe reconnect | WP-040 live update/reconnect | `/subscribe` replay from cursor | workers: drop socket, mutate, replay, resubscribe unique title | n/a | Query-token subscribe is browser-only (WS cannot set Authorization). | in-slice |
| Visual regression | 07 §Visual parity process | none yet | blocked | blocked | Reference screenshots cannot be captured without Neuwave @ 9f7a26b. | blocked |

## Keyboard (gate 6) — slice identities

Proven in `packages/task-slice/src/slice.test.tsx` (15 ids) and live hydrate registry:

- `global.create` (`c` leader)
- `create-menu.task` (`t` in create-menu — focus compose)
- `go-to.tasks` (`g` then `t`)
- `soup.tab-1/2/3` (All / Open / Done)
- `soup-nav` `j`/`k` focus
- `soup-entity.mark-done` (`e`)
- `soup-entity.rename` (`r` focuses title)
- `soup-entity.status` / `priority` / `assignee` / `properties` / `tags` / `soup.open` / `launcher.task` / `command-menu.open-category.tasks` — enablement + `runSliceCommand` on the typed capability
