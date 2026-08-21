/**
 * ADR-002 router: HTTP is reserved for webhooks, OAuth, file/streaming bytes, and `/.well-known`.
 * Cap'n Web mounts are RPC, not REST. Kernel PublicApi stays on `/api` (Workshop worker).
 * Wrapper TaskDomainApi is minted beside it on `/domain` after kernel authenticate.
 */
export const KERNEL_PUBLIC_API_PATH = "/api";
export const TASK_DOMAIN_API_PATH = "/domain";
export const TASK_SUBSCRIBE_PATH = "/subscribe";
export const REST_RPC_PATH = "/rpc";

export type OutreachRouteKind =
  | "kernel-capnp"
  | "domain-capnp"
  | "streaming"
  | "webhook"
  | "health"
  | "rest-rejected"
  | "not-found";

export function classifyOutreachPath(pathname: string): OutreachRouteKind {
  if (pathname === REST_RPC_PATH || pathname.startsWith(`${REST_RPC_PATH}/`)) {
    return "rest-rejected";
  }
  if (pathname === KERNEL_PUBLIC_API_PATH) return "kernel-capnp";
  if (pathname === TASK_DOMAIN_API_PATH) return "domain-capnp";
  if (pathname === TASK_SUBSCRIBE_PATH) return "streaming";
  if (pathname === "/hooks" || pathname.startsWith("/hooks/")) return "webhook";
  if (pathname === "/" || pathname === "/health") return "health";
  return "not-found";
}
