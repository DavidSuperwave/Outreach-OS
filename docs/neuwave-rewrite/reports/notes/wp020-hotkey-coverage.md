# WP-020 — Neuwave command/hotkey coverage note

Source of truth: Neuwave repo pinned at `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` (read-only).
Ledger: `docs/neuwave-rewrite/reports/03-command-hotkey-ledger.csv` (387 rows; every row cites pin + path + line).

## Exact counts

### Registration sites (mechanical CSV reconciliation)

The mechanical pass (`neuwave-hotkeys-mechanical.csv`) reported **264 rows**. Manual review classifies them as:

| Class | Rows | Detail |
|---|---|---|
| Product `registerHotkey` sites | **247** | all reviewed and carried into the ledger |
| Product `registerScope` sites | **4** | 3 global leader scopes (`lib/constants/hotkeys.ts:21,28,35`) + favorites scope (`FavoritesCommands.tsx:15`); ledgered as `scope.*` rows |
| Infrastructure / false positives | **13** | `lib/core/hotkey/hotkeys.ts` lines 94, 101, 105, 109, 355, 363, 371, 379, 431 (JSDoc examples + TS overload signatures), 212, 444 (internal `registerScope` calls inside `registerHotkey`/`useHotkeyDOMScope`); `lib/core/hotkey/utils.ts` 162 (the `registerScope` definition itself), 611 (generic forwarding call inside `registerScopeSignalHotkey`) — none are commands |

**Mechanical-scan gap found:** the scan matched only `registerHotkey`/`registerScope` and missed the `registerScopeSignalHotkey` wrapper. Its **4 product call sites** are added to the ledger:

- `features/block-chat/component/Chat.tsx:284` (Enter → focus chat input) and `:296` (Ctrl+C → stop AI response)
- `features/block-email/component/Email.tsx:531` (Enter → reply/expand) and `:559` (Escape → collapse message)

Total product registration sites reviewed: **247 + 4 + 4 = 255**.

### Expanded command counts (never hidden inside an "approximately")

| Bucket | Count |
|---|---|
| Ledger rows total | **387** |
| Scope-registration rows (`scope.*`, not commands) | **4** |
| Command rows | **383** |
| — statically enumerated commands (fully expanded) | **379** |
| — runtime-generated registration markers (cannot be statically expanded) | **4** |
| Unkeyed / command-menu-only or list-item-only commands (no keyboard chord) | **88** |
| Commands hidden from hotkey UI (`hide` rules) but still executable | **73** |

### The 4 runtime-generated registrations (explicit, per row)

1. `favorites.open.<favorite>` — `features/command/FavoritesCommands.tsx:77`. One command per user favorite; re-registered on every favorites-query change. Unbounded, user-data-driven.
2. `theme.set-visible.<user-theme>` — `components/app/GlobalHotkeys.tsx:434`. `themes()` = 12 static default themes (expanded in the ledger) **plus** user themes from localStorage `macro-user-themes`; the user-theme portion is runtime data. Note: the loop is non-reactive, so themes created after mount get no command until remount.
3. `theme.default-light.<user-theme>` — `GlobalHotkeys.tsx:463` (same data source).
4. `theme.default-dark.<user-theme>` — `GlobalHotkeys.tsx:489` (same data source).

Also runtime, but a multiplicity rather than distinct commands: every per-split / per-block / per-popover DOM scope re-registers the same command identity once per live instance (splits, canvas blocks, email threads, drawers, popovers). The ledger records one row per command identity and marks the per-instance nature in the notes.

### Static loop expansions performed (site → commands)

| Loop | Site | Expanded to |
|---|---|---|
| `CREATABLE_BLOCKS` in create-menu scope | `GlobalHotkeys.tsx:194` | 12 |
| Launcher items (dialog open) | `Launcher.tsx:737` | 12 |
| Launcher shift-variants (`altHotkeyToken`) | `Launcher.tsx:748` | 9 (email, agent, document, task, snippet, message, canvas, folder, code) |
| Command-menu category chords (`o` + key) | `GlobalHotkeys.tsx:251` | 7 |
| Default themes × 3 theme sub-menus | `GlobalHotkeys.tsx:434/463/489` | 36 (12 each) + 3 runtime markers |
| Sidebar go-to links (`g` + key) | `sidebar.tsx:515` | 15 (incl. flag-gated Activity/Reminders/Calls/Customers/Calendar/Getting-Started; `/` search is global-scope standalone) |
| Markdown inline formats | `useMarkdownCommands.ts:167` | 8 |
| Markdown slash-command actions | `useMarkdownCommands.ts:189` | 15 (16 ACTIONS; `task` has no token and is skipped) |
| Calendar view keys | `use-calendar-hotkeys.ts:46` | 3 |
| Channel find-in-channel two-scope loop | `create-channel-hotkeys.ts:205` | 2 |
| Soup tab digits | `use-soup-view-hotkeys.ts:366` | 9 |
| CRM company property commands | `use-entity-action-hotkeys.ts:681` | 3 |
| Settings tab digits | `Settings.tsx:198` | 9 |
| Onboarding mock sidebar links | `MockAppChrome.tsx:142` | 5 |

## Scope-tree summary

