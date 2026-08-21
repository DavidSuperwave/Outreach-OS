import type { N5CommandId } from "./n5-command-ids.js";
import { commandHasRuntime, N5_COMMAND_COVERAGE_BY_ID } from "./n5-command-coverage.js";
import { N5_KEYED_BINDINGS } from "./n5-ledger.js";
import { commandEnabled, defaultChromeContext, type ChromeCommandContext } from "./commands.js";
import { appendInboxSplitPath, closeFocusedSplitPath } from "./path-panes.js";
import type { CommandRegistry, LeaderKey, ScopeId } from "./registry.js";
import { SETTINGS_TABS, settingsTabPath as settingsPathForTab } from "./settings.js";
import { STORAGE_KEYS, THEME_IDS, THEME_LABELS, type ThemeId } from "./theme.js";

const LEADER_IDS = new Set(["global.create", "global.go-to-leader", "global.open-category-leader"]);

const CHROME_LEADERS: readonly { id: N5CommandId; leader: LeaderKey; chord: LeaderKey }[] = [
  { id: "global.create", leader: "c", chord: "c" },
  { id: "global.go-to-leader", leader: "g", chord: "g" },
  { id: "global.open-category-leader", leader: "o", chord: "o" },
];

/** Ledger go-to identities → 27-route map paths. */
export const GO_TO_PATH: Record<string, string> = {
  "go-to.home": "/",
  "go-to.getting-started": "/getting-started",
  "go-to.inbox": "/inbox",
  "go-to.activity": "/activity",
  "go-to.reminders": "/reminders",
  "go-to.search": "/search",
  "go-to.agents": "/agents",
  "go-to.mail": "/mail",
  "go-to.documents": "/documents",
  "go-to.markdown-documents": "/markdown-documents",
  "go-to.tasks": "/tasks",
  "go-to.calendar": "/calendar",
  "go-to.channels": "/channels",
  "go-to.calls": "/calls",
  "go-to.companies": "/companies",
};

/** Primary sidebar rows. Search and markdown-documents stay hiddenFromSidebar (ledger). */
export const SIDEBAR_NAV: readonly { id: keyof typeof GO_TO_PATH; href: string; label: string; hint: string }[] = [
  { id: "go-to.home", href: "/", label: "Home", hint: "h" },
  { id: "go-to.inbox", href: "/inbox", label: "Inbox", hint: "i" },
  { id: "go-to.tasks", href: "/tasks", label: "Tasks", hint: "t" },
  { id: "go-to.documents", href: "/documents", label: "Files", hint: "f" },
  { id: "go-to.mail", href: "/mail", label: "Email", hint: "e" },
  { id: "go-to.channels", href: "/channels", label: "Channels", hint: "c" },
  { id: "go-to.calendar", href: "/calendar", label: "Calendar", hint: "r" },
  { id: "go-to.calls", href: "/calls", label: "Calls", hint: "l" },
  { id: "go-to.companies", href: "/companies", label: "Customers", hint: "o" },
  { id: "go-to.activity", href: "/activity", label: "Activity", hint: "y" },
  { id: "go-to.agents", href: "/agents", label: "Agents", hint: "a" },
  { id: "go-to.reminders", href: "/reminders", label: "Reminders", hint: "m" },
  { id: "go-to.getting-started", href: "/getting-started", label: "Getting started", hint: "s" },
];

const CREATE_OR_LAUNCH: Record<string, string> = {
  "create-menu.task": "/tasks",
  "launcher.task": "/tasks",
  "launcher.task-new-split": "/tasks",
};

export const CREATE_MENU_ITEMS: readonly { id: N5CommandId; label: string; chord: string; disabledReason?: string }[] = [
  { id: "create-menu.task", label: "Create task", chord: "t" },
  { id: "create-menu.md", label: "Create document", chord: "d" },
  { id: "create-menu.email", label: "Create email", chord: "e" },
  { id: "create-menu.chat", label: "Create agent", chord: "a" },
  { id: "create-menu.channel", label: "Create channel", chord: "g" },
  { id: "create-menu.channel-message", label: "Create message", chord: "m" },
  { id: "create-menu.project", label: "Create folder", chord: "f" },
  { id: "create-menu.canvas", label: "Create canvas", chord: "n" },
  { id: "create-menu.code", label: "Create code", chord: "o" },
  { id: "create-menu.automation", label: "Create automation", chord: "u" },
  { id: "create-menu.skill", label: "Create skill", chord: "k" },
  { id: "create-menu.snippet", label: "Create snippet", chord: "s" },
].map((item) => {
  const coverage = N5_COMMAND_COVERAGE_BY_ID.get(item.id)!;
  return coverage.disposition === "downstream-gated"
    ? { ...item, disabledReason: coverage.reason }
    : item;
});

