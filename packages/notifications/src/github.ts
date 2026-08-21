import type { GitHubNotificationType, NotificationType } from "./catalog.js";

/**
 * N10 J5 inventory: exactly six GitHub ingress events (unknown skipped).
 * `mention` is the extra producer name that maps onto `github_mention`.
 */
export const N10_GITHUB_INGRESS_EVENTS = [
  "PullRequest",
  "IssueComment",
  "PullRequestReview",
  "PullRequestReviewComment",
  "CheckRun",
  "Installation",
] as const;

export type N10GitHubIngressEvent = (typeof N10_GITHUB_INGRESS_EVENTS)[number];

const HTTP_ALIASES: Record<string, N10GitHubIngressEvent> = {
  pull_request: "PullRequest",
  issue_comment: "IssueComment",
  pull_request_review: "PullRequestReview",
  pull_request_review_comment: "PullRequestReviewComment",
  check_run: "CheckRun",
  installation: "Installation",
};

export function normalizeGitHubIngressName(name: string): N10GitHubIngressEvent | "mention" | null {
  if ((N10_GITHUB_INGRESS_EVENTS as readonly string[]).includes(name)) {
    return name as N10GitHubIngressEvent;
  }
  if (name === "mention" || name === "github_mention") return "mention";
  return HTTP_ALIASES[name] ?? null;
}

/**
 * Types an N10 ingress event *can* produce. CheckRun / Installation produce none.
 */
export const GITHUB_EVENT_TYPE_MAP: Record<N10GitHubIngressEvent | "mention", readonly GitHubNotificationType[]> = {
  PullRequest: ["github_pr_opened", "github_pr_merged", "github_pr_closed", "github_review_requested"],
  IssueComment: ["github_pr_comment"],
  PullRequestReview: ["github_review_submitted"],
  PullRequestReviewComment: ["github_pr_comment"],
  CheckRun: [],
  Installation: [],
  mention: ["github_mention"],
};

/**
 * Map N10's 6 ingress events plus mention onto the 7 GitHub notification types
 * where applicable. Returns null when the event has no notification type
 * (CheckRun, Installation) or a PullRequest action is missing/unknown.
 */
export function fromGitHubEvent(
  name: string,
  action?: string,
  extras: { merged?: boolean } = {},
): NotificationType | null {
  const event = normalizeGitHubIngressName(name);
  if (!event) return null;
  if (event === "mention") return "github_mention";
  if (event === "CheckRun" || event === "Installation") return null;
  if (event === "IssueComment" || event === "PullRequestReviewComment") return "github_pr_comment";
  if (event === "PullRequestReview") return "github_review_submitted";

  const act = (action ?? "").toLowerCase();
  if (act === "opened" || act === "reopened") return "github_pr_opened";
  if (act === "merged" || extras.merged === true) return "github_pr_merged";
  if (act === "closed") return extras.merged ? "github_pr_merged" : "github_pr_closed";
  if (act === "review_requested") return "github_review_requested";
  if (act === "submitted") return "github_review_submitted";
  return null;
}
