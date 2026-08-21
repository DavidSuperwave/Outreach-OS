import type { N5CommandId } from "./n5-command-ids.js";
import { N5_KEYED_BINDINGS } from "./n5-ledger.js";
import { commandEnabled, defaultChromeContext, type ChromeCommandContext } from "./commands.js";
import type { CommandRegistry, LeaderKey, ScopeId } from "./registry.js";
import { SETTINGS_TABS } from "./settings.js";
import { STORAGE_KEYS, THEME_IDS, type ThemeId } from "./theme.js";

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

const CREATE_OR_LAUNCH: Record<string, string> = {
  "create-menu.email": "/mail",
  "create-menu.chat": "/agents",
  "create-menu.automation": "/settings",
  "create-menu.skill": "/settings",
  "create-menu.md": "/documents",
  "create-menu.task": "/tasks",
  "create-menu.snippet": "/documents",
  "create-menu.channel-message": "/channels",
  "create-menu.channel": "/channels",
  "create-menu.canvas": "/documents",
  "create-menu.project": "/documents",
  "create-menu.code": "/documents",
  "launcher.email": "/mail",
  "launcher.email-new-split": "/mail",
  "launcher.chat": "/agents",
  "launcher.chat-new-split": "/agents",
  "launcher.automation": "/settings",
  "launcher.skill": "/settings",
  "launcher.md": "/documents",
  "launcher.md-new-split": "/documents",
  "launcher.task": "/tasks",
  "launcher.task-new-split": "/tasks",
  "launcher.snippet": "/documents",
  "launcher.snippet-new-split": "/documents",
  "launcher.channel-message": "/channels",
  "launcher.channel-new-split-message": "/channels",
  "launcher.channel": "/channels",
  "launcher.canvas": "/documents",
  "launcher.canvas-new-split": "/documents",
  "launcher.project": "/documents",
  "launcher.project-new-split": "/documents",
  "launcher.code": "/documents",
  "launcher.code-new-split": "/documents",
};

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
  { id: "global.logout", label: "Log out" },
  { id: "theme.set-visible.outreach-dark", label: "Outreach Dark" },
  { id: "theme.set-visible.outreach-light", label: "Outreach Light" },
];

export function chromeActiveScope(
  path: string,
  flags: { commandMenuOpen?: boolean; createMenuOpen?: boolean } = {},
): ScopeId {
  if (flags.commandMenuOpen || flags.createMenuOpen) return "detached";
  if (path === "/settings" || path === "/mcp" || path.startsWith("/settings")) return "detached";
  return "split";
}

export function settingsTabPath(id: string): string | null {
  const match = /^settings\.tab-(\d)$/.exec(id);
  if (!match) return null;
  const tab = Number(match[1]);
  if (tab === 1) return "/settings";
  if (tab === 2) return "/mcp";
  if (tab === 3) return "/settings?tab=bots";
  return "/settings";
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
  if (id === "global.account" || id === "global.instructions" || id === "global.change-theme") return "/settings";
  if (id === "global.mcp-setup") return "/mcp";
  if (id === "global.logout") return "/login";
  if (id === "settings.close" || id === "split.close-or-home") return "/";
  const tab = settingsTabPath(id);
  if (tab) return tab;
  if (id === "settings.next-tab" || id === "settings.prev-tab") {
    const current = path === "/mcp" ? 1 : path.includes("bots") ? 2 : 0;
    const next = id === "settings.next-tab" ? (current + 1) % SETTINGS_TABS.length : (current + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length;
    return settingsTabPath(`settings.tab-${next + 1}`);
  }
  if (id === "command-menu.open-category.tasks") return "/tasks";
  if (id === "command-menu.open-category.documents") return "/documents";
  if (id === "command-menu.open-category.channels") return "/channels";
  if (id === "command-menu.open-category.chats") return "/agents";
  if (id === "go-to.search") return "/search";
  return null;
}

export interface ChromeHotkeyHandle {
  (id: string): boolean;
}

const INERT = new Set<string>([
  "global.hotkey-debugger",
  "global.undo",
  "global.redo",
  "global.upload-files",
  "global.upload-folders",
  "split.toggle-preview",
  "split.close-drawer",
  "split.spotlight",
  "split.back",
  "split.forward",
  "split.focus-right",
  "split.focus-left",
  "popover-split.close",
  "block.share",
  "home.focus-chat-input",
  "global.new-split.cmd",
  "global.new-split.bare",
]);

export function defaultChromeHotkeyHandle(
  navigate: (path: string) => void,
  extras: {
    toggleCommandMenu?: () => boolean;
    closeMenus?: () => boolean;
    applyTheme?: (theme: ThemeId, kind?: "visible" | "light" | "dark") => boolean;
    logout?: () => boolean;
    toggleSidebar?: () => boolean;
    enabled?: ChromeCommandContext | (() => ChromeCommandContext);
  } = {},
): ChromeHotkeyHandle {
  return (id) => {
    const ctx = typeof extras.enabled === "function" ? extras.enabled() : (extras.enabled ?? defaultChromeContext());
    if (id === "global.hotkey-debugger") return false;
    if (!commandEnabled(id as N5CommandId, ctx) && id !== "global.command-menu") return false;
    if (id === "global.command-menu") return extras.toggleCommandMenu?.() ?? true;
    if (
      id === "create-menu.close" ||
      id === "launcher.close-c" ||
      id === "launcher.exit" ||
      id === "command-menu.escape" ||
      id === "popover-split.close"
    ) {
      return extras.closeMenus?.() ?? true;
    }
    if (id === "global.logout") return extras.logout?.() ?? (navigate("/login"), true);
    if (id === "global.toggle-sidebar") return extras.toggleSidebar?.() ?? true;
    if (id.startsWith("theme.set-visible.")) {
      const theme = themeIdFromCommand(id);
      return theme ? extras.applyTheme?.(theme, "visible") ?? true : false;
    }
    if (id.startsWith("theme.default-light.")) {
      const theme = themeIdFromCommand(id);
      return theme ? extras.applyTheme?.(theme, "light") ?? true : false;
    }
    if (id.startsWith("theme.default-dark.")) {
      const theme = themeIdFromCommand(id);
      return theme ? extras.applyTheme?.(theme, "dark") ?? true : false;
    }
    if (id === "command-menu.nav-down" || id === "command-menu.nav-up" || id === "launcher.nav-down" || id === "launcher.nav-up") {
      return extras.toggleCommandMenu ? true : false;
    }
    if (id === "command-menu.confirm" || id === "command-menu.confirm-new-split" || id === "launcher.confirm") {
      navigate("/tasks");
      extras.closeMenus?.();
      return true;
    }
    if (INERT.has(id)) return false;
    const path = chromeNavigatePath(id);
    if (path) {
      navigate(path);
      extras.closeMenus?.();
      return true;
    }
    return id.startsWith("command-menu.open-category.") || id.startsWith("scope.");
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
    scope: "detached",
    chord: "cmd+k",
    priority: 10,
    registrationType: "override",
    runWithInputFocused: true,
    handle: () => handle("global.command-menu"),
  });
}

export function persistTheme(theme: ThemeId, kind: "visible" | "light" | "dark" = "visible"): void {
  if (typeof localStorage === "undefined") return;
  if (kind === "light") localStorage.setItem(STORAGE_KEYS.defaultLight, theme);
  else if (kind === "dark") localStorage.setItem(STORAGE_KEYS.defaultDark, theme);
  else localStorage.setItem(STORAGE_KEYS.theme, theme);
}
