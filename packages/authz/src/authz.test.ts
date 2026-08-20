import { describe, expect, it } from "vitest";
import { fixtureId } from "registry";
import { grantShare } from "./access-state.js";
import { PolicyEngine } from "./engine.js";
import { AuthzError, isReceipt } from "./receipt.js";
import { requireReceipt } from "./engine.js";
import {
  assertSec1RevokeDenies,
  assertSec2NoEscalate,
  assertSec3CrossTenantDenies,
  secFixtures,
} from "./sec.js";
import type { MatrixRow } from "./sec.js";

const { ownerId, teammateId, outsiderId, actor, seedDocument } = secFixtures();

describe("05-MAP row 2: user × entity × level matrix", () => {
  const rows: MatrixRow[] = [
    {
      name: "owner has owner on their document/task",
      actorId: ownerId,
      need: "owner",
      entityType: "document",
      setup: (state) => state,
      expect: "allow",
    },
    {
      name: "comment share can comment but not edit",
      actorId: teammateId,
      need: "comment",
      entityType: "document",
      setup: (state) => grantShare(state, teammateId, "comment"),
      expect: "allow",
    },
    {
      name: "comment share cannot edit",
      actorId: teammateId,
      need: "edit",
      entityType: "document",
      setup: (state) => grantShare(state, teammateId, "comment"),
      expect: "deny",
    },
    {
      name: "outsider has no view",
      actorId: outsiderId,
      need: "view",
      entityType: "document",
      setup: (state) => state,
      expect: "deny",
    },
    {
      name: "edit share satisfies view",
      actorId: teammateId,
      need: "view",
      entityType: "document",
      setup: (state) => grantShare(state, teammateId, "edit"),
      expect: "allow",
    },
  ];

  for (const row of rows) {
    it(row.name, () => {
      const { engine, docId, state } = seedDocument("task");
      const next = row.setup(state);
      const run = () =>
        engine.mint({
          actor: actor(row.actorId),
          entityType: row.entityType,
          entityId: docId,
          need: row.need,
          state: next,
        });
      if (row.expect === "allow") {
        const receipt = run();
        expect(isReceipt(receipt)).toBe(true);
        expect(receipt.entityType).toBe("document");
        requireReceipt(receipt, row.need, docId);
      } else {
        expect(run).toThrow(AuthzError);
      }
    });
  }
});

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
