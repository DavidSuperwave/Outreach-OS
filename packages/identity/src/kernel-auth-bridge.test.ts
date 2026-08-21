import { SERVICE_SALT as KERNEL_SALT } from "@gadgets/workshop-shared/api";
import { describe, expect, it } from "vitest";
import { afterKernelAuthenticate, assertAdminPolicyAgrees } from "./kernel-auth-bridge.js";
import { bindKernelSession, SessionBindError } from "./session-bind.js";
import { parseKernelSessionToken } from "./kernel-types.js";
import { SERVICE_SALT } from "./kernel-auth-surface.js";
import { loadSeedFixtures, SEED_ADMIN, SEED_MEMBER } from "./seed.js";

describe("OD-16 kernel auth bridge", () => {
  it("parses the kernel login token shape username:secret", () => {
    expect(parseKernelSessionToken("admin:abc123")).toEqual({
      username: "admin",
      secret: "abc123",
    });
    expect(() => parseKernelSessionToken("nocolon")).toThrow(/invalid kernel session token/);
  });

  it("after kernel authenticate(admin token), seeded admin resolves owner", () => {
    const { api, teamId } = loadSeedFixtures();
    const ctx = afterKernelAuthenticate(api, "admin:kernel-session-secret");
    expect(ctx.kernelUsername).toBe("admin");
    expect(ctx.isDeploymentAdmin).toBe(true);
    expect(ctx.actor.id).toBe(SEED_ADMIN.userId);
    expect(api.resolveEffectiveRole(SEED_ADMIN, teamId)).toBe("owner");
    assertAdminPolicyAgrees("admin", true, api.adminPolicy);
  });

  it("after kernel authenticate(member token), seeded member resolves member not admin", () => {
    const { api, teamId } = loadSeedFixtures();
    const ctx = afterKernelAuthenticate(api, "member:kernel-session-secret");
    expect(ctx.isDeploymentAdmin).toBe(false);
    expect(ctx.actor.id).toBe(SEED_MEMBER.userId);
    expect(api.resolveEffectiveRole(SEED_MEMBER, teamId)).toBe("member");
    assertAdminPolicyAgrees("member", false, api.adminPolicy);
  });

  it("SERVICE_SALT matches the pinned kernel export", () => {
    expect(SERVICE_SALT).toEqual(KERNEL_SALT);
  });
});

describe("bindKernelSession (N1 → N6 actor)", () => {
  it("scopes the seeded admin to the tenant after authenticate", async () => {
    const { api, teamId } = loadSeedFixtures();
    const ctx = await bindKernelSession({
      token: "admin:kernel-session-secret",
      tenantId: teamId,
      directory: api,
      authenticate: async () => undefined,
      memberRole: async (userId, tenant) => api.resolveEffectiveRole(api.users.get(userId)!, tenant),
    });
    expect(ctx.kernelUsername).toBe("admin");
    expect(ctx.actor.tenantId).toBe(teamId);
    expect(ctx.actor.id).toBe(SEED_ADMIN.userId);
  });

  it("rejects an outsider who authenticates but is not a member", async () => {
    const { api, teamId } = loadSeedFixtures();
    try {
      await bindKernelSession({
        token: "outsider:kernel-session-secret",
        tenantId: teamId,
        directory: api,
        authenticate: async () => undefined,
        memberRole: async (userId, tenant) => {
          const session = api.users.get(userId);
          return session ? api.resolveEffectiveRole(session, tenant) : null;
        },
      });
      throw new Error("expected bind to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SessionBindError);
      expect((error as SessionBindError).status).toBe(403);
    }
  });

  it("rejects a failed kernel authenticate as 401", async () => {
    const { api, teamId } = loadSeedFixtures();
    try {
      await bindKernelSession({
        token: "admin:kernel-session-secret",
        tenantId: teamId,
        directory: api,
        authenticate: async () => {
          throw new Error("invalid session token");
        },
        memberRole: async () => "owner",
      });
      throw new Error("expected bind to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SessionBindError);
      expect((error as SessionBindError).status).toBe(401);
    }
  });
});
