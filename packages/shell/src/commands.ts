import { N5_COMMAND_IDS, type N5CommandId } from "./n5-command-ids.js";

export type { N5CommandId };
export { N5_COMMAND_IDS };

export interface ChromeCommandContext {
  signedIn: boolean;
  touch: boolean;
  createMenuOpen: boolean;
  commandMenuOpen: boolean;
  settingsOpen: boolean;
  settingsTabCount: number;
  splitCount: number;
  canAppendSplit: boolean;
  snippetsEnabled: boolean;
  gettingStartedEnabled: boolean;
  leader: "g" | "o" | "c" | null;
  sidebarMounted: boolean;
  fullCoverRoute: boolean;
  favoriteExists: boolean;
  previewOpen: boolean;
  drawerOpen: boolean;
}

function settingsTab(id: N5CommandId): number | null {
  const match = /^settings\.tab-(\d)$/.exec(id);
  return match ? Number(match[1]) : null;
}

/**
 * Chrome enablement freeze. Domain commands (soup, block-entity, …) stay with their nodes.
 * Dev-only hotkey debugger is killed. create-menu.task is the N6 `c`+`t` identity.
 */
export function commandEnabled(id: N5CommandId, ctx: ChromeCommandContext): boolean {
  if (ctx.touch) return false;
  if (id === "global.hotkey-debugger") return false;
  if (id === "scope.favorites") return ctx.favoriteExists;
  if (id === "global.favorites") return ctx.signedIn;

  const tab = settingsTab(id);
  if (tab !== null) return ctx.settingsOpen && ctx.settingsTabCount >= tab;
  if (id === "settings.close") return ctx.settingsOpen;
  if (id === "settings.next-tab" || id === "settings.prev-tab") {
    return ctx.settingsOpen && ctx.settingsTabCount > 1;
  }

  if (id === "create-menu.snippet" || id === "launcher.snippet" || id === "launcher.snippet-new-split") {
    return ctx.signedIn && ctx.snippetsEnabled && (id.startsWith("launcher.") ? ctx.createMenuOpen : ctx.createMenuOpen || ctx.leader === "c");
  }
  if (id === "go-to.getting-started") return ctx.signedIn && ctx.gettingStartedEnabled;
  if (id === "global.toggle-sidebar") return ctx.sidebarMounted && !ctx.fullCoverRoute;
  if (id === "global.new-split.cmd" || id === "global.new-split.bare") return ctx.signedIn && ctx.canAppendSplit;
  if (id === "split.toggle-preview") return ctx.splitCount > 0 && ctx.previewOpen;
  if (id === "split.close-drawer") return ctx.drawerOpen;
  if (id === "popover-split.close") return ctx.splitCount > 0;
  if (id.startsWith("split.")) return ctx.splitCount > 0;
  if (id.startsWith("launcher.")) return ctx.createMenuOpen;
  if (id.startsWith("create-menu.")) return ctx.createMenuOpen || ctx.leader === "c";
  if (id.startsWith("command-menu.open-category.")) return ctx.signedIn;
  if (id.startsWith("command-menu.")) return ctx.commandMenuOpen;
  if (id.startsWith("go-to.")) return ctx.signedIn;
  if (id.startsWith("theme.")) return ctx.signedIn;
  if (id === "home.focus-chat-input") return ctx.signedIn;
  if (id === "block.share") return ctx.signedIn;
  if (id.startsWith("scope.")) return ctx.signedIn;
  return ctx.signedIn;
}

export function defaultChromeContext(overrides: Partial<ChromeCommandContext> = {}): ChromeCommandContext {
  return {
    signedIn: true,
    touch: false,
    createMenuOpen: false,
    commandMenuOpen: false,
    settingsOpen: false,
    settingsTabCount: 12,
    splitCount: 1,
    canAppendSplit: true,
    snippetsEnabled: true,
    gettingStartedEnabled: true,
    leader: null,
    sidebarMounted: true,
    fullCoverRoute: false,
    favoriteExists: true,
    previewOpen: true,
    drawerOpen: false,
    ...overrides,
  };
}
