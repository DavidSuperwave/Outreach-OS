# N5 command runtime coverage

Authority: frozen `03-command-hotkey-ledger.csv` at Neuwave
`9f7a26bccb85e6f806a6e0c8d6c8e53f3a3541bf`, OD-11/23/24, and the N5 build-graph
allocation. This pass does not claim visual parity or N5 completion.

## Exact disposition

`packages/shell/src/n5-command-coverage.ts` generates one disposition for each
of the 160 N5 registry/chrome identities:

| Disposition | Identities | Runtime treatment |
|---|---:|---|
| `functional` | 70 | 80 keyed bindings are registered; each identity dispatches through `CommandRegistry` to a route, modal, selection, settings, theme, sidebar, focus, or split state transition. |
| `command-menu-only` | 50 | 44 fixed unkeyed commands execute from the palette; 3 `scope.*` rows are structural, and 3 user-theme markers generate executable runtime children. |
| `downstream-gated` | 39 | 33 keyed and 6 unkeyed rows are disabled and unregistered until the named domain supplies the required authority/state. |
| `owner-gated` | 1 | `global.hotkey-debugger` remains killed while OD-23(b) is unruled. |

Total: **160**, exactly once. There are no enabled handlers that intentionally
return a no-op.

## Current N5 boundary

- Functional now: `g`/`o`/`c` leaders; all 15 go-to routes; command-palette
  open/category/selection/scope controls; create/launcher task compose; menu
  close/confirm controls; new split; split close/spotlight/history/focus/preview/
  drawer/popover controls; sidebar; settings close/cycle/direct keys `1`–`9`;
  home ask focus; logout/account/MCP; all 12 static visible/default theme choices;
  system theme and auto-detect.
- Command-menu-only by ledger: account/logout/MCP/theme leaders, static theme
  choices, three structural leader scopes, and three runtime markers that
  materialize visible/default-light/default-dark children from
  `outreach-user-themes`.
- Downstream-gated: non-task creation and launcher actions (N7/N9/N10/N11);
  instructions (N7); uploads (N14); mutation undo/redo; favorites (N17);
  invites (N1); block sharing (N2).
- Owner-gated: the LOCAL_ONLY hotkey debugger. OD-23's other quirks are not
  reproduced as inert behavior.

Settings expose nine commandable routes. The three connected surfaces
(Connections, MCP, Bots) keep their N10 content; the remaining six routes
identify their downstream boundary instead of silently routing every digit to
the same three-tab surface.

## Accessibility

The command palette is an `aria-modal` labelled dialog. Opening it stores the
opener and focuses search; closing restores the opener. Focus wraps inside the
dialog. Results use a labelled button group with one `aria-current` selection,
avoiding interactive descendants inside listbox options. Registry-backed
Arrow/Ctrl-J/K selection, Enter/Shift-Enter confirmation, Tab/Shift-Tab category
navigation, and Escape/Backspace nested-scope navigation remain executable.

## State, authorization, and failure model

The shell owns client navigation and ephemeral chrome state only. It does not
mint receipts or perform domain writes. A downstream command stays disabled
until its owner supplies an authorized callback; it does not navigate to a
placeholder as a substitute for the requested mutation. Handler callbacks
return `false` on unavailable state so registry scope walking remains correct.
Retry/idempotency belongs to each downstream domain and is not invented here.

## Compatibility, tests, migration, rollback

- `n5-command-coverage.test.tsx` reconciles all 160 identities, dispatches every
  functional keyed identity through the real registry, verifies its specified
  observable effect, proves gated keyed rows are absent, executes all unkeyed
  commands, and exercises focus lifecycle/modal semantics.
- `client-hydrate.test.tsx` installs the production capture listener and proves
  split URL/component state, launcher scope, current/new task split behavior,
  category cycling, nested focus trapping, Escape, and focus restoration.
- `shell.test.tsx` retains scope-tree, shadowing, codec, route, theme, settings,
  and shell SSR coverage.
- No wire/storage migration. Rollback is a wrapper-only revert.
- Kernel `bf7f762`, task-slice backend/projection code, and the 182-capability
  frozen RPC surface are untouched.

## Remaining blockers

Gate 7 visual parity remains blocked because the pinned Neuwave source/screens
are inaccessible to the cloud principal. Real Workshop binding remains open.
Downstream-gated commands require their owning domains to expose authorized
runtime callbacks; this pass does not cross those ownership boundaries.

The N6 hydrate now binds the exact seven-callback split interface:

```ts
{
  closeSplit(): boolean;
  toggleSplitSpotlight(): boolean;
  splitHistory(delta: -1 | 1): boolean;
  focusSplit(delta: -1 | 1): boolean;
  toggleSplitPreview(): boolean;
  closeSplitDrawer(): boolean;
  closePopoverSplit(): boolean;
}
```

The callbacks operate on URL codec state, browser history, focused/spotlight
split component state, preview/drawer state, and the task popover. Missing
callbacks remain unregistered, so other hosts cannot acquire a capturing no-op.
Real Workshop binding and visual parity remain explicit blockers.
