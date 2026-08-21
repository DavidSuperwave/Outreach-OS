import { env, exports } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { newWebSocketRpcSession, type RpcStub } from "capnweb";
import { afterEach, describe, expect, it } from "vitest";
import { DurableTeamsApi, SEED_ADMIN, SEED_MEMBER, formatKernelSessionToken } from "identity";
import type { TeamDurableObject } from "../../identity/src/team-do.js";
import type { TaskAuthenticatedApi, TaskDomainPublicApi, TaskSessionApi } from "../src/domain-api.js";
import { handleOutreachFetch } from "../src/session-rpc.js";
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
    const res = await handleOutreachFetch(new Request("https://task-slice/api"), testEnv);
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
});
