import { describe, expect, it } from "vitest";
import { N2_COMMAND_IDS, commandEnabled, type CommandEnableContext } from "./commands.js";
import { mintReceipt } from "./receipt.js";
import { fixtureId } from "registry";
import { ownerId, tenant } from "./sec.js";

const docId = fixtureId("document", 1);

function ctx(overrides: Partial<CommandEnableContext> = {}): CommandEnableContext {
  return {
    receipt: mintReceipt({
      level: "edit",
      entityType: "document",
      entityId: docId,
      actorId: ownerId,
      tenantId: tenant,
    }),
    entityType: "document",
    facet: "task",
    resolvable: true,
    deletable: true,
    renamable: true,
    favoritable: true,
    copyable: true,
    movable: true,
    remindable: true,
    supportsTags: true,
    supportsBranchName: true,
    hasPriorityProperty: true,
    hasAssigneeProperty: true,
    hasStatusProperty: true,
    isCanvas: false,
    inboxOrMailReferral: true,
    ...overrides,
  };
}

describe("N2 command enablement (26 rows)", () => {
  it("freezes exactly 26 ledger identities", () => {
    expect(N2_COMMAND_IDS).toHaveLength(26);
    expect(new Set(N2_COMMAND_IDS).size).toBe(26);
  });

  it("every command id is decidable", () => {
    const enabled = ctx();
    for (const id of N2_COMMAND_IDS) {
      expect(typeof commandEnabled(id, enabled)).toBe("boolean");
    }
  });

  it("copy-id is enabled even when unresolved; delete needs owner", () => {
    expect(commandEnabled("block-entity.copy-id", ctx({ resolvable: false, receipt: null }))).toBe(true);
    expect(
      commandEnabled(
        "block-entity.delete",
        ctx({
          receipt: mintReceipt({
            level: "edit",
            entityType: "document",
            entityId: docId,
            actorId: ownerId,
            tenantId: tenant,
          }),
        }),
      ),
    ).toBe(false);
    expect(
      commandEnabled(
        "block-entity.delete",
        ctx({
          receipt: mintReceipt({
            level: "owner",
            entityType: "document",
            entityId: docId,
            actorId: ownerId,
            tenantId: tenant,
          }),
        }),
      ),
    ).toBe(true);
  });

  it("task-only property commands require document+task facet and edit", () => {
    expect(commandEnabled("block-entity.properties", ctx({ facet: null }))).toBe(false);
    expect(commandEnabled("block-entity.priority", ctx())).toBe(true);
    expect(commandEnabled("block-entity.assignee", ctx({ receipt: null }))).toBe(false);
    expect(commandEnabled("block-entity.status", ctx({ hasStatusProperty: false }))).toBe(false);
  });

  it("mark-done splits inbox vs menu; property-editor.close is always on", () => {
    expect(commandEnabled("block-entity.mark-done", ctx({ inboxOrMailReferral: true }))).toBe(true);
    expect(commandEnabled("block-entity.mark-done-menu", ctx({ inboxOrMailReferral: true }))).toBe(false);
    expect(commandEnabled("block-entity.mark-done-menu", ctx({ inboxOrMailReferral: false }))).toBe(true);
    expect(commandEnabled("property-editor.close", ctx({ receipt: null, resolvable: false }))).toBe(true);
  });
});
