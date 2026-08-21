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
| Soup task list | next-soup list + entity property commands | table `data-surface=soup.tasks` + tabs 1/2/3; focused-row highlight; title text until `r`; property chips until status/priority/assignee/tags command | shell SSR chips (no default `<select>`); Soup status/priority projection; live create/mark-done | wrangler Chromium + CDP `g` overlay | No kanban/grid (N8). No Macro icons. OKLCH tokens, not extracted CSS dump. | partial |
| Status / priority / assignee | `soup-entity.status` shift+cmd+s, `priority` shift+cmd+p, `assignee` shift+cmd+a, `properties` shift+cmd+o | chips until command/click opens the cell editor | slice 15-identity dispatch; shell SSR chips | Chromium chip → select on command | Tags editor is read-only until N8 `setTags`. | partial |
| Subscribe reconnect | WP-040 live update/reconnect | `/subscribe` replay from cursor; hydrate `attachTaskSubscribe` | workers Keep v2; unit drop → replayFrom → reopen | n/a | Query-token subscribe is browser-only (WS cannot set Authorization). | in-slice |
| Left sidebar | Neuwave `AppSidebar` + go-to links | `aside[data-chrome=sidebar]` + ledger rows; `g` arms `data-leader=g` hints (2s) | shell SSR layout/collapse/full-cover + leader overlays | wrangler Chromium | No Macro icons. Search/markdown-docs hiddenFromSidebar. | partial |
| Theme variants | OKLCH token layer (07-UI-UX); Change theme nested palette | `tokenVars` for all 12 `THEME_IDS`; hydrate restores any stored id | shell token map + SSR `data-theme=ember` | wrangler Chromium: Ember (warm) and Paper (cream) apply + persist across reload | Outreach-named palettes, not extracted Macro CSS. Gate 7 vs Neuwave pin still blocked. | partial |
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
steal soup tabs on a split. `cmd+k` toggles `data-surface=command-menu` (search + 7 category tabs).
`o` then `t` opens that palette on the Tasks category (ledger L22), it does not
navigate. Arrow keys move `data-selected`; Enter confirms the highlight.
Tab / Shift+Tab cycle the 7 category tabs while the palette is on the root
scope (priority 10 on detached so they beat settings.next-tab). `cmd+k` is
dispatched in the capture phase so the registry can preempt the browser find
bar when the event reaches the page.
`global.change-theme` pushes a nested palette scope listing THEME_IDS;
each id has its own OKLCH token set (`tokenVars`). Hydrate restores any
stored `THEME_IDS` value, not only outreach-dark/light.
Escape / Backspace (empty query) returns to the root list.
`g` then `t` is `go-to.tasks`. Pressing `g` sets `data-leader=g` on the
sidebar, shows `data-surface=go-to-hints`, and arms go-to kbd hints
(`data-goto-hint`); they auto-reset after `LEADER_HINT_RESET_MS` (2s). Live
CDP on wrangler (`Input.dispatchKeyEvent` within 200ms): `data-armed-leader=g`,
`data-surface=go-to-hints`, filled kbd hints while signed in as `navgate`.
computerUse screenshots often miss the overlay because they arrive after the
2s reset. Stray non-goto keys jettison the leader and are swallowed in hydrate.
Soup property chips are not input-gated; remaining soup/compose fields still
use `chromeInputFocused` so `g`/`o`/`c` can arm on `/tasks`. `o` shows
`data-surface=open-category-hints` until a category chord or the same 2s reset;
`o` then `t` opens the command menu on Tasks. `c` then `t` stays on
`command-scope-create-menu`
(`chromeActiveScope` does not flip the launcher to `detached`). Slice
registration still wins on `/tasks`. Compose starts closed; `c` opens
`data-surface=create-menu` and `t` opens `task-compose-popover`.
Left chrome is `aside[data-chrome=sidebar]` (not a top header). Search and
markdown-documents stay `hiddenFromSidebar`. Login/settings/mcp unmount the
sidebar (`data-layout=full-cover`); `cmd+.` is dead there.
