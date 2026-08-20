import { AccessStore } from "authz";
import {
  GITHUB_DELIVERY_HEADER,
  GITHUB_EVENT_HEADER,
  GITHUB_SIGNATURE_HEADER,
  GitHubConnector,
  handleGitHubWebhook,
} from "connectivity";
import { EntityRegistry } from "registry";

export interface GitHubHooksEnv {
  GITHUB_WEBHOOK_SECRET?: string
}

const registry = new EntityRegistry();
const access = new AccessStore();
const connector = new GitHubConnector(
  registry,
  access,
  "team_local",
  "user_local",
);

export function githubHooksConnector(): GitHubConnector {
  return connector;
}

export async function handleGitHubHooksFetch(
  request: Request,
  env: GitHubHooksEnv = {},
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return new Response("GitHub hooks worker is running.", {
      headers: { "content-type": "text/plain" },
    });
  }
  const rawBody = await request.text();
  const result = handleGitHubWebhook({
    pathname: url.pathname,
    method: request.method,
    event: request.headers.get(GITHUB_EVENT_HEADER),
    deliveryId: request.headers.get(GITHUB_DELIVERY_HEADER),
    signature: request.headers.get(GITHUB_SIGNATURE_HEADER),
    secret: env.GITHUB_WEBHOOK_SECRET ?? "",
    rawBody,
    connector,
  });
  if (result.status === 204) return new Response(null, { status: 204 });
  return new Response(result.skipped ? "skipped" : "rejected", { status: result.status });
}

export default {
  async fetch(request: Request, env: GitHubHooksEnv): Promise<Response> {
    return handleGitHubHooksFetch(request, env);
  },
};
