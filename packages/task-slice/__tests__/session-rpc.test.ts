import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { DurableTeamsApi, SEED_ADMIN, SEED_MEMBER, formatKernelSessionToken } from "identity";
import type { TeamDurableObject } from "../../identity/src/team-do.js";
import { handleTaskSessionRequest } from "../src/session-rpc.js";
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

describe("N6 worker RPC binds kernel session (not client actor JSON)", () => {
  it("creates and lists a task as the authenticated admin member", async () => {
    const token = await kernelToken("admin", adminPassword);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(SEED_ADMIN);
    const team = await teams.createTeam(SEED_ADMIN, "Outreach");

    const created = await handleTaskSessionRequest(
      new Request("https://task-slice/rpc", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "x-neuwave-tenant": team.id,
          "content-type": "application/json",
        },
        body: JSON.stringify({ op: "createTask", title: "From session", correlationId: "s1" }),
      }),
      testEnv,
    );
    expect(created.status).toBe(200);
    const body = (await created.json()) as { task: { title: string; tenantId: string } };
    expect(body.task.title).toBe("From session");
    expect(body.task.tenantId).toBe(team.id);

    const listed = await handleTaskSessionRequest(
      new Request("https://task-slice/rpc", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "x-neuwave-tenant": team.id,
          "content-type": "application/json",
        },
        body: JSON.stringify({ op: "listTasks" }),
      }),
      testEnv,
    );
    expect(listed.status).toBe(200);
    const page = (await listed.json()) as { items: Array<{ title: string }> };
    expect(page.items.map((item) => item.title)).toEqual(["From session"]);
  });

  it("rejects client-supplied actor JSON", async () => {
    const token = await kernelToken("admin", adminPassword);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(SEED_ADMIN);
    const team = await teams.createTeam(SEED_ADMIN, "Outreach");
    const header = await handleTaskSessionRequest(
      new Request("https://task-slice/rpc", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "x-neuwave-tenant": team.id,
          "x-neuwave-actor": JSON.stringify({ kernelUsername: "admin" }),
          "content-type": "application/json",
        },
        body: JSON.stringify({ op: "createTask", title: "nope" }),
      }),
      testEnv,
    );
    expect(header.status).toBe(400);
    expect(await header.text()).toMatch(/server-derived/);

    const body = await handleTaskSessionRequest(
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
    expect(body.status).toBe(400);
  });

  it("rejects a kernel user who is not a team member", async () => {
    await kernelToken("admin", adminPassword);
    const memberToken = await kernelToken("member", memberPassword);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(SEED_ADMIN);
    teams.registerKernelUser(SEED_MEMBER);
    const team = await teams.createTeam(SEED_ADMIN, "Outreach");
    const denied = await handleTaskSessionRequest(
      new Request("https://task-slice/rpc", {
        method: "POST",
        headers: {
          authorization: `Bearer ${memberToken}`,
          "x-neuwave-tenant": team.id,
          "content-type": "application/json",
        },
        body: JSON.stringify({ op: "createTask", title: "intrude" }),
      }),
      testEnv,
    );
    expect(denied.status).toBe(403);
    expect(await denied.text()).toMatch(/not a member/);
  });

  it("rejects a missing session", async () => {
    const res = await handleTaskSessionRequest(
      new Request("https://task-slice/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "listTasks" }),
      }),
      testEnv,
    );
    expect(res.status).toBe(401);
  });
});
