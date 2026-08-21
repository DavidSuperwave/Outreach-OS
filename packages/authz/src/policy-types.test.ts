import { describe, expect, it } from "vitest";
import { AuthzError } from "./receipt.js";
import { seedEntity, secFixtures } from "./sec.js";

const { ownerId, teammateId, outsiderId, actor } = secFixtures();

function mint(
  seeded: ReturnType<typeof seedEntity>,
  actorId: string,
  need: "view" | "comment" | "edit" | "owner",
  state = seeded.state,
) {
  return seeded.engine.mint({
    actor: actor(actorId),
    entityType: seeded.registry.resolve(seeded.id).type,
    entityId: seeded.id,
    need,
    state,
  });
}

describe("per-type policy modules", () => {
  it("channel members get comment; outsiders are denied", () => {
    const seeded = seedEntity("channel");
    const members = { ...seeded.state, memberIds: [ownerId, teammateId] };
    const comment = mint(seeded, teammateId, "comment", members);
    expect(comment.entityType).toBe("channel");
    expect(() => mint(seeded, outsiderId, "view", members)).toThrow(AuthzError);
    expect(() => mint(seeded, teammateId, "owner", members)).toThrow(AuthzError);
  });

  it("team owner has owner; unlisted user has none", () => {
    const seeded = seedEntity("team");
    expect(mint(seeded, ownerId, "owner").level).toBe("owner");
    expect(() => mint(seeded, outsiderId, "view")).toThrow(AuthzError);
  });

  it("user record is self-owner only", () => {
    const seeded = seedEntity("user");
    const self = mint(seeded, ownerId, "owner");
    expect(self.entityType).toBe("user");
    expect(() => mint(seeded, teammateId, "view")).toThrow(AuthzError);
  });

  it("project, email_thread, crm_company, and call follow document share lattice", () => {
    for (const type of ["project", "email_thread", "crm_company", "call"] as const) {
      const seeded = seedEntity(type);
      const edit = mint(seeded, ownerId, "edit");
      expect(edit.entityType).toBe(type);
      expect(() => mint(seeded, outsiderId, "view")).toThrow(AuthzError);
    }
  });

  it("foreign_entity and reminder deny outsiders without a share", () => {
    for (const type of ["foreign_entity", "reminder", "chat", "skill"] as const) {
      const seeded = seedEntity(type);
      expect(mint(seeded, ownerId, "view").entityType).toBe(type);
      expect(() => mint(seeded, outsiderId, "view")).toThrow(AuthzError);
    }
  });
});
