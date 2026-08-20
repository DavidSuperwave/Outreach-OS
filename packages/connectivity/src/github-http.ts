import { createHmac, timingSafeEqual } from "node:crypto";
import {
  GitHubConnector,
  type ForeignEntityMirror,
  type GitHubIngressPayload,
  normalizeGitHubEvent,
} from "./github.js";

export const GITHUB_HOOKS_PATH = "/hooks/github";
export const GITHUB_EVENT_HEADER = "x-github-event";
export const GITHUB_DELIVERY_HEADER = "x-github-delivery";
export const GITHUB_SIGNATURE_HEADER = "x-hub-signature-256";

export function githubHooksPathMatches(pathname: string): boolean {
  return pathname === GITHUB_HOOKS_PATH || pathname.startsWith(`${GITHUB_HOOKS_PATH}/`);
}

export function signGitHubWebhook(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

export function verifyGitHubSignature(secret: string, rawBody: string, signature: string | null): boolean {
  if (!secret || !signature) return false;
  const expected = signGitHubWebhook(secret, rawBody);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseGitHubWebhookBody(rawBody: string): Pick<GitHubIngressPayload, "action" | "pullRequest" | "installation"> {
  if (!rawBody.trim()) return {};
  const json = JSON.parse(rawBody) as {
    action?: string
    pull_request?: { id?: number; number?: number; title?: string; html_url?: string }
    installation?: { id?: number }
  };
  const pr = json.pull_request;
  return {
    action: json.action,
    pullRequest: pr && typeof pr.id === "number"
      ? {
          id: pr.id,
          number: typeof pr.number === "number" ? pr.number : pr.id,
          title: typeof pr.title === "string" ? pr.title : "",
          htmlUrl: typeof pr.html_url === "string" ? pr.html_url : "",
        }
      : undefined,
    installation: json.installation && typeof json.installation.id === "number"
      ? { id: json.installation.id }
      : undefined,
  };
}

export interface GitHubWebhookResult {
  status: number
  skipped: boolean
  duplicate: boolean
  event: string | null
  mirror: ForeignEntityMirror | null
}

export function handleGitHubWebhook(input: {
  pathname: string
  method: string
  event: string | null
  deliveryId: string | null
  signature: string | null
  secret: string
  rawBody: string
  connector: GitHubConnector
  at?: number
}): GitHubWebhookResult {
  if (input.method !== "POST" || !githubHooksPathMatches(input.pathname)) {
    return { status: 404, skipped: true, duplicate: false, event: null, mirror: null };
  }
  if (!input.event || !input.deliveryId) {
    return { status: 400, skipped: true, duplicate: false, event: input.event, mirror: null };
  }
  if (!verifyGitHubSignature(input.secret, input.rawBody, input.signature)) {
    return { status: 401, skipped: true, duplicate: false, event: input.event, mirror: null };
  }
  const duplicate = input.connector.deliveries.has(input.deliveryId);
  const parsed = parseGitHubWebhookBody(input.rawBody);
  const mirror = input.connector.ingest({
    event: input.event,
    deliveryId: input.deliveryId,
    ...parsed,
  }, input.at);
  const event = normalizeGitHubEvent(input.event);
  return {
    status: 204,
    skipped: !mirror && !duplicate && event !== "Installation",
    duplicate,
    event: event ?? input.event,
    mirror,
  };
}