export const COMMAND_MENU_ITEMS: readonly { id: N5CommandId; label: string }[] = [
  { id: "go-to.home", label: "Home" },
  { id: "go-to.tasks", label: "Tasks" },
  { id: "go-to.inbox", label: "Inbox" },
  { id: "go-to.mail", label: "Mail" },
  { id: "go-to.documents", label: "Files" },
  { id: "go-to.markdown-documents", label: "Documents" },
  { id: "go-to.search", label: "Search" },
  { id: "go-to.activity", label: "Activity" },
  { id: "go-to.channels", label: "Channels" },
  { id: "go-to.calendar", label: "Calendar" },
  { id: "go-to.calls", label: "Calls" },
  { id: "go-to.companies", label: "Customers" },
  { id: "go-to.agents", label: "Agents" },
  { id: "go-to.reminders", label: "Reminders" },
  { id: "create-menu.task", label: "Create task" },
  { id: "global.toggle-settings", label: "Settings" },
  { id: "global.mcp-setup", label: "MCP setup" },
  { id: "global.account", label: "Account" },
  { id: "global.change-theme", label: "Change theme" },
  { id: "global.set-default-light-theme", label: "Set default light theme" },
  { id: "global.set-default-dark-theme", label: "Set default dark theme" },
  { id: "global.logout", label: "Log out" },
];

export const COMMAND_MENU_CATEGORIES = [
  { id: "all", label: "All", command: "command-menu.open-category.all", hint: "l" },
  { id: "commands", label: "Command", command: "command-menu.open-category.commands", hint: "m" },
  { id: "chats", label: "Agents", command: "command-menu.open-category.chats", hint: "a" },
  { id: "documents", label: "Files", command: "command-menu.open-category.documents", hint: "f" },
  { id: "tasks", label: "Tasks", command: "command-menu.open-category.tasks", hint: "t" },
  { id: "channels", label: "Channels", command: "command-menu.open-category.channels", hint: "c" },
  { id: "dms", label: "People", command: "command-menu.open-category.dms", hint: "p" },
] as const;

/** Ledger: go-to overlay auto-reset after 2s. Same timer hides the `o` category overlay. */
export const LEADER_HINT_RESET_MS = 2000;

export type CommandMenuCategory = (typeof COMMAND_MENU_CATEGORIES)[number]["id"];

export function nextCommandMenuCategory(current: CommandMenuCategory, delta: number): CommandMenuCategory {
  const ids = COMMAND_MENU_CATEGORIES.map((row) => row.id);
  const index = Math.max(0, ids.indexOf(current));
  return ids[(index + delta + ids.length) % ids.length]!;
}

export type CommandMenuScope = "root" | "change-theme" | "default-light" | "default-dark";

const LEADER_CHORDS = new Set(["g", "o", "c"]);

/**
 * Soup rows use inputs/selects for properties. That is split focus, not the
 * ledger input-focus gate — otherwise `g`/`o`/`c` never arm on `/tasks`.
 * Compose, command search, and create-menu fields stay gated.
 */
export function chromeInputFocused(formControl: boolean, soupCell: boolean, chord: string): boolean {
  if (!formControl) return false;
  if (soupCell && LEADER_CHORDS.has(chord)) return false;
  return true;
}

export const COMMAND_MENU_NESTED_LEADERS: Record<string, CommandMenuScope> = {
  "global.change-theme": "change-theme",
  "global.set-default-light-theme": "default-light",
  "global.set-default-dark-theme": "default-dark",
};

const COMMAND_MENU_SCOPE_LABEL: Record<CommandMenuScope, string> = {
  root: "Command menu",
  "change-theme": "Change theme",
  "default-light": "Default light theme",
  "default-dark": "Default dark theme",
};

export function commandMenuScopeLabel(scope: CommandMenuScope): string {
  return COMMAND_MENU_SCOPE_LABEL[scope];
}

function themePrefix(scope: Exclude<CommandMenuScope, "root">): "theme.set-visible." | "theme.default-light." | "theme.default-dark." {
  if (scope === "change-theme") return "theme.set-visible.";
  if (scope === "default-light") return "theme.default-light.";
  return "theme.default-dark.";
}

