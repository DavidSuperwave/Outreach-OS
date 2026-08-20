import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ENTITY_TYPES, fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { emptyAccess, grantShare, commandEnabled as n2Enabled, N2_COMMAND_IDS } from "authz";
import { ownerOf } from "control-plane";
import { commandEnabled as soupEnabled, type SoupCommandContext } from "soup";
import { actorContext, requestContext, TaskProperties } from "./slice.js";
import { dryRunIdentityMapping } from "./mapping.js";
import { N8_PARITY_COMMAND_IDS, PROPERTY_COMMAND_COUNT, PROPERTY_COMMAND_IDS } from "./commands.js";
import {
  KANBAN_NONE,
  PRIORITY_OPTION_IDS,
  STATUS_OPTION_IDS,
  SYSTEM_DEFINITION_IDS,
  SYSTEM_KEY_COUNT,
} from "./system.js";
import { PROPERTY_DATA_TYPES } from "./types.js";
import { resolveStorageType } from "./facet.js";
import { TaskPropertiesWorkspace } from "./ui.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const teammateId = fixtureId("user", 2);

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function soupCtx(overrides: Partial<SoupCommandContext> = {}): SoupCommandContext {
  return {
    receipt: null,
    entityType: "document",
    facet: "task",
    resolvable: true,
    view: "list",
    hasRows: true,
    hasFocus: true,
    focusedIsGroup: false,
    focusedCollapsed: false,
    focusedCollapsible: false,
    selectionCount: 2,
    tabCount: 3,
    searchCollapsed: false,
    hasSearchQuery: false,
    isPreviewController: false,
    commandMenuOpen: false,
    spotlighted: false,
    persistentNav: false,
    goToScopeActive: true,
    deletable: true,
    renamable: true,
    favoritable: true,
    copyable: true,
    movable: true,
    remindable: true,
    shareable: true,
    supportsTags: true,
    supportsBranchName: true,
    hasPriorityProperty: true,
    hasAssigneeProperty: true,
    hasStatusProperty: true,
    allCrmCompanies: false,
    favoriteExists: true,
    ...overrides,
  };
}

