/** Generated from 03-command-hotkey-ledger.csv — do not edit by hand. */
import type { N5CommandId } from "./n5-command-ids.js";
import type { RegistrationType, ScopeId } from "./registry.js";

export interface N5LedgerBinding {
  id: N5CommandId;
  scope: ScopeId;
  chord: string;
  runWithInputFocused: boolean;
  registrationType: RegistrationType;
}

/** Ledger rows with at least one keyboard chord. */
export const N5_KEYED_BINDINGS = [
  {
    "id": "global.create",
    "scope": "global",
    "chord": "c",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "create-menu.email",
    "scope": "command-scope-create-menu",
    "chord": "e",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.chat",
    "scope": "command-scope-create-menu",
    "chord": "a",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.automation",
    "scope": "command-scope-create-menu",
    "chord": "u",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.skill",
    "scope": "command-scope-create-menu",
    "chord": "k",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.md",
    "scope": "command-scope-create-menu",
    "chord": "d",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.task",
    "scope": "command-scope-create-menu",
    "chord": "t",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.snippet",
    "scope": "command-scope-create-menu",
    "chord": "s",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.channel-message",
    "scope": "command-scope-create-menu",
    "chord": "m",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.channel",
    "scope": "command-scope-create-menu",
    "chord": "g",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.canvas",
    "scope": "command-scope-create-menu",
    "chord": "n",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.project",
    "scope": "command-scope-create-menu",
    "chord": "f",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.code",
    "scope": "command-scope-create-menu",
    "chord": "o",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.close",
    "scope": "command-scope-create-menu",
    "chord": "c",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "create-menu.close",
    "scope": "command-scope-create-menu",
    "chord": "escape",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "global.command-menu",
    "scope": "global",
    "chord": "cmd+k",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "global.open-category-leader",
    "scope": "global",
    "chord": "o",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "command-menu.open-category.all",
    "scope": "command-scope-command-menu-category",
    "chord": "l",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.open-category.commands",
    "scope": "command-scope-command-menu-category",
    "chord": "m",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.open-category.chats",
    "scope": "command-scope-command-menu-category",
    "chord": "a",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.open-category.documents",
    "scope": "command-scope-command-menu-category",
    "chord": "f",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.open-category.tasks",
    "scope": "command-scope-command-menu-category",
    "chord": "t",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.open-category.channels",
    "scope": "command-scope-command-menu-category",
    "chord": "c",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.open-category.dms",
    "scope": "command-scope-command-menu-category",
    "chord": "p",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "global.new-split.cmd",
    "scope": "global",
    "chord": "cmd+\\",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "global.new-split.bare",
    "scope": "global",
    "chord": "\\",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "global.toggle-settings",
    "scope": "global",
    "chord": "cmd+;",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "global.undo",
    "scope": "global",
    "chord": "cmd+z",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "global.redo",
    "scope": "global",
    "chord": "shift+cmd+z",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.email",
    "scope": "launcher",
    "chord": "e",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.email-new-split",
    "scope": "launcher",
    "chord": "shift+e",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.chat",
    "scope": "launcher",
    "chord": "a",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.chat-new-split",
    "scope": "launcher",
    "chord": "shift+a",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.automation",
    "scope": "launcher",
    "chord": "u",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.skill",
    "scope": "launcher",
    "chord": "k",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.md",
    "scope": "launcher",
    "chord": "d",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.md-new-split",
    "scope": "launcher",
    "chord": "shift+d",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.task",
    "scope": "launcher",
    "chord": "t",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.task-new-split",
    "scope": "launcher",
    "chord": "shift+t",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.snippet",
    "scope": "launcher",
    "chord": "s",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.snippet-new-split",
    "scope": "launcher",
    "chord": "shift+s",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.channel-message",
    "scope": "launcher",
    "chord": "m",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.channel-new-split-message",
    "scope": "launcher",
    "chord": "shift+m",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.channel",
    "scope": "launcher",
    "chord": "g",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.canvas",
    "scope": "launcher",
    "chord": "n",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.canvas-new-split",
    "scope": "launcher",
    "chord": "shift+n",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.project",
    "scope": "launcher",
    "chord": "f",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.project-new-split",
    "scope": "launcher",
    "chord": "shift+f",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.code",
    "scope": "launcher",
    "chord": "o",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.code-new-split",
    "scope": "launcher",
    "chord": "shift+o",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.close-c",
    "scope": "launcher",
    "chord": "c",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.nav-up",
    "scope": "launcher",
    "chord": "arrowup",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "launcher.nav-up",
    "scope": "launcher",
    "chord": "ctrl+k",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "launcher.nav-up",
    "scope": "launcher",
    "chord": "shift+tab",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "launcher.nav-down",
    "scope": "launcher",
    "chord": "arrowdown",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "launcher.nav-down",
    "scope": "launcher",
    "chord": "ctrl+j",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "launcher.nav-down",
    "scope": "launcher",
    "chord": "tab",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "launcher.exit",
    "scope": "launcher",
    "chord": "escape",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "launcher.open-new-split",
    "scope": "launcher",
    "chord": "shift+enter",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "launcher.confirm",
    "scope": "launcher",
    "chord": "enter",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.nav-down",
    "scope": "command-menu",
    "chord": "arrowdown",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.nav-down",
    "scope": "command-menu",
    "chord": "ctrl+j",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.nav-up",
    "scope": "command-menu",
    "chord": "arrowup",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.nav-up",
    "scope": "command-menu",
    "chord": "ctrl+k",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.confirm",
    "scope": "command-menu",
    "chord": "enter",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.confirm-new-split",
    "scope": "command-menu",
    "chord": "shift+enter",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.escape",
    "scope": "command-menu",
    "chord": "escape",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.backspace-back",
    "scope": "command-menu",
    "chord": "backspace",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.next-category",
    "scope": "command-menu",
    "chord": "tab",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "command-menu.prev-category",
    "scope": "command-menu",
    "chord": "shift+tab",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "global.toggle-sidebar",
    "scope": "global",
    "chord": "cmd+.",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "global.go-to-leader",
    "scope": "global",
    "chord": "g",
    "runWithInputFocused": false,
    "registrationType": "add"
  },
  {
    "id": "go-to.home",
    "scope": "command-scope-go-to",
    "chord": "h",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.getting-started",
    "scope": "command-scope-go-to",
    "chord": "s",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.inbox",
    "scope": "command-scope-go-to",
    "chord": "i",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.activity",
    "scope": "command-scope-go-to",
    "chord": "y",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.reminders",
    "scope": "command-scope-go-to",
    "chord": "m",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.search",
    "scope": "global",
    "chord": "/",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.agents",
    "scope": "command-scope-go-to",
    "chord": "a",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.mail",
    "scope": "command-scope-go-to",
    "chord": "e",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.documents",
    "scope": "command-scope-go-to",
    "chord": "f",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.markdown-documents",
    "scope": "command-scope-go-to",
    "chord": "d",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.tasks",
    "scope": "command-scope-go-to",
    "chord": "t",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.calendar",
    "scope": "command-scope-go-to",
    "chord": "r",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.channels",
    "scope": "command-scope-go-to",
    "chord": "c",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.calls",
    "scope": "command-scope-go-to",
    "chord": "l",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "go-to.companies",
    "scope": "command-scope-go-to",
    "chord": "o",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "split.close-or-home",
    "scope": "split",
    "chord": "cmd+escape",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "split.close-or-home",
    "scope": "split",
    "chord": "opt+escape",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "split.spotlight",
    "scope": "split",
    "chord": "shift+escape",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "split.back",
    "scope": "split",
    "chord": "opt+[",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "split.forward",
    "scope": "split",
    "chord": "opt+]",
    "runWithInputFocused": true,
    "registrationType": "override"
  },
  {
    "id": "split.focus-right",
    "scope": "split",
    "chord": "shift+l",
    "runWithInputFocused": false,
    "registrationType": "add"
  },
  {
    "id": "split.focus-right",
    "scope": "split",
    "chord": "shift+arrowright",
    "runWithInputFocused": false,
    "registrationType": "add"
  },
  {
    "id": "split.focus-left",
    "scope": "split",
    "chord": "shift+h",
    "runWithInputFocused": false,
    "registrationType": "add"
  },
  {
    "id": "split.focus-left",
    "scope": "split",
    "chord": "shift+arrowleft",
    "runWithInputFocused": false,
    "registrationType": "add"
  },
  {
    "id": "popover-split.close",
    "scope": "popover-split",
    "chord": "escape",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "split.toggle-preview",
    "scope": "split",
    "chord": "space",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "split.close-drawer",
    "scope": "split",
    "chord": "escape",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "home.focus-chat-input",
    "scope": "split",
    "chord": "enter",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.close",
    "scope": "settings",
    "chord": "escape",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.next-tab",
    "scope": "settings",
    "chord": "tab",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.prev-tab",
    "scope": "settings",
    "chord": "shift+tab",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.tab-1",
    "scope": "settings",
    "chord": "1",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.tab-2",
    "scope": "settings",
    "chord": "2",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.tab-3",
    "scope": "settings",
    "chord": "3",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.tab-4",
    "scope": "settings",
    "chord": "4",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.tab-5",
    "scope": "settings",
    "chord": "5",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.tab-6",
    "scope": "settings",
    "chord": "6",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.tab-7",
    "scope": "settings",
    "chord": "7",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.tab-8",
    "scope": "settings",
    "chord": "8",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "settings.tab-9",
    "scope": "settings",
    "chord": "9",
    "runWithInputFocused": false,
    "registrationType": "override"
  },
  {
    "id": "block.share",
    "scope": "block",
    "chord": "cmd+s",
    "runWithInputFocused": true,
    "registrationType": "override"
  }
] as const satisfies readonly N5LedgerBinding[];