export function commandMenuItemsForScope(scope: CommandMenuScope = "root"): readonly { id: N5CommandId; label: string }[] {
  if (scope === "root") return COMMAND_MENU_ITEMS;
  const prefix = themePrefix(scope);
  const themes = THEME_IDS.map((id) => ({ id: `${prefix}${id}` as N5CommandId, label: THEME_LABELS[id] }));
  if (scope === "change-theme") {
    return [{ id: "theme.system-preference", label: "System preference" }, ...themes];
  }
  return themes;
}

export function commandMenuCategoryFromId(id: string): CommandMenuCategory | null {
  const match = /^command-menu\.open-category\.(.+)$/.exec(id);
  if (!match) return null;
  return COMMAND_MENU_CATEGORIES.some((row) => row.id === match[1]) ? (match[1] as CommandMenuCategory) : null;
}

export function commandMenuItemCategory(id: string): CommandMenuCategory {
  if (id === "go-to.tasks" || id === "create-menu.task") return "tasks";
  if (id === "go-to.documents" || id === "go-to.markdown-documents") return "documents";
  if (id === "go-to.channels") return "channels";
  if (id === "go-to.agents") return "chats";
  if (id === "go-to.companies") return "dms";
  if (id.startsWith("theme.") || id.startsWith("global.")) return "commands";
  return "all";
}

export function filterCommandMenuItems(
  query = "",
  category: CommandMenuCategory = "all",
  scope: CommandMenuScope = "root",
): readonly { id: N5CommandId; label: string }[] {
  const needle = query.trim().toLowerCase();
  return commandMenuItemsForScope(scope).filter((item) => {
    if (scope === "root") {
      const cat = commandMenuItemCategory(item.id);
      if (category !== "all" && cat !== category) return false;
    }
    if (!needle) return true;
    return item.label.toLowerCase().includes(needle) || item.id.toLowerCase().includes(needle);
  });
}

export function chromeActiveScope(
  path: string,
  flags: { commandMenuOpen?: boolean; createMenuOpen?: boolean; createMenuViaLeader?: boolean } = {},
): ScopeId {
  if (flags.commandMenuOpen) return "command-menu";
  // Visual launcher stays on create-menu scope so `c` then `t` is create-menu.task,
  // not detached launcher.task (ledger L8). Mouse Create also activateLeader("c").
  if (flags.createMenuOpen) return flags.createMenuViaLeader ? "command-scope-create-menu" : "launcher";
  if (path === "/settings" || path === "/mcp" || path.startsWith("/settings")) return "settings";
  return "split";
}

export function settingsTabPath(id: string): string | null {
  const match = /^settings\.tab-(\d)$/.exec(id);
  if (!match) return null;
  const tab = Number(match[1]);
  return settingsPathForTab(SETTINGS_TABS[tab - 1]!);
}

export function themeIdFromCommand(id: string): ThemeId | null {
  const visible = /^theme\.set-visible\.(.+)$/.exec(id);
  const light = /^theme\.default-light\.(.+)$/.exec(id);
  const dark = /^theme\.default-dark\.(.+)$/.exec(id);
  const name = visible?.[1] ?? light?.[1] ?? dark?.[1];
  if (!name || name === "<user-theme>") return null;
  return (THEME_IDS as readonly string[]).includes(name) ? (name as ThemeId) : null;
}

