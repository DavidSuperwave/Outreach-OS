/**
 * ADR-002 router: HTTP is reserved for webhooks, OAuth, file/streaming bytes, and `/.well-known`.
 * Cap'n Web mounts are RPC, not REST. Kernel PublicApi stays on `/api` (Workshop worker).
 * Wrapper TaskDomainApi is minted beside it on `/domain` after kernel authenticate.
 * The custom React shell is served as HTML for the 27-route map (ADR-001).
 */
import { decodeSplits, isWebServed, PATH_ROUTES } from "shell";

export const KERNEL_PUBLIC_API_PATH = "/api";
export const TASK_DOMAIN_API_PATH = "/domain";
export const TASK_SUBSCRIBE_PATH = "/subscribe";
export const REST_RPC_PATH = "/rpc";
export const HEALTH_PATH = "/health";
export const SHELL_ASSET_PATH = "/assets/outreach-shell.js";

export type OutreachRouteKind =
  | "kernel-capnp"
  | "domain-capnp"
  | "streaming"
  | "webhook"
  | "oauth"
  | "health"
  | "shell"
  | "asset"
  | "rest-rejected"
  | "not-found";

const PATH_ROUTE_SET = new Set<string>(PATH_ROUTES);

export function classifyOutreachPath(pathname: string): OutreachRouteKind {
  if (pathname === REST_RPC_PATH || pathname.startsWith(`${REST_RPC_PATH}/`)) {
    return "rest-rejected";
  }
  if (pathname === KERNEL_PUBLIC_API_PATH) return "kernel-capnp";
  if (pathname === TASK_DOMAIN_API_PATH) return "domain-capnp";
  if (pathname === TASK_SUBSCRIBE_PATH) return "streaming";
  if (pathname === "/hooks" || pathname.startsWith("/hooks/")) return "webhook";
  if (pathname === "/oauth/callback" || pathname.startsWith("/oauth/")) return "oauth";
  if (pathname === HEALTH_PATH) return "health";
  if (pathname === SHELL_ASSET_PATH) return "asset";
  if (!isWebServed(pathname)) return "not-found";
  if (PATH_ROUTE_SET.has(pathname)) return "shell";
  try {
    decodeSplits(pathname);
    return "shell";
  } catch {
    return "not-found";
  }
}
