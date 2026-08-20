import { env } from "cloudflare:workers";
import { evictDurableObject, reset } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { afterKernelAuthenticate, assertAdminPolicyAgrees } from "../src/kernel-auth-bridge.js";
import { LoginAttemptImpl } from "../src/login-attempt.js";
import { fixtureId } from "../src/ids.js";
import { DurableTeamsApi } from "../src/durable-teams-api.js";
import { parseKernelSessionToken } from "../src/kernel-types.js";
import { KernelPublicApi } from "./kernel-public-api.js";
import type { KernelPasswordUser } from "./kernel-password-user.js";
import type { PendingLogin } from "./pending-login.js";
import type { TeamDurableObject } from "../src/team-do.js";

const testEnv = env as unknown as {
  TEAM: DurableObjectNamespace<TeamDurableObject>;
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

describe("contract:capability-lifecycle — PublicApi.login/createAccount/authenticate", () => {
  it("seeded admin createAccount → login → authenticate → owner role (05-MAP row 1)", async () => {
    const publicApi = new KernelPublicApi(testEnv.KERNEL_USER);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(adminSession);

    const created = await publicApi.createAccount("admin", "Admin", adminPassword);
    expect(created).toMatch(/^admin:/);
    const token = await publicApi.login("admin", adminPassword);
    expect(token).toMatch(/^admin:/);
    const session = await publicApi.authenticate(token!);
    expect(session.username).toBe("admin");
    expect(session.whoami.id).toBe("admin");

    const team = await teams.createTeam(adminSession, "Outreach");
    const ctx = afterKernelAuthenticate(teams, token!);
    expect(ctx.kernelUsername).toBe("admin");
    expect(ctx.isDeploymentAdmin).toBe(true);
    expect(ctx.actor.id).toBe(adminSession.userId);
    expect(await teams.resolveEffectiveRole(adminSession, team.id)).toBe("owner");
    assertAdminPolicyAgrees("admin", true, teams.adminPolicy);
  });

  it("seeded member is not deployment admin and resolves member after kernel login", async () => {
    const publicApi = new KernelPublicApi(testEnv.KERNEL_USER);
    const teams = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    teams.registerKernelUser(adminSession);
    teams.registerKernelUser(memberSession);

    await publicApi.createAccount("admin", "Admin", adminPassword);
    await publicApi.createAccount("member", "Member", memberPassword);
    const team = await teams.createTeam(adminSession, "Outreach");
    const invite = await teams.invite(adminSession, team.id, "member", "member", "seed");
    await teams.acceptInvite(memberSession, team.id, invite.id);

    const token = await publicApi.login("member", memberPassword);
    await publicApi.authenticate(token!);
    const ctx = afterKernelAuthenticate(teams, token!);
    expect(ctx.isDeploymentAdmin).toBe(false);
    expect(await teams.resolveEffectiveRole(memberSession, team.id)).toBe("member");
    assertAdminPolicyAgrees("member", false, teams.adminPolicy);
  });

  it("wrong password returns null; bad token authenticate throws", async () => {
    const publicApi = new KernelPublicApi(testEnv.KERNEL_USER);
    await publicApi.createAccount("admin", "Admin", adminPassword);
    await expect(publicApi.login("admin", new Uint8Array([9]))).resolves.toBeNull();
    await expect(publicApi.authenticate("admin:not-a-real-secret====")).rejects.toThrow(
      /invalid session token/,
    );
  });

  it("session revoke invalidates authenticate (parity: session revoke)", async () => {
    const publicApi = new KernelPublicApi(testEnv.KERNEL_USER);
    const token = await publicApi.createAccount("admin", "Admin", adminPassword);
    await publicApi.authenticate(token!);
    const { username } = parseKernelSessionToken(token!);
    const stub = testEnv.KERNEL_USER.get(testEnv.KERNEL_USER.idFromName(username));
    await evictDurableObject(stub);
    await publicApi.authenticate(token!);
    await publicApi.revokeSession(token!);
    await evictDurableObject(stub);
    await expect(publicApi.authenticate(token!)).rejects.toThrow(/invalid session token/);
    const next = await publicApi.login("admin", adminPassword);
    await expect(publicApi.authenticate(next!)).resolves.toMatchObject({ username: "admin" });
  });

  it("duplicate createAccount returns null (username already exists)", async () => {
    const publicApi = new KernelPublicApi(testEnv.KERNEL_USER);
    expect(await publicApi.createAccount("admin", "Admin", adminPassword)).toMatch(/^admin:/);
    expect(await publicApi.createAccount("admin", "Admin", adminPassword)).toBeNull();
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