/** Path the chrome handler would assign, or null when the row is in-place / no-op. */
export function chromeNavigatePath(id: string, path = "/"): string | null {
  if (GO_TO_PATH[id]) return GO_TO_PATH[id];
  if (CREATE_OR_LAUNCH[id]) return CREATE_OR_LAUNCH[id];
  if (id === "global.toggle-settings") return path === "/settings" || path.startsWith("/settings") ? "/" : "/settings";
  if (id === "global.account" || id === "global.instructions") return "/settings";
  if (id === "global.mcp-setup") return "/mcp";
  if (id === "global.logout") return "/login";
  if (id === "settings.close") return "/";
  if (id === "split.close-or-home") return closeFocusedSplitPath(path);
  if (id === "global.new-split.cmd" || id === "global.new-split.bare") return appendInboxSplitPath(path);
  const tab = settingsTabPath(id);
  if (tab) return tab;
  if (id === "settings.next-tab" || id === "settings.prev-tab") {
    const current = SETTINGS_TABS.findIndex((tab) => settingsPathForTab(tab) === path);
    const safeCurrent = current < 0 ? 0 : current;
    const next = id === "settings.next-tab" ? (safeCurrent + 1) % SETTINGS_TABS.length : (safeCurrent + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length;
    return settingsTabPath(`settings.tab-${next + 1}`);
  }
  return null;
}

export interface ChromeHotkeyHandle {
  (id: string): boolean;
}

export function defaultChromeHotkeyHandle(
  navigate: (path: string) => void,
  extras: {
    toggleCommandMenu?: () => boolean;
    toggleCreateMenu?: () => boolean;
    openTaskCompose?: () => boolean;
    openCommandCategory?: (id: string) => boolean;
    cycleCommandCategory?: (delta: number) => boolean;
    moveCommandSelection?: (delta: number) => boolean;
    confirmCommandSelection?: (preferNewSplit?: boolean) => boolean;
    closeMenus?: () => boolean;
    openCommandScope?: (id: string) => boolean;
    backCommandScope?: () => boolean;
    commandQueryEmpty?: () => boolean;
    applyTheme?: (theme: ThemeId, kind?: "visible" | "light" | "dark") => boolean;
    logout?: () => boolean;
    toggleSidebar?: () => boolean;
    focusHomeChat?: () => boolean;
    toggleAutoColorScheme?: () => boolean;
    closeSplit?: () => boolean;
    toggleSplitSpotlight?: () => boolean;
    splitHistory?: (delta: -1 | 1) => boolean;
    focusSplit?: (delta: -1 | 1) => boolean;
    toggleSplitPreview?: () => boolean;
    closeSplitDrawer?: () => boolean;
    closePopoverSplit?: () => boolean;
    currentPath?: string | (() => string);
    enabled?: ChromeCommandContext | (() => ChromeCommandContext);
  } = {},
): ChromeHotkeyHandle {
  return (id) => {
    const ctx = typeof extras.enabled === "function" ? extras.enabled() : (extras.enabled ?? defaultChromeContext());
    const current =
      typeof extras.currentPath === "function" ? extras.currentPath() : (extras.currentPath ?? "/");
    if (!commandHasRuntime(id as N5CommandId)) return false;
    if (!commandEnabled(id as N5CommandId, ctx) && id !== "global.command-menu") return false;
    if (id === "global.create") return extras.toggleCreateMenu?.() ?? false;
    if (id === "home.focus-chat-input") return extras.focusHomeChat?.() ?? false;
    if (id === "create-menu.task" || id === "launcher.task" || id === "launcher.task-new-split") {
      return extras.openTaskCompose?.() ?? (navigate("/tasks"), extras.closeMenus?.(), true);
    }
    if (id === "global.command-menu") return extras.toggleCommandMenu?.() ?? false;
    if (COMMAND_MENU_NESTED_LEADERS[id]) return extras.openCommandScope?.(id) ?? false;
    if (id === "command-menu.backspace-back") {
      if (extras.commandQueryEmpty && !extras.commandQueryEmpty()) return false;
      return extras.backCommandScope?.() ?? false;
    }
    if (
      id === "create-menu.close" ||
      id === "launcher.close-c" ||
      id === "launcher.exit" ||
      id === "command-menu.escape" ||
      id === "popover-split.close"
    ) {
      if (id === "command-menu.escape" && extras.backCommandScope?.()) return true;
      if (id === "popover-split.close") return extras.closePopoverSplit?.() ?? false;
      return extras.closeMenus?.() ?? false;
    }
    if (id === "global.logout") return extras.logout?.() ?? (navigate("/login"), true);
    if (id === "global.toggle-sidebar") return extras.toggleSidebar?.() ?? false;
    if (id === "global.auto-detect-color-scheme") return extras.toggleAutoColorScheme?.() ?? false;
    if (id === "split.spotlight") return extras.toggleSplitSpotlight?.() ?? false;
    if (id === "split.back") return extras.splitHistory?.(-1) ?? false;
    if (id === "split.forward") return extras.splitHistory?.(1) ?? false;
    if (id === "split.focus-right") return extras.focusSplit?.(1) ?? false;
    if (id === "split.focus-left") return extras.focusSplit?.(-1) ?? false;
    if (id === "split.toggle-preview") return extras.toggleSplitPreview?.() ?? false;
    if (id === "split.close-drawer") return extras.closeSplitDrawer?.() ?? false;
    if (id === "split.close-or-home" && extras.closeSplit) return extras.closeSplit();
    if (id === "theme.system-preference") {
      const dark =
        typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)").matches : true;
      if (!extras.applyTheme) return false;
      extras.applyTheme(dark ? "outreach-dark" : "outreach-light", "visible");
      extras.closeMenus?.();
      return true;
    }
    if (id.startsWith("theme.set-visible.")) {
      const theme = themeIdFromCommand(id);
      if (!theme) return false;
      if (!extras.applyTheme) return false;
      extras.applyTheme(theme, "visible");
      extras.closeMenus?.();
      return true;
    }
    if (id.startsWith("theme.default-light.")) {
      const theme = themeIdFromCommand(id);
      if (!theme) return false;
      if (!extras.applyTheme) return false;
      extras.applyTheme(theme, "light");
      extras.closeMenus?.();
      return true;
    }
    if (id.startsWith("theme.default-dark.")) {
      const theme = themeIdFromCommand(id);
      if (!theme) return false;
      if (!extras.applyTheme) return false;
      extras.applyTheme(theme, "dark");
      extras.closeMenus?.();
      return true;
    }
    if (id.startsWith("command-menu.open-category.")) {
      return extras.openCommandCategory?.(id) ?? false;
    }
    if (id === "command-menu.next-category") return extras.cycleCommandCategory?.(1) ?? false;
    if (id === "command-menu.prev-category") return extras.cycleCommandCategory?.(-1) ?? false;
    if (id === "command-menu.nav-down" || id === "launcher.nav-down") {
      return extras.moveCommandSelection?.(1) ?? false;
    }
    if (id === "command-menu.nav-up" || id === "launcher.nav-up") {
      return extras.moveCommandSelection?.(-1) ?? false;
    }
    if (
      id === "command-menu.confirm" ||
      id === "command-menu.confirm-new-split" ||
      id === "launcher.confirm" ||
      id === "launcher.open-new-split"
    ) {
      return extras.confirmCommandSelection?.(
        id === "command-menu.confirm-new-split" || id === "launcher.open-new-split",
      ) ?? false;
    }
    const path = chromeNavigatePath(id, current);
    if (path) {
      navigate(path);
      extras.closeMenus?.();
      return true;
    }
    return false;
  };
}

