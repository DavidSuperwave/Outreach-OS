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

export interface InstantlyHttp {
  get(path: string): Promise<unknown>
}

export function instantlyHttp(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): InstantlyHttp {
  return {
    async get(path: string): Promise<unknown> {
      assertInstantlyReadRequest("GET", path);
      const url = path.startsWith("http") ? path : `${INSTANTLY_API_ORIGIN}${path}`;
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
