import { PATH_ROUTES } from "./routes.js";
import { decodeSplits, encodeSplits, SplitManager, type SplitPane, type SplitType } from "./splits.js";

/** Product URLs (27-route map) → a single always-split. Split-codec URLs decode as-is. */
export const PATH_SPLIT: Record<(typeof PATH_ROUTES)[number], SplitType | null> = {
  "/": "home",
  "/login": "home",
  "/signup": "home",
  "/invite": "home",
  "/join": "home",
  "/settings": "settings",
  "/onboarding": "home",
  "/getting-started": "home",
  "/inbox": "inbox",
  "/activity": "home",
  "/reminders": "reminder",
  "/search": "search",
  "/agents": "agents",
  "/mail": "email",
  "/documents": "documents",
  "/markdown-documents": "md",
  "/tasks": "tasks",
  "/calendar": "calendar",
  "/channels": "channel",
  "/calls": "call",
  "/companies": "companies",
  "/share": "home",
  "/oauth/callback": null,
  "/mcp": "settings",
  "/file": "files",
  "/desktop-auth": null,
};

export function pathnameOf(path: string): string {
  const query = path.indexOf("?");
  return query === -1 ? path : path.slice(0, query);
}

/** Layout for a web path. Unknown or killed split codecs fall back to home. */
export function panesFromPath(path: string): SplitPane[] {
  const pathname = pathnameOf(path);
  const mapped = PATH_SPLIT[pathname as (typeof PATH_ROUTES)[number]];
  if (mapped) return [{ type: mapped, id: "_" }];
  try {
    return decodeSplits(pathname);
  } catch {
    return [{ type: "home", id: "_" }];
  }
}

const INBOX_PANE: SplitPane = { type: "inbox", id: "_" };

/**
 * Product URL for a layout. A lone always-split with empty id maps back onto the
 * 27-route map (`/` not `/home/_`). Two or more panes stay on the split codec.
 */
export function pathFromPanes(panes: readonly SplitPane[]): string {
  if (panes.length === 1) {
    const pane = panes[0]!;
    if (pane.id === "_") {
      if (pane.type === "home") return "/";
      for (const route of PATH_ROUTES) {
        if (PATH_SPLIT[route] === pane.type) return route;
      }
    }
  }
  return encodeSplits(panes);
}

/** `global.new-split` — open inbox in a new split (preferNewSplit, allowDuplicate). */
export function appendInboxSplitPath(path: string): string | null {
  const manager = new SplitManager([...panesFromPath(path)]);
  if (!manager.append(INBOX_PANE, true)) return null;
  return pathFromPanes(manager.panes);
}

/** `split.close-or-home` — last close lands on `/`. The codec does not encode focus, so a multi-split URL drops the rightmost pane. */
export function closeFocusedSplitPath(path: string): string {
  const manager = new SplitManager([...panesFromPath(path)]);
  if (manager.panes.length > 1) manager.focusDelta(manager.panes.length - 1);
  manager.closeFocused();
  return pathFromPanes(manager.panes);
}