/**
 * Register every keyed N5 chrome row. Slice hotkeys must register after this
 * so N6 identities (`create-menu.task`, soup tabs, `e` mark-done) win.
 */
export function registerChromeHotkeys(registry: CommandRegistry, handle: ChromeHotkeyHandle): void {
  for (const row of CHROME_LEADERS) {
    registry.register({
      id: row.id,
      scope: "global",
      chord: row.chord,
      priority: 0,
      registrationType: "override",
      runWithInputFocused: false,
      handle: () => {
        registry.activateLeader(row.leader);
        handle(row.id);
        return true;
      },
    });
  }
  for (const row of N5_KEYED_BINDINGS) {
    if (LEADER_IDS.has(row.id)) continue;
    if (!commandHasRuntime(row.id)) continue;
    registry.register({
      id: row.id,
      scope: row.scope,
      chord: row.chord,
      priority: 0,
      registrationType: row.registrationType,
      runWithInputFocused: row.runWithInputFocused,
      handle: () => handle(row.id),
    });
  }
  registry.register({
    id: "global.command-menu",
    scope: "command-menu",
    chord: "cmd+k",
    priority: 10,
    registrationType: "override",
    runWithInputFocused: true,
    handle: () => handle("global.command-menu"),
  });
  registry.register({
    id: "command-menu.escape",
    scope: "command-menu",
    chord: "escape",
    priority: 10,
    registrationType: "add",
    runWithInputFocused: true,
    handle: () => handle("command-menu.escape"),
  });
  registry.register({
    id: "command-menu.next-category",
    scope: "command-menu",
    chord: "tab",
    priority: 10,
    registrationType: "add",
    runWithInputFocused: true,
    handle: () => handle("command-menu.next-category"),
  });
  registry.register({
    id: "command-menu.prev-category",
    scope: "command-menu",
    chord: "shift+tab",
    priority: 10,
    registrationType: "add",
    runWithInputFocused: true,
    handle: () => handle("command-menu.prev-category"),
  });
}

export function persistTheme(theme: ThemeId, kind: "visible" | "light" | "dark" = "visible"): void {
  if (typeof localStorage === "undefined") return;
  if (kind === "light") localStorage.setItem(STORAGE_KEYS.defaultLight, theme);
  else if (kind === "dark") localStorage.setItem(STORAGE_KEYS.defaultDark, theme);
  else localStorage.setItem(STORAGE_KEYS.theme, theme);
}
