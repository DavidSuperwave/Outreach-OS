import { env, exports } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { newWebSocketRpcSession, type RpcStub } from "capnweb";
import { afterEach, describe, expect, it } from "vitest";
import { DurableTeamsApi, SEED_ADMIN, SEED_MEMBER, formatKernelSessionToken } from "identity";
import type { TeamDurableObject } from "../../identity/src/team-do.js";
import type { TaskAuthenticatedApi, TaskDomainPublicApi, TaskSessionApi } from "../src/domain-api.js";
import { handleOutreachFetch } from "../src/session-rpc.js";
import {
  bootLiveTaskSession,
  createAccountViaKernelPublicApi,
  loadTaskSurface,
  submitTaskCompose,
} from "../src/live-session.js";
import { workshopPublicApiFetcher } from "./workshop-public-api.js";
import type { TaskSliceDurableObject } from "../src/task-do.js";

type UserDo = {
  createAccount(username: string, displayName: string, passwordHash: Uint8Array): Promise<string | null>;
  login(passwordHash: Uint8Array): Promise<string | null>;
  authenticate(secret: string): Promise<void>;
};

const testEnv = env as unknown as {
  TEAM: DurableObjectNamespace<TeamDurableObject>;
  USER: DurableObjectNamespace<UserDo>;
  TASK_SLICE: DurableObjectNamespace<TaskSliceDurableObject>;
  SOUP: D1Database;
};

const adminPassword = new Uint8Array([1, 2, 3, 4]);
const memberPassword = new Uint8Array([5, 6, 7, 8]);

afterEach(async () => {
  await reset();
});

async function kernelToken(username: string, password: Uint8Array): Promise<string> {
  const stub = testEnv.USER.get(testEnv.USER.idFromName(username));
  await stub.createAccount(username, username, password);
  const secret = await stub.login(password);
  await stub.authenticate(secret!);
  return formatKernelSessionToken(username, secret!);
}

async function connectDomain(): Promise<RpcStub<TaskDomainPublicApi>> {
  const response = await exports.default.fetch(new Request("https://task-slice/domain", {
    headers: { Upgrade: "websocket" },
  }));
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  if (!socket) throw new TypeError("Expected a WebSocket response.");
  socket.accept();
  return newWebSocketRpcSession<TaskDomainPublicApi>(socket);
}

async function rejection(value: PromiseLike<unknown>): Promise<Error> {
  try {
    await value;
  } catch (error) {
    if (!(error instanceof Error)) throw new TypeError("Expected RPC to reject with an Error.", { cause: error });
    return error;
  }
  throw new Error("Expected RPC to reject.");
}

