/**
 * 27-route map harvested from Root.tsx ROUTES (26 path:) + LAYOUT_ROUTE /*splits.
 * OD-9: desktop-auth is in the map but not served on web. OD-17: nothing at /.well-known.
 */
export const PATH_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/invite",
  "/join",
  "/settings",
  "/onboarding",
  "/getting-started",
  "/inbox",
  "/activity",
  "/reminders",
  "/search",
  "/agents",
  "/mail",
  "/documents",
  "/markdown-documents",
  "/tasks",
  "/calendar",
  "/channels",
  "/calls",
  "/companies",
  "/share",
  "/oauth/callback",
  "/mcp",
  "/file",
  "/desktop-auth",
] as const;

export const LAYOUT_ROUTE = "/*splits";

export const ROUTES = [...PATH_ROUTES, LAYOUT_ROUTE] as const;

export type PathRoute = (typeof PATH_ROUTES)[number];
export type AppRoute = (typeof ROUTES)[number];

/** OD-9 web-only: these paths exist in the map so deep links stay stable, but the web router does not serve them. */
export const WEB_UNSERVED_ROUTES = ["/desktop-auth"] as const;

export function isWebServed(path: string): boolean {
  if (path === "/.well-known" || path.startsWith("/.well-known/")) return false;
  if ((WEB_UNSERVED_ROUTES as readonly string[]).includes(path)) return false;
  return true;
}

export function wellKnownResponse(): null {
  return null;
}

/** Neuwave AppSidebar unmounts on solo settings and auth (ledger: `global.toggle-sidebar`). */
/** Kernel login/signup chrome. Signed-in users land on `/` (N5). */
export function isAuthCoverPath(path: string): boolean {
  const pathname = (path.split("?")[0] ?? path).replace(/\/+$/, "") || "/";
  return pathname === "/login" || pathname === "/signup";
}

/** Post-login destination. `c` then `t` still opens task compose from home. */
export const POST_AUTH_PATH = "/" as const;

export function isFullCoverRoute(path: string): boolean {
  const pathname = (path.split("?")[0] ?? path).replace(/\/+$/, "") || "/";
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/invite" ||
    pathname === "/join" ||
    pathname === "/share" ||
    pathname === "/oauth/callback" ||
    pathname === "/settings" ||
    pathname === "/mcp" ||
    pathname.startsWith("/settings/")
  );
}
