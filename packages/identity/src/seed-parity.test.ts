import { describe, expect, it } from "vitest";
import { assertSignInParity } from "./effective-role.js";
import { TeamAuthError } from "./team-authority.js";
import {
  loadSeedFixtures,
  SEED_ADMIN,
  SEED_MEMBER,
  SEED_OUTSIDER,
} from "./seed.js";

describe("05-MAP row 1 parity: seeded user signs in and resolves identical effective role", () => {
  it("admin is deployment admin and team owner after seed load", () => {
    const { api, teamId } = loadSeedFixtures();
    const ctx = api.actorContext(SEED_ADMIN, teamId);
    expect(ctx.isDeploymentAdmin).toBe(true);
    expect(api.resolveEffectiveRole(SEED_ADMIN, teamId)).toBe("owner");
    assertSignInParity(api.projection.all(), {
      kernelUsername: "admin",
      userId: SEED_ADMIN.userId,
      teamId,
      expectedRole: "owner",
      isDeploymentAdmin: true,
    });
  });

  it("member is not deployment admin and resolves team role member", () => {
    const { api, teamId } = loadSeedFixtures();
    const ctx = api.actorContext(SEED_MEMBER, teamId);
    expect(ctx.isDeploymentAdmin).toBe(false);
    expect(api.resolveEffectiveRole(SEED_MEMBER, teamId)).toBe("member");
    assertSignInParity(api.projection.all(), {
      kernelUsername: "member",
      userId: SEED_MEMBER.userId,
      teamId,
      expectedRole: "member",
      isDeploymentAdmin: false,
    });
  });

  it("does not fold deployment admin into team role", () => {
    const { api, teamId } = loadSeedFixtures();
    expect(api.actorContext(SEED_ADMIN).isDeploymentAdmin).toBe(true);
    expect(api.resolveEffectiveRole(SEED_ADMIN, teamId)).toBe("owner");
    expect(api.actorContext(SEED_MEMBER).isDeploymentAdmin).toBe(false);
  });
});

describe("tenant isolation and invites", () => {
  it("outsider cannot list another team's members", () => {
    const { api, teamId } = loadSeedFixtures();
    expect(() => api.listMembers(SEED_OUTSIDER, teamId)).toThrow(TeamAuthError);
    expect(api.resolveEffectiveRole(SEED_OUTSIDER, teamId)).toBeNull();
  });

  it("invite is single-use; replay by the same user is idempotent", () => {
    const { api } = loadSeedFixtures();
    const extra = api.createTeam(SEED_ADMIN, "Extra");
    const invite = api.invite(SEED_ADMIN, extra.id, "outsider", "member", "k1");
    api.registerKernelUser(SEED_OUTSIDER);
    api.acceptInvite(SEED_OUTSIDER, extra.id, invite.id);
    const again = api.acceptInvite(SEED_OUTSIDER, extra.id, invite.id);
    expect(again.role).toBe("member");
    expect(() => api.acceptInvite(SEED_MEMBER, extra.id, invite.id)).toThrow(/already used/);
  });

  it("invite create is idempotent on client key", () => {
    const { api, teamId } = loadSeedFixtures();
    const a = api.invite(SEED_ADMIN, teamId, "outsider", "member", "same-key");
    const b = api.invite(SEED_ADMIN, teamId, "outsider", "member", "same-key");
    expect(a.id).toBe(b.id);
  });

  it("role change is visible on the next resolveEffectiveRole call", () => {
    const { api, teamId } = loadSeedFixtures();
    api.setMemberRole(SEED_ADMIN, teamId, SEED_MEMBER.userId, "admin");
    expect(api.resolveEffectiveRole(SEED_MEMBER, teamId)).toBe("admin");
  });

  it("member cannot mutate team membership", () => {
    const { api, teamId } = loadSeedFixtures();
    expect(() =>
      api.setMemberRole(SEED_MEMBER, teamId, SEED_ADMIN.userId, "member"),
    ).toThrow(/owner or admin/);
  });

  it("cannot demote the last owner", () => {
    const { api, teamId } = loadSeedFixtures();
    expect(() =>
      api.setMemberRole(SEED_ADMIN, teamId, SEED_ADMIN.userId, "member"),
    ).toThrow(/last owner/);
  });
});
