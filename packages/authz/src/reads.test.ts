import { describe, expect, it } from "vitest";
import { N2_PROJECTION_READS, assertAllReadsTagged, filterVisible, readTag } from "./reads.js";
import { AuthzError } from "./receipt.js";
import { actor, seedDocument, teammateId } from "./sec.js";
import { grantShare, revokeShare } from "./access-state.js";

describe("read-side enforcement tagging (ADR-004)", () => {
  it("every registered surface is tagged; favorites.list is enforced (SEC-1)", () => {
    expect(N2_PROJECTION_READS.length).toBeGreaterThan(0);
    assertAllReadsTagged(N2_PROJECTION_READS.map((row) => row.surface));
    expect(readTag("favorites.list").enforcement).toBe("enforced");
    expect(() => readTag("mystery.list")).toThrow(AuthzError);
  });

  it("favorites.list filter drops revoked grants", () => {
    const { engine, docId, state } = seedDocument();
    const shared = grantShare(state, teammateId, "comment");
    const live = engine.mint({
      actor: actor(teammateId),
      entityType: "document",
      entityId: docId,
      need: "view",
      state: shared,
    });
    const rows = [{ entityId: docId, entityType: "document" as const }];
    expect(filterVisible(rows, [live])).toHaveLength(1);
    const revoked = revokeShare(shared, teammateId);
    expect(() =>
      engine.mint({
        actor: actor(teammateId),
        entityType: "document",
        entityId: docId,
        need: "view",
        state: revoked,
      }),
    ).toThrow(AuthzError);
    expect(filterVisible(rows, [])).toHaveLength(0);
    expect(filterVisible(rows, [live])).toHaveLength(1);
  });
});