Root is the `global` scope (attached to the document element; active scope switches on `focusin` via `data-hotkey-scope` DOM attributes). Dispatch walks **from the active scope up the parent chain**; within one scope, handlers on the same chord sort by `handlerPriority` (default 0, HIGH=3); the first handler returning `true` captures the event and stops the walk. `registrationType: 'override'` (default) replaces earlier same-chord registrations in a scope; `'add'` stacks them. The whole hotkey system is **disabled on touch devices**; `cmd` is declared mac-style and auto-translated to `ctrl` on non-mac (the only platform-conditional behavior; there are no native/Electron-only registrations — everything is browser-applicable).

```
global
├─ command scopes (leader keys, registered at module load)
│  ├─ command-scope-go-to            leader 'g'  → 14 nav chords + per-soup 'g g' (add)
│  ├─ command-scope-command-menu-category  leader 'o' → 7 category chords
│  ├─ command-scope-create-menu      leader 'c'  → 12 create chords
│  └─ command-scope-favorites        no key; entered via 'Favorites' menu command
├─ dynamic command scopes (activateCommandScope at mount)
│  ├─ change-theme, set-default-light-theme, set-default-dark-theme (GlobalHotkeys)
│  └─ onboarding mock go-to scope
├─ per-split DOM scopes (split panel) — split.* commands, soup list commands,
│  chat/home focus commands, soup filters/sort/search/ask-ai, side-panel toggles
│  └─ per-block DOM scopes — canvas.*, email.*, md.*, code.*, channel bot commands,
│     block-entity.* (block command registrar), block.share
│     └─ inner DOM scopes — compose-email, channel-messages, channel-input,
│        channel-reply-input, message-editor, code-mirror-editor
└─ detached DOM scopes (modal/popover; deliberately cut off from global fallthrough)
   — create-menu (Launcher), move-to-project (both variants), task/skill compose
     popovers, popover splits, settings, command-menu (non-detached but focus-owning)
```

Command-scope semantics: activating a leader re-parents its command scope onto the *currently active* scope so deactivation returns correctly; any non-modifier key not handled inside a command scope jettisons focus back to the closest DOM scope. `GoToHotkeys` additionally installs a **hotkey interceptor** that swallows non-goto keys while the `g` hint overlay is visible.

### Notable shadowing/priority facts captured per row

- soup `cmd+k` (entity-action-aware) shadows global `cmd+k`; onboarding `cmd+k` swallows both during the tutorial (plus monkey-patched `CommandState`).
- canvas `cmd+z`/`shift+cmd+z` shadow global undo/redo; canvas `opt+[`/`opt+]` shadow split back/forward only while a selection is active (handlers return `false` otherwise, falling through).
- `h` is triple-booked in block scope: canvas hand tool (override) vs "Remind me" (add, condition excludes canvas) vs soup collapse (add, `handlerPriority=4`).
- Email compose `arrowup` (empty body) shadows thread previous-message; `registrationType: 'add'` is used wherever coexistence is intended (split focus left/right, thread handlers at `handlerPriority=HIGH`, `g` leader, soup `cmd+f` stacking).
- `runWithInputFocused` is the input-focus gate: default suppresses handlers while an editable is focused; the ledger records it per row. `proxiedHotkey` (markdown inline formats) means Lexical owns the keystroke and the hotkey system only displays it / runs it from the command menu.

### Telemetry

A global keypress subscriber fires `hotkey_use {action, token, key}` for **every captured command** (debounced for repeated keys). Handler-specific events recorded per row: `create_menu_open`, `command_menu_open`, `command_menu_use`, `theme_changed`, `split_created`, `preview_panel_use`, `share_menu_open`, plus data-layer creation analytics.

## Owner decisions needed

1. **Dormant `opt+r` Reply-all** (`emailHotkeys.ts:32`): only registered when the caller passes `replyAllToFocusedMessage`; the sole caller (`Email.tsx:513`) omits it and wires `r` to reply-all semantics instead. Keep, fix, or drop in the rewrite? (row disposition: needs-owner-ruling)
2. **Brand tripwires** (07-UI-UX rules): "MCP setup" command (tags `connect macro`, Macro-branded modal), theme names "Macro Dark"/"Macro Light", localStorage keys `macro-*`, and the Macro logo in the command-menu header. Marked `adapt`; new names needed.
3. **Dev-only commands**: `Open hotkey debugger` (LOCAL_ONLY builds) and `Toggle lexical state debugger` (double-registered from `Notebook.tsx:473` and via `registerMarkdownCommands` options). Marked `defer` — confirm they are out of scope for the first React pass.
4. **Known quirks to preserve or fix** (flagged in row notes, currently `preserve` with note): leftover `console.log('## CMD K ...')` in both cmd+k handlers; `md.copy-branch-name` re-registration leak on scope change (`block-md/TopBar.tsx:85`); non-reactive theme loops missing late-created user themes; canvas `cmd+v` display-only registration (real paste is a DOM `paste` listener); `email.send` token passed as raw string in `ComposeLayout.tsx:150`.
5. **Sidebar toggle scoping**: `cmd+.` dies on full-cover routes because `AppSidebar` unmounts (comment says intentional). Confirm the rewrite reproduces this or promotes it to an always-mounted registrar like `GoToHotkeys`.

## How to regenerate / audit

The ledger was hand-derived (each row traced to source at the pin); the generator script snapshot used to serialize it lives outside the repo (scratchpad `gen_ledger.py`). To audit any row: open `source_path:source_line` at commit `9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf` in the Neuwave repo.
