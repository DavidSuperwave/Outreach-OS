import { ConnectivityError } from "./errors.js";

/**
 * Shared egress port (ADR-011). Live URL delivery is blocked until OD-6.
 * Domain code must not call global fetch on request-derived URLs.
 */
export interface SafeFetch {
  readonly kind: "blocked" | "loopback";
  fetch(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<SafeFetchResponse>;
}

export interface SafeFetchResponse {
  status: number;
  body: string;
}

/** Production default while OD-6 is open. */
export function blockedSafeFetch(): SafeFetch {
  return {
    kind: "blocked",
    async fetch(): Promise<SafeFetchResponse> {
      throw new ConnectivityError("od6_blocked", "webhook egress waits on OD-6 safe-fetch ruling");
    },
  };
}

/** Test / in-process drain. Never used for arbitrary user URLs in production. */
export function loopbackSafeFetch(
  handler: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => SafeFetchResponse | Promise<SafeFetchResponse>,
): SafeFetch {
  return {
    kind: "loopback",
    async fetch(url, init) {
      return handler(url, {
        method: init?.method ?? "POST",
        headers: init?.headers ?? {},
        body: init?.body ?? "",
      });
    },
  };
}