describe("N6 Cap'n Web TaskDomainApi beside kernel PublicApi", () => {
  it("creates and lists a task after kernel authenticate + openTenant", async () => {
    const token = await kernelToken("admin", adminPassword);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(SEED_ADMIN);
    const team = await teams.createTeam(SEED_ADMIN, "Outreach");

    using domain = await connectDomain();
    using authed = await domain.authenticate(token) as RpcStub<TaskAuthenticatedApi>;
    using session = await authed.openTenant(team.id) as RpcStub<TaskSessionApi>;
    const created = await session.createTask("From session", "s1");
    expect(created.task.title).toBe("From session");
    expect(created.task.tenantId).toBe(team.id);

    const items = await session.listTasks();
    expect(items.map((item) => item.title)).toEqual(["From session"]);

    const renamed = await session.updateTitle(created.task.id, "Renamed", "s2");
    expect(renamed.title).toBe("Renamed");

    const facts = await session.listActivity();
    expect(facts.map((fact) => fact.action).sort()).toEqual(["created", "edited"]);
    expect(await session.listAlerts()).toEqual([]);
  });

  it("subscribes over the worker streaming socket using the kernel session", async () => {
    const token = await kernelToken("admin", adminPassword);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(SEED_ADMIN);
    const team = await teams.createTeam(SEED_ADMIN, "Outreach");

    using domain = await connectDomain();
    using authed = await domain.authenticate(token) as RpcStub<TaskAuthenticatedApi>;
    using session = await authed.openTenant(team.id) as RpcStub<TaskSessionApi>;
    const created = await session.createTask("Live", "live-1");
    const cursor = await session.seq();

    const denied = await handleOutreachFetch(
      new Request("https://task-slice/subscribe?cursor=0", { headers: { Upgrade: "websocket" } }),
      testEnv,
    );
    expect(denied.status).toBe(401);

    const sub = await handleOutreachFetch(
      new Request(`https://task-slice/subscribe?cursor=${cursor}`, {
        headers: {
          Upgrade: "websocket",
          authorization: `Bearer ${token}`,
          "x-neuwave-tenant": team.id,
        },
      }),
      testEnv,
    );
    expect(sub.status).toBe(101);
    const ws = sub.webSocket;
    if (!ws) throw new TypeError("Expected a subscribe WebSocket.");
    const messages: Array<{ type: string; deltas?: Array<{ item: { title: string } }> }> = [];
    ws.accept();
    const got = new Promise<void>((resolve) => {
      ws.addEventListener("message", (event) => {
        messages.push(JSON.parse(String(event.data)) as (typeof messages)[number]);
        if (messages.some((msg) => msg.deltas?.some((delta) => delta.item.title === "Live v2"))) resolve();
      });
    });
    await session.updateTitle(created.task.id, "Live v2", "live-2");
    await Promise.race([
      got,
      new Promise((_, reject) => setTimeout(() => reject(new Error("no session websocket delta")), 2000)),
    ]);
    const titles = messages.flatMap((msg) => (msg.deltas ?? []).map((delta) => delta.item.title));
    expect(titles).toContain("Live v2");
  });

  it("lists operator alerts for poisoned outbox rows after kernel session", async () => {
    const token = await kernelToken("admin", adminPassword);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(SEED_ADMIN);
    const team = await teams.createTeam(SEED_ADMIN, "Outreach");

    using domain = await connectDomain();
    using authed = await domain.authenticate(token) as RpcStub<TaskAuthenticatedApi>;
    using session = await authed.openTenant(team.id) as RpcStub<TaskSessionApi>;
    await session.createTask("Keep me", "poi-1");
    const stub = testEnv.TASK_SLICE.get(testEnv.TASK_SLICE.idFromName(team.id));
    expect(await stub.poisonPending(5)).toBe(1);
    const alerts = await session.listAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.kind).toBe("outbox_poison");
    expect(alerts[0]?.reason).toMatch(/projector down/);
  });

  it("rejects client-supplied actor JSON on the Cap'n Web mount", async () => {
    const header = await handleOutreachFetch(
      new Request("https://task-slice/domain", {
        headers: {
          Upgrade: "websocket",
          "x-neuwave-actor": JSON.stringify({ kernelUsername: "admin" }),
        },
      }),
      testEnv,
    );
    expect(header.status).toBe(400);
    expect(await header.text()).toMatch(/server-derived/);
  });

  it("does not serve REST JSON /rpc (ADR-002 negative)", async () => {
    const token = await kernelToken("admin", adminPassword);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(SEED_ADMIN);
    const team = await teams.createTeam(SEED_ADMIN, "Outreach");
    const rest = await handleOutreachFetch(
      new Request("https://task-slice/rpc", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "x-neuwave-tenant": team.id,
          "content-type": "application/json",
        },
        body: JSON.stringify({ op: "createTask", title: "nope", actor: { kernelUsername: "member" } }),
      }),
      testEnv,
    );
    expect(rest.status).toBe(404);
    expect(await rest.text()).toMatch(/Cap'n Web TaskDomainApi/);
  });

  it("forwards /api to the kernel Workshop worker when bound", async () => {
    const forwarded = await handleOutreachFetch(
      new Request("https://task-slice/api", { headers: { Upgrade: "websocket" } }),
      {
        ...testEnv,
        WORKSHOP: {
          fetch: async () => new Response("kernel-public-api", { status: 200, headers: { "x-kernel": "public-api" } }),
        },
      },
    );
    expect(forwarded.status).toBe(200);
    expect(forwarded.headers.get("x-kernel")).toBe("public-api");
    expect(await forwarded.text()).toBe("kernel-public-api");
  });

  it("leaves /api as the unpatched kernel mount when Workshop is not bound", async () => {
    const res = await handleOutreachFetch(new Request("https://task-slice/api"), {
      ...testEnv,
      WORKSHOP: undefined,
      LOCAL_KERNEL_API: undefined,
    });
    expect(res.status).toBe(404);
    expect(await res.text()).toMatch(/Workshop worker on \/api/);
  });

  it("rejects a kernel user who is not a team member at openTenant", async () => {
    await kernelToken("admin", adminPassword);
    const memberToken = await kernelToken("member", memberPassword);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(SEED_ADMIN);
    teams.registerKernelUser(SEED_MEMBER);
    const team = await teams.createTeam(SEED_ADMIN, "Outreach");

    using domain = await connectDomain();
    using authed = await domain.authenticate(memberToken) as RpcStub<TaskAuthenticatedApi>;
    const denied = await rejection(authed.openTenant(team.id));
    expect(denied.message).toMatch(/not a member/);
  });

  it("rejects a missing session at authenticate", async () => {
    using domain = await connectDomain();
    const denied = await rejection(domain.authenticate(""));
    expect(denied.message).toMatch(/session required|invalid/);
  });

  it("rejects an invalid kernel token at authenticate", async () => {
    using domain = await connectDomain();
    const denied = await rejection(domain.authenticate("nocolon"));
    expect(denied.message).toMatch(/invalid/);
  });

  it("serves the custom React shell on /tasks and kernel login on /login", async () => {
    const tasks = await handleOutreachFetch(new Request("https://task-slice/tasks"), testEnv);
    expect(tasks.status).toBe(200);
    expect(tasks.headers.get("x-outreach-origin")).toBe("compositor");
    const html = await tasks.text();
    expect(html).toContain("data-origin=\"compositor\"");
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-slice=\"task\"");
    expect(html).toContain("data-scope=\"task-compose-popover\"");
    expect(html).toContain("\"domainApi\":\"/domain\"");
    expect(html).toContain("\"kernelApi\":\"/api\"");

    const login = await handleOutreachFetch(new Request("https://task-slice/login"), testEnv);
    expect(await login.text()).toMatch(/data-surface="kernel.login"/);
    const stub = await handleOutreachFetch(new Request("https://task-slice/assets/outreach-shell.js"), testEnv);
    expect(stub.headers.get("content-type")).toMatch(/javascript/);
    expect(await stub.text()).toContain("LiveOutreach");

    const fromAssets = await handleOutreachFetch(new Request("https://task-slice/assets/outreach-shell.js"), {
      ...testEnv,
      ASSETS: {
        fetch: async () =>
          new Response("/* LiveOutreach from ASSETS */", {
            headers: { "content-type": "text/javascript; charset=utf-8" },
          }),
      },
    });
    expect(await fromAssets.text()).toContain("from ASSETS");

    const home = await handleOutreachFetch(new Request("https://task-slice/"), testEnv);
    expect(home.headers.get("x-outreach-origin")).toBe("compositor");
    expect(await home.text()).toContain("data-shell=\"outreach-os\"");

    const health = await handleOutreachFetch(new Request("https://task-slice/health"), testEnv);
    expect(await health.text()).toBe("outreach origin compositor");

    const wellKnown = await handleOutreachFetch(new Request("https://task-slice/.well-known"), testEnv);
    expect(wellKnown.status).toBe(404);
  });

  it("boots TaskDomainApi after kernel PublicApi.createAccount on the origin compositor", async () => {
    const env = { ...testEnv, WORKSHOP: workshopPublicApiFetcher(testEnv.USER) };
    const apiRes = await handleOutreachFetch(
      new Request("https://task-slice/api", { headers: { Upgrade: "websocket" } }),
      env,
    );
    expect(apiRes.status).toBe(101);
    const apiSocket = apiRes.webSocket;
    if (!apiSocket) throw new TypeError("Expected kernel /api WebSocket.");
    apiSocket.accept();
    using publicApi = newWebSocketRpcSession<{
      createAccount(
        username: string,
        displayName: string,
        passwordHash: Uint8Array,
      ): Promise<string | null>;
    }>(apiSocket);
    const token = await createAccountViaKernelPublicApi(publicApi, "admin", "Admin", adminPassword);

    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(SEED_ADMIN);
    const team = await teams.createTeam(SEED_ADMIN, "Outreach");

    using domain = await connectDomain();
    using session = await bootLiveTaskSession(domain, token, team.id);
    const created = await submitTaskCompose(session, "Origin compose", "origin-1");
    expect(created.items.map((item) => item.title)).toEqual(["Origin compose"]);

    const html = await handleOutreachFetch(
      new Request("https://task-slice/tasks", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-neuwave-tenant": team.id,
        },
      }),
      env,
    );
    const page = await html.text();
    expect(page).toContain("Origin compose");
    expect(page).toContain("data-surface=\"activity.facts\"");
    expect(page).toContain("data-actor=\"admin\"");
    expect((await loadTaskSurface(session)).alerts).toEqual([]);
  });

  it("openDefaultTenant bootstraps a home team and lists compose through the hydrate path", async () => {
    const env = { ...testEnv, LOCAL_KERNEL_API: "true" };
    const apiRes = await handleOutreachFetch(
      new Request("https://task-slice/api", { headers: { Upgrade: "websocket" } }),
      env,
    );
    expect(apiRes.status).toBe(101);
    const apiSocket = apiRes.webSocket;
    if (!apiSocket) throw new TypeError("Expected kernel /api WebSocket.");
    apiSocket.accept();
    using publicApi = newWebSocketRpcSession<{
      createAccount(
        username: string,
        displayName: string,
        passwordHash: Uint8Array,
      ): Promise<string | null>;
    }>(apiSocket);
    const token = await createAccountViaKernelPublicApi(publicApi, "admin", "Admin", adminPassword);

    using domain = await connectDomain();
    using session = await bootLiveTaskSession(domain, token);
    const tenantId = await session.tenantId();
    expect(tenantId.startsWith("team_")).toBe(true);
    const created = await submitTaskCompose(session, "Hydrate compose", "hydrate-1");
    expect(created.items.map((item) => item.title)).toEqual(["Hydrate compose"]);

    const sub = await handleOutreachFetch(
      new Request(`https://task-slice/subscribe?cursor=0&token=${encodeURIComponent(token)}&tenant=${tenantId}`, {
        headers: { Upgrade: "websocket" },
      }),
      env,
    );
    expect(sub.status).toBe(101);
  });
});
