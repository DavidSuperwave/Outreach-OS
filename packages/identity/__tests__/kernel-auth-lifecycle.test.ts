import { env } from "cloudflare:workers";
import { evictDurableObject, reset } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { afterKernelAuthenticate, assertAdminPolicyAgrees } from "../src/kernel-auth-bridge.js";
import { LoginAttemptImpl } from "../src/login-attempt.js";
import { fixtureId } from "../src/ids.js";
import { DurableTeamsApi } from "../src/durable-teams-api.js";
import { formatKernelSessionToken } from "../src/kernel-session-protocol.js";
import { parseKernelSessionToken } from "../src/kernel-types.js";
import { KernelPublicApi } from "./kernel-public-api.js";
import type { KernelPasswordUser } from "./kernel-password-user.js";
import type { PendingLogin } from "./pending-login.js";
import type { TeamDurableObject } from "../src/team-do.js";

type UserDo = {
  createAccount(
    username: string,
    displayName: string,
    passwordHash: Uint8Array,
  ): Promise<string | null>;
  login(passwordHash: Uint8Array): Promise<string | null>;
  authenticate(secret: string): Promise<void>;
  whoami(): Promise<{ type: string; name: string; id: string }>;
};

const testEnv = env as unknown as {
  TEAM: DurableObjectNamespace<TeamDurableObject>;
  USER: DurableObjectNamespace<UserDo>;
  KERNEL_USER: DurableObjectNamespace<KernelPasswordUser>;
  PENDING_LOGIN: DurableObjectNamespace<PendingLogin>;
};

const adminPassword = new Uint8Array([1, 2, 3, 4]);
const memberPassword = new Uint8Array([5, 6, 7, 8]);
const adminSession = { username: "admin", userId: fixtureId("user", 1) };
const memberSession = { username: "member", userId: fixtureId("user", 2) };

afterEach(async () => {
  await reset();
});

function userStub(username: string) {
  return testEnv.USER.get(testEnv.USER.idFromName(username));
}

describe("contract:capability-lifecycle — kernel UserDurableObject + TeamsApi", () => {
  it("seeded admin createAccount → login → authenticate → owner role (05-MAP row 1)", async () => {
    const created = await userStub("admin").createAccount("admin", "Admin", adminPassword);
    expect(typeof created).toBe("string");
    const secret = await userStub("admin").login(adminPassword);
    expect(typeof secret).toBe("string");
    await userStub("admin").authenticate(secret!);
    expect((await userStub("admin").whoami()).id).toBe("admin");

    const token = formatKernelSessionToken("admin", secret!);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(adminSession);
    const team = await teams.createTeam(adminSession, "Outreach");
    const ctx = afterKernelAuthenticate(teams, token);
    expect(ctx.kernelUsername).toBe("admin");
    expect(ctx.isDeploymentAdmin).toBe(true);
    expect(ctx.actor.id).toBe(adminSession.userId);
    expect(await teams.resolveEffectiveRole(adminSession, team.id)).toBe("owner");
    assertAdminPolicyAgrees("admin", true, teams.adminPolicy);
  });

  it("seeded member is not deployment admin and resolves member after kernel login", async () => {
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(adminSession);
    teams.registerKernelUser(memberSession);

    await userStub("admin").createAccount("admin", "Admin", adminPassword);
    await userStub("member").createAccount("member", "Member", memberPassword);
    const team = await teams.createTeam(adminSession, "Outreach");
    const invite = await teams.invite(adminSession, team.id, "member", "member", "seed");
    await teams.acceptInvite(memberSession, team.id, invite.id);

    const secret = await userStub("member").login(memberPassword);
    await userStub("member").authenticate(secret!);
    const ctx = afterKernelAuthenticate(teams, formatKernelSessionToken("member", secret!));
    expect(ctx.isDeploymentAdmin).toBe(false);
    expect(await teams.resolveEffectiveRole(memberSession, team.id)).toBe("member");
    assertAdminPolicyAgrees("member", false, teams.adminPolicy);
  });

  it("wrong password returns null; foreign secret authenticate throws", async () => {
    await userStub("admin").createAccount("admin", "Admin", adminPassword);
    expect(await userStub("admin").login(new Uint8Array([9]))).toBeNull();
    const memberSecret = await userStub("member").createAccount("member", "Member", memberPassword);
    const rejected = userStub("admin").authenticate(memberSecret!).then(
      () => "authenticated",
      (error: Error) => error.message,
    );
    expect(await rejected).toMatch(/invalid session token/);
  });

  it("session survives User DO eviction", async () => {
    const secret = await userStub("admin").createAccount("admin", "Admin", adminPassword);
    await evictDurableObject(userStub("admin") as never);
    await userStub("admin").authenticate(secret!);
  });
});

describe("session revoke (kernel-protocol harness; User DO has no revoke RPC)", () => {
  it("revoke invalidates authenticate", async () => {
    const publicApi = new KernelPublicApi(testEnv.KERNEL_USER);
    const token = await publicApi.createAccount("admin", "Admin", adminPassword);
    await publicApi.authenticate(token!);
    const { username } = parseKernelSessionToken(token!);
    const stub = testEnv.KERNEL_USER.get(testEnv.KERNEL_USER.idFromName(username));
    await publicApi.revokeSession(token!);
    await evictDurableObject(stub);
    const rejected = publicApi.authenticate(token!).then(
      () => "authenticated",
      (error: Error) => error.message,
    );
    expect(await rejected).toMatch(/invalid session token/);
    const next = await publicApi.login("admin", adminPassword);
    await expect(publicApi.authenticate(next!)).resolves.toMatchObject({ username: "admin" });
  });
});

describe("contract:capability-lifecycle — LoginAttempt.wait dispose-cancels", () => {
  it("abandon rejects in-flight wait and ignores a late deliver", async () => {
    const pending = testEnv.PENDING_LOGIN.get(testEnv.PENDING_LOGIN.newUniqueId());
    const attempt = new LoginAttemptImpl(pending);
    const waiting = attempt.wait().then(
      () => "delivered",
      (error: Error) => error.message,
    );
    await attempt.dispose();
    expect(await waiting).toMatch(/cancelled/);
    await pending.deliver("admin:too-late");
    expect(await pending.debugState()).toEqual({ abandoned: true, waiterCount: 0 });
  });

  it("deliver resolves wait with a kernel session token", async () => {
    const pending = testEnv.PENDING_LOGIN.get(testEnv.PENDING_LOGIN.newUniqueId());
    const attempt = new LoginAttemptImpl(pending);
    const waiting = attempt.wait();
    await pending.deliver("admin:gatekeeper-secret");
    await expect(waiting).resolves.toBe("admin:gatekeeper-secret");
  });
});
