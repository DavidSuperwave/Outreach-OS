import { env } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { reset } from "cloudflare:test";
import { fixtureId } from "../src/ids.js";
import { DurableTeamsApi } from "../src/durable-teams-api.js";
import type { TeamDurableObject } from "../src/team-do.js";

const testEnv = env as unknown as {
  TEAM: DurableObjectNamespace<TeamDurableObject>;
};

const admin = { username: "admin", userId: fixtureId("user", 1) };
const member = { username: "member", userId: fixtureId("user", 2) };
const outsider = { username: "outsider", userId: fixtureId("user", 3) };

afterEach(async () => {
  await reset();
});

describe("TeamDurableObject sqlite authority", () => {
  it("survives eviction: invite, accept, role change remain after in-memory teardown", async () => {
    const api = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    api.registerKernelUser(admin);
    api.registerKernelUser(member);
    const team = await api.createTeam(admin, "Outreach");
    const stub = testEnv.TEAM.get(testEnv.TEAM.idFromName(team.id));

    const invite = await api.invite(admin, team.id, "member", "member", "seed-invite");
    await api.acceptInvite(member, team.id, invite.id);
    await api.setMemberRole(admin, team.id, member.userId, "admin");

    await evictDurableObject(stub);

    expect(await api.resolveEffectiveRole(admin, team.id)).toBe("owner");
    expect(await api.resolveEffectiveRole(member, team.id)).toBe("admin");
    const members = await api.listMembers(admin, team.id);
    expect(members.map((row) => row.userId).sort()).toEqual([admin.userId, member.userId].sort());
    const again = await api.invite(admin, team.id, "member", "member", "seed-invite");
    expect(again.id).toBe(invite.id);
  });

  it("enforces tenant isolation and single-use invites after eviction", async () => {
    const api = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    api.registerKernelUser(admin);
    api.registerKernelUser(member);
    api.registerKernelUser(outsider);
    const team = await api.createTeam(admin, "Outreach");
    const stub = testEnv.TEAM.get(testEnv.TEAM.idFromName(team.id));
    const invite = await api.invite(admin, team.id, "outsider", "member", "k1");
    await api.acceptInvite(outsider, team.id, invite.id);
    await evictDurableObject(stub);

    const listDenied = api.listMembers(member, team.id).then(
      () => "listed",
      (error: Error) => error.message,
    );
    expect(await listDenied).toMatch(/only members/);
    const replayDenied = api.acceptInvite(member, team.id, invite.id).then(
      () => "accepted",
      (error: Error) => error.message,
    );
    expect(await replayDenied).toMatch(/already used/);
    expect(await api.resolveEffectiveRole(outsider, team.id)).toBe("member");
    expect(await api.resolveEffectiveRole(member, team.id)).toBeNull();
  });

  it("ensureHomeTeam is idempotent and ensureKernelUser registers a wrapper principal", async () => {
    const api = new DurableTeamsApi(testEnv.TEAM, new Set(["admin"]));
    const session = await api.ensureKernelUser("alice");
    expect(session.username).toBe("alice");
    expect(session.userId.startsWith("usr_")).toBe(true);
    expect((await api.ensureKernelUser("alice")).userId).toBe(session.userId);

    const team = await api.ensureHomeTeam(session);
    expect(team.id.startsWith("team_")).toBe(true);
    expect(team.name).toBe("Outreach");
    const again = await api.ensureHomeTeam(session);
    expect(again.id).toBe(team.id);
    expect(await api.resolveEffectiveRole(session, team.id)).toBe("owner");
  });
});
