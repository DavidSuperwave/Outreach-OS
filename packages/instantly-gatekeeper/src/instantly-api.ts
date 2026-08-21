export const INSTANTLY_FORBIDDEN_METHODS = [
  "send",
  "activate",
  "start",
  "reply",
  "addLead",
  "pauseCampaign",
  "launchCampaign",
] as const;

export const INSTANTLY_FORBIDDEN_PATH_FRAGMENTS = [
  "/activate",
  "/pause",
  "/duplicate",
  "/share",
  "/from-export",
  "/export",
  "/variables",
] as const;

export const INSTANTLY_API_ORIGIN = "https://api.instantly.ai";

export class InstantlyReadOnlyError extends Error {
  readonly code = "read_only" as const;

  constructor(detail: string) {
    super(`Instantly ${detail}; send/activate require a separate owner order`);
    this.name = "InstantlyReadOnlyError";
  }
}

export function assertInstantlyReadRequest(method: string, path: string): void {
  const verb = method.toUpperCase();
  if (verb !== "GET") {
    throw new InstantlyReadOnlyError(`${verb} ${path} is not implemented`);
  }
  const lower = path.toLowerCase();
  const blocked = INSTANTLY_FORBIDDEN_PATH_FRAGMENTS.find((fragment) => lower.includes(fragment));
  if (blocked) {
    throw new InstantlyReadOnlyError(`path ${path} is not implemented`);
  }
}

export function assertInstantlyReadOnlyMethod(method: string): void {
  if ((INSTANTLY_FORBIDDEN_METHODS as readonly string[]).includes(method)) {
    throw new InstantlyReadOnlyError(`${method} is not implemented`);
  }
}

export function instantlyUrl(path: string): string {
  assertInstantlyReadRequest("GET", path);
  if (!path.startsWith("/api/v2/") || path.includes("://") || path.includes("\\") || path.includes("..")) {
    throw new InstantlyReadOnlyError(`path ${path} is not implemented`);
  }
  const url = new URL(path, INSTANTLY_API_ORIGIN);
  if (url.origin !== INSTANTLY_API_ORIGIN) {
    throw new InstantlyReadOnlyError(`path ${path} is not implemented`);
  }
  return url.href;
}

export interface InstantlyHttp {
  get(path: string): Promise<unknown>
}

export function instantlyHttp(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): InstantlyHttp {
  return {
    async get(path: string): Promise<unknown> {
      const url = instantlyUrl(path);
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Instantly GET ${path} failed (${response.status})`);
      }
      return response.json();
    },
  };
}
