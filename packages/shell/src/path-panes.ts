import { PATH_ROUTES } from "./routes.js";
import { decodeSplits, type SplitPane, type SplitType } from "./splits.js";

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
