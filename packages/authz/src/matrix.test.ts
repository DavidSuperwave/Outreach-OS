import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { userPrincipal } from "identity/principal";
import {
  emptyAccess,
  grantShare,
  withChannelRole,
  withMembers,
  withTeamRole,
} from "./access-state.js";
import { AuthzError, isReceipt } from "./receipt.js";
import { requireReceipt } from "./engine.js";
import {
  actor,
  botActor,
  ownerId,
  outsiderId,
  seedEntity,
  teammateId,
  tenant,
} from "./sec.js";
import { BEHAVIOR_MATRIX, type BehaviorCell, type MatrixSetup } from "./fixtures/behavior-matrix.js";

function applySetup(setup: MatrixSetup, state: ReturnType<typeof emptyAccess>, store: ReturnType<typeof seedEntity>["store"]) {
  switch (setup) {
    case "owner-only":
      return state;
    case "comment-share":
      return grantShare(state, teammateId, "comment");
    case "edit-share":
      return grantShare(state, teammateId, "edit");
    case "channel-member":
      return withChannelRole(withMembers(state, [ownerId, teammateId]), teammateId, "member");
    case "channel-admin":
      return withChannelRole(withMembers(state, [ownerId, teammateId]), teammateId, "admin");
    case "inbox-delegate":
      return { ...state, inboxDelegateIds: [teammateId] };
    case "email-link":
      return { ...state, emailLinkUserIds: [teammateId] };
    case "project-inherit": {
      const parentId = fixtureId("project", 99);
      store.put(parentId, grantShare(emptyAccess(ownerId, tenant), teammateId, "comment"));
      return { ...state, parentId };
    }
    case "crm-member":
      return withTeamRole(withMembers(state, [ownerId, teammateId]), teammateId, "member");
    case "crm-admin":
      return withTeamRole(withMembers(state, [ownerId, teammateId]), teammateId, "admin");
    case "call-in-channel": {
      const channelId = fixtureId("channel", 99);
      store.put(channelId, withMembers(emptyAccess(ownerId, tenant), [ownerId, teammateId]));
      return { ...state, callChannelId: channelId };
    }
    case "team-admin":
      return withTeamRole(withMembers(state, [ownerId, teammateId]), teammateId, "admin");
    case "team-member":
      return withTeamRole(withMembers(state, [ownerId, teammateId]), teammateId, "member");
    case "assignee":
      return { ...state, assigneeIds: [teammateId] };
    case "bot-token":
      return { ...state, botToken: `mbot_${"a".repeat(12)}_${"b".repeat(64)}` };
    case "on-behalf-of-comment":
      return grantShare(state, teammateId, "comment");
  }
}

function actorFor(cell: BehaviorCell) {
  if (cell.setup === "on-behalf-of-comment") {
    return { ...actor(outsiderId), onBehalfOf: userPrincipal(teammateId, tenant) };
  }
  if (cell.actor === "bot") return botActor();
  const id = cell.actor === "owner" ? ownerId : cell.actor === "teammate" ? teammateId : outsiderId;
  return actor(id);
}

describe("05-MAP row 2 harvested behavior matrix", () => {
  it("covers owner × comment-share × outsider on a task-facet document", () => {
    const task = BEHAVIOR_MATRIX.filter((row) => row.module === "document_task");
    expect(task.length).toBeGreaterThanOrEqual(12);
    const actors = new Set(task.map((row) => row.actor));
    const needs = new Set(task.map((row) => row.need));
    expect(actors).toEqual(new Set(["owner", "teammate", "outsider"]));
    expect(needs).toEqual(new Set(["view", "comment", "edit", "owner"]));
  });

  for (const cell of BEHAVIOR_MATRIX) {
    it(`${cell.module}: ${cell.name}`, () => {
      const seeded = seedEntity(cell.entityType, cell.facet ?? null);
      const next = applySetup(cell.setup, seeded.state, seeded.store);
      seeded.store.put(seeded.id, next);
      const run = () =>
        seeded.engine.mint({
          actor: actorFor(cell),
          entityType: cell.entityType,
          entityId: seeded.id,
          need: cell.need,
          state: next,
        });
      if (cell.expect === "allow") {
        const receipt = run();
        expect(isReceipt(receipt)).toBe(true);
        expect(receipt.entityType).toBe(cell.entityType);
        requireReceipt(receipt, cell.need, seeded.id);
      } else {
        expect(run).toThrow(AuthzError);
      }
    });
  }
});
