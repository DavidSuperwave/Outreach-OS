import { describe, expect, it } from "vitest";
import { MembershipProjection } from "./projection.js";
import { TeamAuthority } from "./team-authority.js";
import { fixtureId } from "./ids.js";

describe("TeamAuthority snapshot", () => {
  it("round-trips members, invites, and idempotency", () => {
    const owner = fixtureId("user", 1);
    const member = fixtureId("user", 2);
    const team = new TeamAuthority(
      { id: fixtureId("team", 1), name: "Outreach", createdAt: 1 },
      new MembershipProjection(),
    );
    team.bootstrapOwner(owner);
    const invite = team.invite(owner, "member", "member", "k1");
    team.acceptInvite(member, "member", invite.id);
    team.setMemberRole(owner, member, "admin");

    const restored = TeamAuthority.fromSnapshot(team.toSnapshot(), new MembershipProjection());
    expect(restored.roleOf(owner)).toBe("owner");
    expect(restored.roleOf(member)).toBe("admin");
    expect(restored.invite(owner, "member", "member", "k1").id).toBe(invite.id);
    expect(restored.listMembers(owner).map((row) => row.role).sort()).toEqual(["admin", "owner"]);
  });
});