describe("N8 task properties (EAV / bulk / kanban-grid)", () => {
  it("maps legacy EAV ids without writing (OD-1 Branch A)", () => {
    const domain = new TaskProperties();
    const mapped = dryRunIdentityMapping([
      { table: "property_definition", pgId: 1 },
      { table: "property_option", pgId: 2 },
      { table: "entity_properties", pgId: 42 },
      { table: "tags", pgId: 3 },
    ]);
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
    expect(mapped[0]).toMatchObject({ role: "definition", wrote: false, storageHint: "schema" });
    expect(mapped[2]).toMatchObject({
      role: "value",
      storageHint: "TASK",
      mappedId: fixtureId("document", 42),
      wrote: false,
    });
    expect(domain.slice.registry.get(mapped[2]!.mappedId)).toBeNull();
  });

  it("keeps the One Task Database invariant (document + facet task, EAV keyed TASK)", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { task, receipt } = api.createTask("Invariant", requestContext(ownerActor(), { correlationId: "inv" }));
    expect(ENTITY_TYPES).not.toContain("task");
    expect(task.facet).toBe("task");
    expect(domain.slice.registry.resolve(task.id, "document").type).toBe("document");
    expect(domain.slice.registry.resolve(task.id, "document").facet).toBe("task");
    expect(resolveStorageType("document", "task")).toBe("TASK");
    expect(api.getEntityProperties(task.id)[SYSTEM_DEFINITION_IDS.status]).toEqual({
      kind: "select",
      optionId: STATUS_OPTION_IDS.todo,
    });
    expect(api.listTasks([receipt])[0]?.entityType).toBe("document");
    expect(api.listTasks([receipt])[0]?.facet).toBe("task");
  });

  it("seeds 18 system keys and refuses deleting them", () => {
    const domain = new TaskProperties();
    const api = domain.openApi();
    expect(SYSTEM_KEY_COUNT).toBe(18);
    const system = api.listDefinitions().filter((row) => row.isSystem && row.id !== "pdef_tags");
    expect(system).toHaveLength(18);
    expect(() => api.deleteDefinition(SYSTEM_DEFINITION_IDS.status, requestContext(ownerActor()))).toThrow(
      /not deletable/,
    );
  });

  it("defines a custom EAV property and writes a typed value", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { receipt } = api.createTask("Custom", requestContext(ownerActor(), { correlationId: "c1" }));
    const definition = api.createDefinition(
      { name: "ICP score", dataType: "number" },
      requestContext(ownerActor(), { correlationId: "def" }),
    );
    expect(definition.isSystem).toBe(false);
    const row = api.setEntityProperty(
      definition.id,
      { kind: "number", number: 9 },
      requestContext(ownerActor(), { receipt, correlationId: "set" }),
    );
    expect(row.storageType).toBe("TASK");
    expect(api.getEntityProperties(receipt.entityId)[definition.id]).toEqual({ kind: "number", number: 9 });
  });

  it("bulk-edits multiple tasks in one RPC and reports per-item authz failures", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const a = api.createTask("A", requestContext(ownerActor(), { correlationId: "a" }));
    const b = api.createTask("B", requestContext(ownerActor(), { correlationId: "b" }));
    domain.slice.access.put(b.task.id, grantShare(emptyAccess(ownerId, tenant), teammateId, "comment"));
    const viewOnly = domain.slice.engine.mint({
      actor: actorContext(userPrincipal(teammateId, tenant)),
      entityType: "document",
      entityId: b.task.id,
      need: "view",
    });
    const result = api.bulkSetOptions(
      {
        targets: [{ receipt: a.receipt }, { receipt: viewOnly }],
        definitionId: SYSTEM_DEFINITION_IDS.status,
        optionIds: [STATUS_OPTION_IDS.inProgress],
      },
      requestContext(ownerActor(), { correlationId: "bulk" }),
    );
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0]?.ok).toBe(true);
    expect(result.results[1]?.ok).toBe(false);
    expect(domain.slice.get(a.task.id)?.status).toBe("in_progress");
    expect(domain.slice.get(b.task.id)?.status).toBe("todo");
  });

  it("keeps kanban columns and the grid list on the same Soup projection (05-MAP row 6)", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const a = api.createTask("Alpha", requestContext(ownerActor(), { correlationId: "ka" }));
    const b = api.createTask("Beta", requestContext(ownerActor(), { correlationId: "kb" }));
    const receipts = [a.receipt, b.receipt];
    const soupIds = api.listTasks(receipts).map((item) => item.entityId).sort();
    const gridIds = api.grid(receipts).map((row) => row.entityId).sort();
    const kanbanIds = api
      .kanban(receipts)
      .flatMap((column) => column.items.map((item) => item.entityId))
      .sort();
    expect(gridIds).toEqual(soupIds);
    expect(kanbanIds).toEqual(soupIds);
    expect(api.kanban(receipts).find((column) => column.optionId === STATUS_OPTION_IDS.todo)?.items).toHaveLength(2);

    api.bulkSetOptions(
      {
        targets: [{ receipt: a.receipt }, { receipt: b.receipt }],
        definitionId: SYSTEM_DEFINITION_IDS.status,
        optionIds: [STATUS_OPTION_IDS.inProgress],
      },
      requestContext(ownerActor(), { correlationId: "move-bulk" }),
    );
    const afterGrid = api.grid(receipts);
    const afterBoard = api.kanban(receipts);
    expect(afterGrid.every((row) => row.values[SYSTEM_DEFINITION_IDS.status]?.kind === "select")).toBe(true);
    expect(
      afterGrid.map((row) => (row.values[SYSTEM_DEFINITION_IDS.status] as { optionId: string }).optionId),
    ).toEqual([STATUS_OPTION_IDS.inProgress, STATUS_OPTION_IDS.inProgress]);
    expect(afterBoard.find((column) => column.optionId === STATUS_OPTION_IDS.inProgress)?.items).toHaveLength(2);
    expect(afterBoard.find((column) => column.optionId === STATUS_OPTION_IDS.todo)?.items).toHaveLength(0);
    expect(afterBoard.flatMap((column) => column.items.map((item) => item.entityId)).sort()).toEqual(soupIds);

    api.moveKanbanCard(
      STATUS_OPTION_IDS.completed,
      requestContext(ownerActor(), { receipt: a.receipt, correlationId: "drag" }),
    );
    expect(domain.slice.get(a.task.id)?.status).toBe("completed");
    expect(domain.slice.get(a.task.id)?.done).toBe(true);
    expect(
      api.kanban(receipts).find((column) => column.optionId === STATUS_OPTION_IDS.completed)?.items[0]?.entityId,
    ).toBe(a.task.id);
    expect(api.grid(receipts).find((row) => row.entityId === a.task.id)?.values[SYSTEM_DEFINITION_IDS.status]).toEqual({
      kind: "select",
      optionId: STATUS_OPTION_IDS.completed,
    });
  });

  it("round-trips all 9 property data types", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { receipt } = api.createTask("Typed", requestContext(ownerActor(), { correlationId: "t" }));
    expect(PROPERTY_DATA_TYPES).toHaveLength(9);
    const samples = {
      text: { kind: "text" as const, text: "hello" },
      number: { kind: "number" as const, number: 3 },
      date: { kind: "date" as const, date: "2026-08-20" },
      select: { kind: "select" as const, optionId: "pdef_custom_0004_opt_a" },
      multi_select: { kind: "multi_select" as const, optionIds: ["pdef_custom_0005_opt_a"] },
      user: { kind: "user" as const, userIds: [ownerId] },
      boolean: { kind: "boolean" as const, flag: true },
      url: { kind: "url" as const, url: "https://example.com" },
      relation: { kind: "relation" as const, entityIds: [receipt.entityId] },
    };
    for (const dataType of PROPERTY_DATA_TYPES) {
      const definition = api.createDefinition(
        {
          name: dataType,
          dataType,
          options: dataType === "select" || dataType === "multi_select" ? [{ key: "a", label: "A" }] : undefined,
        },
        requestContext(ownerActor(), { correlationId: `def-${dataType}` }),
      );
      api.setEntityProperty(
        definition.id,
        samples[dataType],
        requestContext(ownerActor(), { receipt, correlationId: `set-${dataType}` }),
      );
      expect(api.getEntityProperties(receipt.entityId)[definition.id]).toEqual(samples[dataType]);
    }
  });

  it("guards task-only and company-only applicability", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { receipt } = api.createTask("Guard", requestContext(ownerActor(), { correlationId: "g" }));
    expect(() =>
      api.setEntityProperty(
        SYSTEM_DEFINITION_IDS.stage,
        { kind: "select", optionId: null },
        requestContext(ownerActor(), { receipt, correlationId: "stage" }),
      ),
    ).toThrow(/does not apply to TASK/);
    const parent = api.setEntityProperty(
      SYSTEM_DEFINITION_IDS.parentTask,
      { kind: "relation", entityIds: [] },
      requestContext(ownerActor(), { receipt, correlationId: "parent" }),
    );
    expect(parent.storageType).toBe("TASK");
  });

  it("merges tags while preserving entity references", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { receipt } = api.createTask("Tagged", requestContext(ownerActor(), { correlationId: "tg" }));
    const red = api.createTag("red", requestContext(ownerActor(), { correlationId: "tag-red" }));
    const blue = api.createTag("blue", requestContext(ownerActor(), { correlationId: "tag-blue" }));
    api.bulkSetOptions(
      {
        targets: [{ receipt }],
        definitionId: "pdef_tags",
        optionIds: [`pdef_tags_opt_${red.id}`],
      },
      requestContext(ownerActor(), { correlationId: "tag-set" }),
    );
    api.mergeTags(red.id, blue.id, requestContext(ownerActor(), { correlationId: "merge" }));
    const tags = api.getEntityProperties(receipt.entityId).pdef_tags;
    expect(tags).toEqual({ kind: "multi_select", optionIds: [`pdef_tags_opt_${blue.id}`] });
  });

  it("grants assignees edit via AccessState.assigneeIds", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { receipt } = api.createTask("Assign", requestContext(ownerActor(), { correlationId: "as" }));
    api.bulkSetValues(
      {
        targets: [{ receipt }],
        definitionId: SYSTEM_DEFINITION_IDS.assignees,
        value: { kind: "user", userIds: [teammateId] },
      },
      requestContext(ownerActor(), { correlationId: "as-set" }),
    );
    expect(domain.slice.access.get(receipt.entityId)?.assigneeIds).toEqual([teammateId]);
    const teammate = domain.slice.engine.mint({
      actor: actorContext(userPrincipal(teammateId, tenant)),
      entityType: "document",
      entityId: receipt.entityId,
      need: "edit",
    });
    expect(teammate.level).toBe("edit");
    expect(domain.slice.get(receipt.entityId)?.assigneeIds).toEqual([teammateId]);
  });

  it("rebuilds the property index from the properties outbox", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { receipt } = api.createTask("Keep props", requestContext(ownerActor(), { correlationId: "rb" }));
    api.setEntityProperty(
      SYSTEM_DEFINITION_IDS.priority,
      { kind: "select", optionId: PRIORITY_OPTION_IDS.high },
      requestContext(ownerActor(), { receipt, correlationId: "pri" }),
    );
    domain.rebuildProjection();
    expect(api.getEntityProperties(receipt.entityId)[SYSTEM_DEFINITION_IDS.priority]).toEqual({
      kind: "select",
      optionId: PRIORITY_OPTION_IDS.high,
    });
    expect(api.listTasks([receipt])[0]?.title).toBe("Keep props");
    expect(api.kanban([receipt]).find((column) => column.optionId === KANBAN_NONE)).toBeDefined();
  });

  it("duplicate bulk with the same idempotency key is a no-op", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { receipt } = api.createTask("Once", requestContext(ownerActor(), { correlationId: "id1" }));
    const input = {
      targets: [{ receipt }],
      definitionId: SYSTEM_DEFINITION_IDS.priority,
      optionIds: [PRIORITY_OPTION_IDS.high],
    };
    const first = api.bulkSetOptions(input, requestContext(ownerActor(), { idempotencyKey: "bulk-once", correlationId: "b1" }));
    api.bulkSetOptions(
      { ...input, optionIds: [PRIORITY_OPTION_IDS.low] },
      requestContext(ownerActor(), { idempotencyKey: "bulk-once", correlationId: "b2" }),
    );
    expect(first.succeeded).toBe(1);
    expect(api.getEntityProperties(receipt.entityId)[SYSTEM_DEFINITION_IDS.priority]).toEqual({
      kind: "select",
      optionId: PRIORITY_OPTION_IDS.high,
    });
  });

  it("cross-tenant mint denies bulk writes (SEC-1)", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { task } = api.createTask("Secret", requestContext(ownerActor(), { correlationId: "sec" }));
    const other = actorContext(userPrincipal(teammateId, fixtureId("team", 9)));
    expect(() =>
      domain.slice.engine.mint({ actor: other, entityType: "document", entityId: task.id, need: "view" }),
    ).toThrow(/tenant/);
  });

  it("exercises the N2 26-row freeze and N8 parity identities", () => {
    expect(PROPERTY_COMMAND_IDS).toHaveLength(PROPERTY_COMMAND_COUNT);
    expect(PROPERTY_COMMAND_IDS).toEqual(N2_COMMAND_IDS);
    resetIdSequence();
    const domain = new TaskProperties();
    const { receipt } = domain.openApi().createTask("Cmd", requestContext(ownerActor(), { correlationId: "c" }));
    const n2ctx = {
      receipt,
      entityType: "document" as const,
      facet: "task" as const,
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
    };
    for (const id of N2_COMMAND_IDS) {
      expect(typeof n2Enabled(id, n2ctx)).toBe("boolean");
    }
    expect(n2Enabled("block-entity.properties", n2ctx)).toBe(true);
    expect(n2Enabled("property-editor.close", n2ctx)).toBe(true);
    expect(n2Enabled("block-entity.status", n2ctx)).toBe(true);
    expect(n2Enabled("entity.bulk-move-to-project.down", n2ctx)).toBe(true);
    const soup = soupCtx({ receipt });
    expect(soupEnabled("soup-entity.properties", soup)).toBe(true);
    expect(soupEnabled("soup-entity.status", soup)).toBe(true);
    expect(N8_PARITY_COMMAND_IDS).toContain("block-entity.properties");
  });

  it("renders TaskGrid and KanbanBoard on Shell /tasks from the same rows", () => {
    resetIdSequence();
    const domain = new TaskProperties();
    const api = domain.openApi();
    const { receipt } = api.createTask("Visible task", requestContext(ownerActor(), { correlationId: "ui" }));
    const html = renderToString(
      createElement(TaskPropertiesWorkspace, {
        gridRows: api.grid([receipt]),
        kanbanColumns: api.kanban([receipt]),
        composeOpen: true,
        draft: "Visible task",
        editorOpen: true,
        definitions: api.listDefinitions(),
      }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-split=\"tasks\"");
    expect(html).toContain("data-surface=\"soup.tasks.grid\"");
    expect(html).toContain("data-surface=\"soup.tasks.kanban\"");
    expect(html).toContain("Visible task");
    expect(html).toContain("data-scope=\"task-compose-popover\"");
    expect(html).toContain("data-scope=\"property-editor\"");
    expect(html).toContain("data-command=\"property-editor.close\"");
    expect(html).not.toMatch(/macro/i);
    expect(html.match(/data-entity-id="/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("registers property_schema and entity_property_index in STORAGE_OWNERS", () => {
    expect(ownerOf("property_schema").owner).toBe("task-properties.TaskProperties");
    expect(ownerOf("entity_property_index").kind).toBe("d1");
  });
});
