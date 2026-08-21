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
| `command-menu-only` | 47 | 44 unkeyed commands execute from the palette; 3 `scope.*` rows are structural scope registrations and intentionally have no handler. |
| `downstream-gated` | 42 | 33 keyed and 9 unkeyed rows are disabled and unregistered until the named domain supplies the required authority/state. |
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
- Command-menu-only by ledger: account/logout/MCP/theme leaders and static theme
  choices plus the three structural leader scopes.
- Downstream-gated: non-task creation and launcher actions (N7/N9/N10/N11);
  dynamic user themes; instructions (N7); uploads (N14); mutation undo/redo;
  favorites (N17); invites (N1); block sharing (N2).
- Owner-gated: the LOCAL_ONLY hotkey debugger. OD-23's other quirks are not
  reproduced as inert behavior.

Settings expose nine commandable routes. The three connected surfaces
(Connections, MCP, Bots) keep their N10 content; the remaining six routes
identify their downstream boundary instead of silently routing every digit to
the same three-tab surface.

## Accessibility

The command palette is an `aria-modal` labelled dialog. Opening it stores the
opener and focuses search; closing restores the opener. Focus wraps inside the
dialog. Search exposes the result list and active option. Registry-backed
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