/** Command-menu-only / scope-registration rows (no chord). */
export const N5_UNKEYED_IDS = [
  "global.account",
  "global.logout",
  "global.instructions",
  "global.mcp-setup",
  "global.change-theme",
  "theme.system-preference",
  "theme.set-visible.outreach-dark",
  "theme.set-visible.void",
  "theme.set-visible.ember",
  "theme.set-visible.spirit",
  "theme.set-visible.moon",
  "theme.set-visible.rain",
  "theme.set-visible.outreach-light",
  "theme.set-visible.satsuma",
  "theme.set-visible.lapis",
  "theme.set-visible.flora",
  "theme.set-visible.paper",
  "theme.set-visible.decepticon",
  "theme.set-visible.<user-theme>",
  "global.set-default-light-theme",
  "theme.default-light.outreach-dark",
  "theme.default-light.void",
  "theme.default-light.ember",
  "theme.default-light.spirit",
  "theme.default-light.moon",
  "theme.default-light.rain",
  "theme.default-light.outreach-light",
  "theme.default-light.satsuma",
  "theme.default-light.lapis",
  "theme.default-light.flora",
  "theme.default-light.paper",
  "theme.default-light.decepticon",
  "theme.default-light.<user-theme>",
  "global.set-default-dark-theme",
  "theme.default-dark.outreach-dark",
  "theme.default-dark.void",
  "theme.default-dark.ember",
  "theme.default-dark.spirit",
  "theme.default-dark.moon",
  "theme.default-dark.rain",
  "theme.default-dark.outreach-light",
  "theme.default-dark.satsuma",
  "theme.default-dark.lapis",
  "theme.default-dark.flora",
  "theme.default-dark.paper",
  "theme.default-dark.decepticon",
  "theme.default-dark.<user-theme>",
  "global.auto-detect-color-scheme",
  "global.upload-files",
  "global.hotkey-debugger",
  "global.upload-folders",
  "scope.favorites",
  "global.favorites",
  "global.invite-team",
  "scope.command-scope-go-to",
  "scope.command-scope-command-menu-category",
  "scope.command-scope-create-menu"
] as const satisfies readonly N5CommandId[];
