import { describe, expect, it } from "vitest";
import { QUERY_MODULES, listChannelUsers, canToggleCrmKillswitch, directoryTracksDomain, transcriptInheritsCall } from "./queries/index.js";
import { BEHAVIOR_MATRIX } from "./fixtures/behavior-matrix.js";
import { emptyAccess, withMembers, withTeamRole } from "./access-state.js";
import { AccessStore } from "./access-store.js";
import { actor, ownerId, outsiderId, seedEntity, teammateId, tenant } from "./sec.js";
import type { Principal } from "identity/principal";

describe("13 query modules (B3 freeze)", () => {
  it("names exactly the harvested pg_access_repo query set", () => {
    expect(QUERY_MODULES).toEqual([
      "call_access",
      "call_channel",
      "channel_membership",
      "channel_role",
      "channel_users",
      "chat_access",
      "crm_company_access",
      "crm_contact_access",
      "document_access",
      "foreign_entity_access",
      "project_access",
      "team_access",
      "thread_access",
    ]);
    expect(QUERY_MODULES).toHaveLength(13);
    const named = new Set(BEHAVIOR_MATRIX.map((row) => row.module));
    for (const name of QUERY_MODULES) {
      expect(named.has(name), `${name} missing from behavior matrix`).toBe(true);
    }
  });

  it("channel_users lists members to members and denies outsiders", () => {
    const state = withMembers(emptyAccess(ownerId, tenant), [ownerId, teammateId]);
    const store = new AccessStore();
    const member: Principal = actor(teammateId).actor;
    const outsider: Principal = actor(outsiderId).actor;
    expect(listChannelUsers(state, teammateId, { store, actor: member })).toEqual([ownerId, teammateId]);
    expect(listChannelUsers(state, outsiderId, { store, actor: outsider })).toBeNull();
  });

  it("CRM killswitch is team-admin only; directory does not leak tenants", () => {
    const member = withTeamRole(emptyAccess(ownerId, tenant), teammateId, "member");
    const admin = withTeamRole(member, teammateId, "admin");
    expect(canToggleCrmKillswitch(member, teammateId)).toBe(false);
    expect(canToggleCrmKillswitch(admin, teammateId)).toBe(true);
    expect(canToggleCrmKillswitch(admin, ownerId)).toBe(true);
    expect(directoryTracksDomain(tenant, tenant)).toBe(true);
    expect(directoryTracksDomain(tenant, "team_" + "0".repeat(32))).toBe(false);
  });

  it("mint without explicit state reads owning-DO AccessStore", () => {
    const seeded = seedEntity("document", "task");
    const receipt = seeded.engine.mint({
      actor: actor(ownerId),
      entityType: "document",
      entityId: seeded.id,
      need: "owner",
    });
    expect(receipt.actorId).toBe(ownerId);
  });

  it("transcripts inherit the call receipt level", () => {
    expect(transcriptInheritsCall("comment")).toBe("comment");
    expect(transcriptInheritsCall(null)).toBeNull();
  });
});
