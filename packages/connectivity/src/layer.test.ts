import { describe, expect, it } from "vitest";
import { fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { ownerOf } from "control-plane";
import { actorContext, requestContext, ConnectivityLayer } from "./layer.js";
import { dryRunIdentityMapping } from "./mapping.js";
import { N10_COMMAND_IDS } from "./commands.js";
import { INSTANTLY_FORBIDDEN_METHODS } from "./instantly.js";
import { ConnectivityError } from "./errors.js";
import {
  DOCUMENT_EVENTS_NOT_FORWARDED,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_SECONDS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  signWebhook,
  verifyWebhookSignature,
  webhookRetryPlan,
} from "./webhooks.js";
import { loopbackSafeFetch } from "./safe-fetch.js";
import { GITHUB_INGRESS_EVENTS, GITHUB_PR_SOURCE } from "./github.js";
import {
  GITHUB_HOOKS_PATH,
  handleGitHubWebhook,
  signGitHubWebhook,
} from "./github-http.js";
import { AUTOMATION_ACTION_KIND, cronMatches, scheduledTickId, zonedParts } from "./automations.js";
import { MEMORY_STALE_MS } from "./memory.js";
import { COMPLETIONS_PATH, DEFAULT_MODEL_ALLOW_LIST } from "./completions.js";
import { IMPORT_SOURCES, normalizeNotionId, normalizeSlackId } from "./import-staging.js";
import { HARVESTED_OAUTH_STRATEGIES } from "./oauth.js";
import { AI_FEATURES } from "./ai-usage.js";
import { CONNECTOR_CATALOG } from "./connectors.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const outsiderId = fixtureId("user", 3);
const otherTenant = fixtureId("team", 2);

function owner() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function outsider() {
  return actorContext(userPrincipal(outsiderId, otherTenant), "outsider");
}

function layer(fetch = loopbackSafeFetch(() => ({ status: 200, body: "ok" }))) {
  return new ConnectivityLayer(tenant, ownerId, fetch);
}

describe("N10 agent connectivity (SUP-554)", () => {
  it("maps legacy connectivity rows without writing (OD-1 Branch A)", () => {
    const mapped = dryRunIdentityMapping([
      { table: "webhooks", pgId: 1 },
      { table: "github_app_installation", pgId: 2 },
      { table: "scheduled_actions", pgId: 3 },
      { table: "mcp_servers", pgId: 4 },
    ]);
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
    expect(mapped.map((row) => row.mappedKind)).toEqual([
      "webhook",
      "github_install",
      "automation",
      "mcp_harvest",
    ]);
  });

  it("names the N10 command set and connector catalog", () => {
    expect(N10_COMMAND_IDS).toContain("settings.connections");
    expect(N10_COMMAND_IDS).not.toContain("chat.send");
    expect(CONNECTOR_CATALOG.find((row) => row.vendorId === "instantly")?.readOnly).toBe(true);
    expect(HARVESTED_OAUTH_STRATEGIES).toEqual([
      "authorization_code_pkce",
      "dynamic_client_registration",
      "static_client",
    ]);
    expect(AI_FEATURES).toHaveLength(10);
    expect(ownerOf("webhook_endpoint").owner).toBe("connectivity.WebhookEndpoint");
  });

  it("lets a sandboxed agent read Instantly through observations and forbids send/activate", async () => {
    const n10 = layer();
    n10.instantlyWorkspace.campaigns.push({
      id: "camp_1",
      name: "Wave 4a",
      status: "active",
      accountEmail: "rep@example.com",
    });
    const session = n10.openInstantlySession(owner());
    const campaigns = await session.listCampaigns();
    expect(campaigns[0]?.name).toBe("Wave 4a");
    expect(session.observations[0]?.title).toMatch(/campaigns/i);
    expect(INSTANTLY_FORBIDDEN_METHODS).toEqual(
      expect.arrayContaining(["send", "activate", "start"]),
    );
    await expect(session.invoke("send")).rejects.toMatchObject({ code: "read_only" });
    await expect(session.invoke("activate")).rejects.toMatchObject({ code: "read_only" });
    expect("send" in session).toBe(false);
    expect(typeof (session as InstantlySessionImpl & { send?: unknown }).send).toBe("undefined");
  });

  it("denies a cross-tenant Instantly session (SEC-3)", () => {
    const n10 = layer();
    expect(() => n10.openInstantlySession(outsider())).toThrow(ConnectivityError);
  });

  it("proves 05-MAP row 14: read capability, propose write, approve, resume", async () => {
    resetIdSequence();
    const n10 = layer();
    n10.instantlyWorkspace.campaigns.push({
      id: "camp_1",
      name: "Read path",
      status: "draft",
      accountEmail: null,
    });
    n10.github.ingest({
      event: "PullRequest",
      deliveryId: "d1",
      pullRequest: { id: 99, number: 99, title: "N10", htmlUrl: "https://github.com/org/repo/pull/99" },
    });
    const proof = await n10.openApi().readProposeApproveResume(owner());
    expect(proof.campaigns).toBe(1);
    expect(proof.approved).toBe(true);
    expect(proof.resumed).toBe(true);
    expect(n10.approval.observations.length).toBeGreaterThan(0);
    expect([...n10.github.applied.values()][0]?.kind).toBe("addComment");
  });

  it("signs outbound webhooks, dedupes (webhook_id, event_id), and uses the 5x retry ladder", async () => {
    const received: { headers: Record<string, string>; body: string }[] = [];
    const n10 = layer(
      loopbackSafeFetch((_url, init) => {
        received.push({ headers: init.headers, body: init.body });
        return { status: 200, body: "ok" };
      }),
    );
    const created = n10.webhooks.create({
      url: "https://hooks.example.test/n10",
      events: ["created"],
      actor: owner(),
    });
    const secret = n10.webhooks.readSecretOnce(created.endpoint.id, owner());
    expect(() => n10.webhooks.readSecretOnce(created.endpoint.id, owner())).toThrow(/read-once/);
    n10.webhooks.enqueue(created.endpoint.id, "created", "evt-1", { id: "doc_1" });
    n10.webhooks.enqueue(created.endpoint.id, "created", "evt-1", { id: "doc_1" });
    await n10.webhooks.drain();
    expect(received).toHaveLength(1);
    expect(received[0]?.headers[WEBHOOK_SIGNATURE_HEADER]).toBe(
      signWebhook(secret, received[0]!.headers[WEBHOOK_TIMESTAMP_HEADER]!, received[0]!.body),
    );
    expect(
      verifyWebhookSignature(
        secret,
        received[0]!.headers[WEBHOOK_TIMESTAMP_HEADER]!,
        received[0]!.body,
        received[0]!.headers[WEBHOOK_SIGNATURE_HEADER]!,
      ),
    ).toBe(true);
    const inspected = n10.webhooks.inspect(created.endpoint.id, "evt-1");
    expect(inspected?.status).toBe("delivered");
    expect(webhookRetryPlan()).toEqual([
      { attempt: 1, delaySeconds: 0 },
      { attempt: 2, delaySeconds: 30 },
      { attempt: 3, delaySeconds: 60 },
      { attempt: 4, delaySeconds: 120 },
      { attempt: 5, delaySeconds: 300 },
    ]);
    expect(WEBHOOK_MAX_ATTEMPTS).toBe(5);
    expect([...WEBHOOK_RETRY_DELAYS_SECONDS]).toEqual([30, 60, 120, 300]);
  });

  it("never forwards content_uploaded / sync_content_updated / purged", () => {
    const n10 = layer();
    const created = n10.webhooks.create({
      url: "https://hooks.example.test/n10",
      events: ["created"],
      actor: owner(),
    });
    for (const eventName of DOCUMENT_EVENTS_NOT_FORWARDED) {
      expect(() => n10.webhooks.enqueue(created.endpoint.id, eventName, "x", {})).toThrow(/never forwarded/);
    }
  });

  it("blocks live egress while OD-6 is open and auto-pauses poison endpoints", async () => {
    const n10 = new ConnectivityLayer(tenant, ownerId);
    const created = n10.webhooks.create({
      url: "https://hooks.example.test/n10",
      events: ["created"],
      actor: owner(),
    });
    n10.webhooks.enqueue(created.endpoint.id, "created", "evt-od6", { id: "1" });
    await n10.webhooks.drain();
    const row = n10.webhooks.inspect(created.endpoint.id, "evt-od6");
    expect(row?.status).toBe("poison");
    expect(n10.webhooks.endpoints.get(created.endpoint.id)?.status).toBe("paused");
    expect(row?.attempts[0]?.error).toMatch(/OD-6/);
  });

  it("enforces webhook owner XOR and rejects outsider inspect/pause", () => {
    const n10 = layer();
    const bot = {
      actor: { kind: "bot" as const, id: `mbot_${"a".repeat(12)}_${"b".repeat(64)}`, tenantId: tenant },
      kernelUsername: "bot",
      isDeploymentAdmin: false,
    };
    const userHook = n10.webhooks.create({ url: "https://h.test/u", events: ["created"], actor: owner() });
    expect(() => n10.webhooks.pause(userHook.endpoint.id, outsider(), "nope")).toThrow(ConnectivityError);
    expect(() =>
      n10.webhooks.create({ url: "https://h.test/b", events: ["created"], actor: owner(), ownerKind: "bot" }),
    ).toThrow(/bot-owned/);
    const botHook = n10.webhooks.create({ url: "https://h.test/b", events: ["created"], actor: bot });
    expect(botHook.endpoint.ownerKind).toBe("bot");
  });

  it("ingests exactly six GitHub events, skips unknown, upserts github_pull_request", () => {
    resetIdSequence();
    const n10 = layer();
    expect(GITHUB_INGRESS_EVENTS).toHaveLength(6);
    const first = n10.github.ingest({
      event: "PullRequest",
      deliveryId: "d1",
      pullRequest: { id: 7, number: 7, title: "one", htmlUrl: "https://github.com/org/repo/pull/7" },
    });
    const again = n10.github.ingest({
      event: "PullRequestReview",
      deliveryId: "d2",
      pullRequest: { id: 7, number: 7, title: "one-updated", htmlUrl: "https://github.com/org/repo/pull/7" },
    });
    expect(first?.id).toBe(again?.id);
    expect(again?.source).toBe(GITHUB_PR_SOURCE);
    expect(again?.title).toBe("one-updated");
    n10.github.ingest({ event: "gollum", deliveryId: "d3" });
    expect(n10.github.skipped).toEqual(["gollum"]);
    expect(n10.registry.resolve(first!.id, "foreign_entity").type).toBe("foreign_entity");
  });

  it("accepts GitHub HTTP webhooks at /hooks/github/* with HMAC and delivery dedupe", () => {
    resetIdSequence();
    const n10 = layer();
    const secret = "hook-secret";
    const body = JSON.stringify({
      action: "opened",
      pull_request: {
        id: 11,
        number: 11,
        title: "hook pr",
        html_url: "https://github.com/org/repo/pull/11",
      },
    });
    const headers = {
      pathname: `${GITHUB_HOOKS_PATH}/org`,
      method: "POST",
      event: "pull_request",
      deliveryId: "deliv_1",
      signature: signGitHubWebhook(secret, body),
      secret,
      rawBody: body,
      connector: n10.github,
    };
    const first = handleGitHubWebhook(headers);
    expect(first.status).toBe(204);
    expect(first.mirror?.source).toBe(GITHUB_PR_SOURCE);
    expect(first.mirror?.externalId).toBe("11");
    const replay = handleGitHubWebhook(headers);
    expect(replay.duplicate).toBe(true);
    expect(n10.github.mirrors.size).toBe(1);
    const forged = handleGitHubWebhook({ ...headers, deliveryId: "deliv_2", signature: "sha256=dead" });
    expect(forged.status).toBe(401);
    const unknown = handleGitHubWebhook({
      ...headers,
      deliveryId: "deliv_3",
      event: "gollum",
      signature: signGitHubWebhook(secret, body),
    });
    expect(unknown.status).toBe(204);
    expect(n10.github.skipped).toContain("gollum");
  });

  it("runs automations as ActionKind Agent with cron + IANA timezone and DST-safe tick ids", () => {
    const n10 = layer();
    const automation = n10.automations.create({
      prompt: "Summarize inbox",
      cron: "0 9 * * 1-5",
      timeZone: "America/New_York",
      ownerId,
      tenantId: tenant,
    });
    expect(automation.actionKind).toBe(AUTOMATION_ACTION_KIND);
    const thursdayNineEdt = Date.parse("2026-08-20T13:00:00Z");
    expect(cronMatches("0 9 * * 1-5", zonedParts(thursdayNineEdt, "America/New_York"))).toBe(true);
    const run = n10.automations.fire(automation.id, thursdayNineEdt);
    expect(run?.kernelSession).toBe("spawned");
    expect(n10.automations.fire(automation.id, thursdayNineEdt)?.scheduledTick).toBe(run?.scheduledTick);
    expect(n10.automations.runs).toHaveLength(1);
    const springMinutes = [];
    for (let hour = 1; hour <= 3; hour += 1) {
      for (const minute of [0, 30]) {
        const utc = Date.parse(`2026-03-08T${String(hour + 5).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
        springMinutes.push(zonedParts(utc, "America/New_York"));
      }
    }
    expect(springMinutes.some((part) => part.hour === 2)).toBe(false);
    const fallEarlier = Date.parse("2026-11-01T05:30:00Z");
    const fallLater = Date.parse("2026-11-01T06:30:00Z");
    expect(zonedParts(fallEarlier, "America/New_York").hour).toBe(1);
    expect(zonedParts(fallLater, "America/New_York").hour).toBe(1);
    expect(scheduledTickId(automation.id, fallEarlier)).not.toBe(scheduledTickId(automation.id, fallLater));
  });

  it("refreshes memory on activity, never via a workspace sweep", () => {
    const n10 = layer();
    const t0 = 1_000;
    n10.memory.refreshOnActivity(ownerId, "Rep covers mid-market SaaS.", t0);
    expect(n10.memory.isStale(ownerId, t0 + MEMORY_STALE_MS - 1)).toBe(false);
    expect(n10.memory.isStale(ownerId, t0 + MEMORY_STALE_MS)).toBe(true);
    expect(() => n10.memory.sweepWorkspace()).toThrow(/OD-28/);
  });

  it("governs /chat/completions with owner, allow-list, spend tag, and stream forced false", async () => {
    const n10 = layer();
    expect(COMPLETIONS_PATH).toBe("/chat/completions");
    const ok = await n10.completions.complete(
      { model: DEFAULT_MODEL_ALLOW_LIST[0], messages: [{ role: "user", content: "hi" }], stream: true },
      {
        ownerId,
        feature: "DynamicCompletionsApi",
        allowList: DEFAULT_MODEL_ALLOW_LIST,
        enabled: true,
        hasChatModelAccess: true,
      },
    );
    expect(ok.stream).toBe(false);
    expect(n10.usage.rollup("DynamicCompletionsApi").events).toBe(1);
    await expect(
      n10.completions.complete(
        { model: "gpt-banned", messages: [{ role: "user", content: "hi" }] },
        {
          ownerId,
          feature: "DynamicCompletionsApi",
          allowList: DEFAULT_MODEL_ALLOW_LIST,
          enabled: true,
          hasChatModelAccess: true,
        },
      ),
    ).rejects.toMatchObject({ code: "model_not_allowed" });
    n10.completions.disable();
    await expect(
      n10.completions.complete(
        { model: DEFAULT_MODEL_ALLOW_LIST[0], messages: [{ role: "user", content: "hi" }] },
        {
          ownerId,
          feature: "DynamicCompletionsApi",
          allowList: DEFAULT_MODEL_ALLOW_LIST,
          enabled: true,
          hasChatModelAccess: true,
        },
      ),
    ).rejects.toMatchObject({ code: "kill_switch" });
  });

  it("imports Linear/Notion/Slack with Notion 32-hex collapse and Slack passthrough", () => {
    const n10 = layer();
    expect(IMPORT_SOURCES.linear.target).toBe("task");
    expect(normalizeNotionId("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe("aaaaaaaabbbbccccddddeeeeeeeeeeee");
    expect(normalizeSlackId("C123")).toBe("C123");
    const run = n10.imports.gather({
      userId: ownerId,
      source: "notion",
      candidates: [{ externalId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", title: "Doc" }],
    });
    expect(run.candidates[0]?.normalizedId).toHaveLength(32);
    expect(n10.imports.gather({ userId: ownerId, source: "notion", candidates: [] }).id).toBe(run.id);
    expect(n10.imports.confirm(run.id).status).toBe("imported");
  });

  it("harvests MCP OAuth/catalog and keeps the MCP server surface behind a kill switch", () => {
    const n10 = layer();
    n10.mcp.harvestCatalog("byo", [{ name: "search_docs", description: "Find docs", inputSchema: {} }], true);
    expect(n10.mcp.search("docs")[0]?.name).toBe("search_docs");
    n10.mcp.expose("search_docs");
    expect(n10.mcp.invokeServer("search_docs", ownerId).observation).toBe("approve");
    n10.mcp.killServer();
    expect(() => n10.mcp.invokeServer("search_docs", ownerId)).toThrow(/disabled/);
  });

  it("mints Instantly and GitHub connections from Team DO custody without kernel grants", () => {
    const n10 = layer();
    const instantly = n10.connectVendor("instantly", owner());
    expect(instantly.scope).toBe("user");
    const github = n10.connectVendor("github", owner());
    expect(github.scope).toBe("team");
    expect(n10.connectors.mintSession(github.id, owner()).vendorId).toBe("github");
    expect(() => n10.connectors.mintSession(github.id, outsider())).toThrow(/cross-tenant/);
  });

  it("accepts a request context with idempotency for the typed capability", () => {
    const ctx = requestContext(owner(), { idempotencyKey: "n10-1", correlationId: "c1" });
    expect(ctx.idempotencyKey).toBe("n10-1");
  });
});

type InstantlySessionImpl = import("./instantly.js").InstantlySessionImpl;
