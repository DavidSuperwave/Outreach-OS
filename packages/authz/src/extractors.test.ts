import { describe, expect, it } from "vitest";
import {
  EXTRACTOR_MODULES,
  extractBot,
  extractDocument,
  extractEntityPermission,
  extractHistory,
  extractPin,
} from "./extractors/index.js";
import { AuthzError } from "./receipt.js";
import { actor, botActor, ownerId, seedEntity, teammateId } from "./sec.js";
import { grantShare } from "./access-state.js";

describe("14 extractors (B2 freeze)", () => {
  it("names exactly the harvested axum extractor set", () => {
    expect(EXTRACTOR_MODULES).toEqual([
      "bot",
      "call",
      "channel",
      "chat",
      "document",
      "entity_body",
      "entity_permission",
      "foreign_entity",
      "history",
      "pin",
      "project",
      "reminder",
      "team",
      "thread",
    ]);
    expect(EXTRACTOR_MODULES).toHaveLength(14);
  });

  it("document extractor is a compile-time obligation: handlers take receipts not raw ids", () => {
    const seeded = seedEntity("document", "task");
    const receipt = seeded.engine.mint({
      actor: actor(ownerId),
      entityType: "document",
      entityId: seeded.id,
      need: "edit",
      state: seeded.state,
    });
    const edit = extractDocument(receipt, "edit", seeded.id, ownerId);
    expect(edit.entityType).toBe("document");
    expect(() => extractEntityPermission(receipt, seeded.id, ownerId)).not.toThrow();
    const shared = grantShare(seeded.state, teammateId, "comment");
    const comment = seeded.engine.mint({
      actor: actor(teammateId),
      entityType: "document",
      entityId: seeded.id,
      need: "comment",
      state: shared,
    });
    expect(() => extractEntityPermission(comment, seeded.id, teammateId)).toThrow(AuthzError);
    expect(() => extractPin(comment, seeded.id, teammateId, true)).toThrow(AuthzError);
    expect(extractHistory(comment, seeded.id, teammateId).level).toBe("comment");
    expect(() => extractDocument(receipt, "edit", seeded.id, teammateId)).toThrow(/actor mismatch/);
  });

  it("bot extractor rejects non-bot principals", () => {
    const seeded = seedEntity("channel");
    const members = { ...seeded.state, memberIds: [ownerId, teammateId], botToken: botActor().actor.id };
    const human = seeded.engine.mint({
      actor: actor(teammateId),
      entityType: "channel",
      entityId: seeded.id,
      need: "comment",
      state: members,
    });
    expect(() => extractBot(human, actor(teammateId).actor, "comment", seeded.id)).toThrow(/bot principal/);
    const botReceipt = seeded.engine.mint({
      actor: botActor(),
      entityType: "channel",
      entityId: seeded.id,
      need: "comment",
      state: members,
    });
    expect(extractBot(botReceipt, botActor().actor, "comment", seeded.id).entityType).toBe("channel");
  });
});
