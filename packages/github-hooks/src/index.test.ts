import { describe, expect, it } from "vitest";
import { GITHUB_HOOKS_PATH, signGitHubWebhook } from "connectivity";
import { githubHooksConnector, handleGitHubHooksFetch } from "./index.js";

const secret = "test-secret";

function webhookRequest(event: string, deliveryId: string, body: string, signature?: string): Request {
  return new Request(`https://hooks.test${GITHUB_HOOKS_PATH}/acme`, {
    method: "POST",
    headers: {
      "x-github-event": event,
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": signature ?? signGitHubWebhook(secret, body),
      "content-type": "application/json",
    },
    body,
  });
}

describe("github-hooks worker", () => {
  it("mirrors a signed pull_request delivery and ignores replays", async () => {
    const body = JSON.stringify({
      pull_request: {
        id: 42,
        number: 42,
        title: "n10",
        html_url: "https://github.com/acme/repo/pull/42",
      },
    });
    const first = await handleGitHubHooksFetch(
      webhookRequest("pull_request", "delivery-42", body),
      { GITHUB_WEBHOOK_SECRET: secret },
    );
    expect(first.status).toBe(204);
    expect([...githubHooksConnector().mirrors.values()][0]?.externalId).toBe("42");

    const replay = await handleGitHubHooksFetch(
      webhookRequest("pull_request", "delivery-42", body),
      { GITHUB_WEBHOOK_SECRET: secret },
    );
    expect(replay.status).toBe(204);
    expect(githubHooksConnector().mirrors.size).toBe(1);
  });

  it("rejects a bad HMAC", async () => {
    const body = "{}";
    const response = await handleGitHubHooksFetch(
      webhookRequest("pull_request", "delivery-bad", body, "sha256=nope"),
      { GITHUB_WEBHOOK_SECRET: secret },
    );
    expect(response.status).toBe(401);
  });
});
