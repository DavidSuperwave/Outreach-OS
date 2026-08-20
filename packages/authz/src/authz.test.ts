import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { grantShare, revokeShare } from "./access-state.js";
import { AuthzError, isReceipt } from "./receipt.js";
import {
  assertSec1RevokeDenies,
  assertSec2NoEscalate,
  assertSec3CrossTenantDenies,
  secFixtures,
} from "./sec.js";

const { ownerId, teammateId, actor, seedDocument } = secFixtures();

describe("SEC-1/2/3 fixed not recreated", () => {
  it("SEC-1: revoked share cannot view (stale favorites path would deny)", () => {
    assertSec1RevokeDenies();
  });
  it("SEC-2: comment grant cannot escalate to edit", () => {
    assertSec2NoEscalate();
  });
  it("SEC-3: cross-tenant id guess is denied", () => {
    assertSec3CrossTenantDenies();
  });
  it("grant/revoke/re-grant is last-write-wins (replay-safe revocation)", () => {
    const { engine, docId, state } = seedDocument();
    const commented = grantShare(state, teammateId, "comment");
    engine.mint({
      actor: actor(teammateId),
      entityType: "document",
      entityId: docId,
      need: "comment",
      state: commented,
    });
    const revoked = revokeShare(commented, teammateId);
    expect(() =>
      engine.mint({
        actor: actor(teammateId),
        entityType: "document",
        entityId: docId,
        need: "view",
        state: revoked,
      }),
    ).toThrow(AuthzError);
    const regranted = grantShare(revoked, teammateId, "edit");
    const receipt = engine.mint({
      actor: actor(teammateId),
      entityType: "document",
      entityId: docId,
      need: "edit",
      state: regranted,
    });
    expect(isReceipt(receipt)).toBe(true);
  });
});

describe("receipts", () => {
  it("tombstoned entities fail closed", () => {
    const { engine, registry, docId, state } = seedDocument();
    registry.tombstone(docId);
    expect(() =>
      engine.mint({
        actor: actor(ownerId),
        entityType: "document",
        entityId: docId,
        need: "view",
        state,
      }),
    ).toThrow(/tombstoned/);
  });

  it("mintReceipt is not on the public barrel", async () => {
    const barrel = await import("./index.js");
    expect("mintReceipt" in barrel).toBe(false);
  });

  it("plain objects are not receipts", () => {
    expect(
      isReceipt({
        level: "owner",
        entityType: "document",
        entityId: fixtureId("document", 9),
        actorId: ownerId,
        tenantId: fixtureId("team", 1),
      }),
    ).toBe(false);
  });

  it("task facet still mints a document receipt", () => {
    const { engine, docId, state } = seedDocument("task");
    const receipt = engine.mint({
      actor: actor(ownerId),
      entityType: "document",
      entityId: docId,
      need: "edit",
      state,
    });
    expect(receipt.entityType).toBe("document");
  });
});
