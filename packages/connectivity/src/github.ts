import { emptyAccess } from "authz";
import { nextId, type EntityRegistry } from "registry";
import { ConnectivityError } from "./errors.js";

/** Verified J5: exactly six handled GitHub webhook types; unknown skipped. */
export const GITHUB_INGRESS_EVENTS = [
  "PullRequest",
  "IssueComment",
  "PullRequestReview",
  "PullRequestReviewComment",
  "CheckRun",
  "Installation",
] as const;

export type GitHubIngressEvent = (typeof GITHUB_INGRESS_EVENTS)[number];

export const GITHUB_PR_SOURCE = "github_pull_request";

export interface GitHubIngressPayload {
  event: string
  deliveryId: string
  action?: string
  pullRequest?: { id: number; number: number; title: string; htmlUrl: string }
  installation?: { id: number }
}

export interface ForeignEntityMirror {
  id: string
  source: typeof GITHUB_PR_SOURCE
  externalId: string
  title: string
  url: string
  tenantId: string
}

export interface GitHubWriteProposal {
  actionId: number
  kind: "addComment"
  pullRequestId: string
  body: string
}

export class GitHubConnector {
  readonly mirrors = new Map<string, ForeignEntityMirror>();
  readonly skipped: string[] = [];
  readonly applied = new Map<number, GitHubWriteProposal>();
  #actions = 0;

  constructor(
    private readonly registry: EntityRegistry,
    private readonly access: { put(id: string, state: ReturnType<typeof emptyAccess>): void },
    private readonly tenantId: string,
    private readonly ownerId: string,
  ) {}

  ingest(payload: GitHubIngressPayload, at = Date.now()): ForeignEntityMirror | null {
    if (!(GITHUB_INGRESS_EVENTS as readonly string[]).includes(payload.event)) {
      this.skipped.push(payload.event);
      return null;
    }
    if (payload.event === "Installation") return null;
    const pr = payload.pullRequest;
    if (!pr) return null;
    const externalId = String(pr.id);
    const existing = [...this.mirrors.values()].find((row) => row.externalId === externalId);
    if (existing) {
      const next = { ...existing, title: pr.title, url: pr.htmlUrl };
      this.mirrors.set(existing.id, next);
      return next;
    }
    const id = nextId("foreign_entity");
    this.registry.register({ type: "foreign_entity", id, tenantId: this.tenantId, createdAt: at, facet: null });
    this.access.put(id, emptyAccess(this.ownerId, this.tenantId));
    const mirror: ForeignEntityMirror = {
      id,
      source: GITHUB_PR_SOURCE,
      externalId,
      title: pr.title,
      url: pr.htmlUrl,
      tenantId: this.tenantId,
    };
    this.mirrors.set(id, mirror);
    return mirror;
  }

  proposeComment(pullRequestId: string, body: string): GitHubWriteProposal {
    if (!this.mirrors.has(pullRequestId)) {
      throw new ConnectivityError("unknown_connector", `unknown PR mirror ${pullRequestId}`);
    }
    this.#actions += 1;
    return { actionId: this.#actions, kind: "addComment", pullRequestId, body };
  }

  apply(proposal: GitHubWriteProposal): void {
    this.applied.set(proposal.actionId, proposal);
  }
}
