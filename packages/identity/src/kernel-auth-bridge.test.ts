import { SERVICE_SALT as KERNEL_SALT } from "@gadgets/workshop-shared/api";
import { describe, expect, it } from "vitest";
import { afterKernelAuthenticate, assertAdminPolicyAgrees } from "./kernel-auth-bridge.js";
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
