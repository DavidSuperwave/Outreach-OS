import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { grantShare, emptyAccess } from "authz";
import { envelope } from "control-plane";
import { commandEnabled as chromeEnabled, defaultChromeContext, CommandRegistry } from "shell";
import { commandEnabled as soupEnabled, type SoupCommandContext } from "soup";
import { TaskSlice, actorContext, requestContext } from "./slice.js";
import { dryRunIdentityMapping } from "./mapping.js";
import { SLICE_COMMAND_IDS, bindSliceCommands, runSliceCommand } from "./commands.js";
import { TaskWorkspace } from "./ui.js";

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
    selectionCount: 1,
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

describe("N6 task vertical slice (11 gates)", () => {
  it("round-trips authority through a JSON snapshot (DO persistence shape)", () => {
    resetIdSequence();
    const slice = new TaskSlice();
    const api = slice.openApi();
    const { task, receipt } = api.createTask("Snap", requestContext(ownerActor(), { correlationId: "snap" }));
    const restored = TaskSlice.fromSnapshot(JSON.parse(JSON.stringify(slice.toSnapshot())));
    expect(restored.get(task.id)?.title).toBe("Snap");
    expect(restored.listTasks([receipt]).map((item) => item.title)).toEqual(["Snap"]);
    expect(restored.activity.list()[0]?.action).toBe("created");
  });

  it("maps legacy task ids without writing (OD-1 Branch A)", () => {
    const slice = new TaskSlice();
    const mapped = dryRunIdentityMapping([{ table: "tasks", pgId: 42 }]);
    expect(mapped[0]?.wrote).toBe(false);
    expect(mapped[0]?.entityType).toBe("document");
    expect(mapped[0]?.facet).toBe("task");
    expect(mapped[0]?.mappedId).toBe(fixtureId("document", 42));
    expect(slice.registry.get(mapped[0]!.mappedId)).toBeNull();
  });

  it("creates, lists, edits, and changes status through the typed capability", () => {
    resetIdSequence();
    const slice = new TaskSlice();
    const api = slice.openApi();
    const ctx = requestContext(ownerActor(), { correlationId: "create-1" });
    const { task, receipt } = api.createTask("Ship the slice", ctx);
    expect(task.facet).toBe("task");
    expect(slice.registry.resolve(task.id, "document").facet).toBe("task");

    const listed = api.listTasks([receipt]);
    expect(listed.map((item) => item.title)).toEqual(["Ship the slice"]);

    const writeCtx = requestContext(ownerActor(), { receipt, correlationId: "edit-1" });
    api.updateTitle("Ship the slice v2", writeCtx);
    api.setStatus("in_progress", writeCtx);
    api.setPriority("high", writeCtx);
    api.setAssignee(ownerId, writeCtx);
    api.markDone(true, writeCtx);

    expect(api.listTasks([receipt])[0]?.title).toBe("Ship the slice v2");
    expect(slice.get(task.id)?.status).toBe("in_progress");
    expect(slice.get(task.id)?.done).toBe(true);
    expect(slice.activity.list().map((fact) => fact.action)).toEqual([
      "created",
      "edited",
      "property_changed",
      "property_changed",
      "property_changed",
      "edited",
    ]);
    expect(api.listTasks([])).toHaveLength(0);
  });

  it("live-subscribes and reconnects without loss or duplication", () => {
    resetIdSequence();
    const slice = new TaskSlice();
    const api = slice.openApi();
    const seen: string[] = [];
    const unsub = api.subscribe((delta) => seen.push(`${delta.seq}:${delta.item.title}`));
    const { task, receipt } = api.createTask("One", requestContext(ownerActor(), { correlationId: "s1" }));
    const cursor = slice.plane.lists.seq;
    unsub();
    api.updateTitle("Two", requestContext(ownerActor(), { receipt, correlationId: "s2" }));
    const missed = slice.plane.lists.replayFrom(cursor);
    expect(missed.map((delta) => delta.item.title)).toEqual(["Two"]);
    expect(seen.some((row) => row.endsWith(":One"))).toBe(true);
    expect(missed).toHaveLength(1);
    void task;
  });

  it("rebuilds the projection after drop and poisons failing publishes (gates 4/5)", () => {
    resetIdSequence();
    const slice = new TaskSlice();
    const api = slice.openApi();
    const { task, receipt } = api.createTask("Keep me", requestContext(ownerActor(), { correlationId: "p1" }));
    slice.rebuildProjection();
    expect(api.listTasks([receipt])[0]?.title).toBe("Keep me");

    let blows = 0;
    slice.outbox.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: task.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 99,
        version: 99,
        payload: { title: "never", facet: "task" },
        receipt: null,
        correlationId: "poison",
      }),
    );
    for (let i = 0; i < 5; i += 1) {
      slice.outbox.drain(() => {
        blows += 1;
        throw new Error("projector down");
      });
    }
    expect(slice.outbox.poison()).toHaveLength(1);
    expect(blows).toBe(5);
    slice.rebuildProjection();
    expect(api.listTasks([receipt])[0]?.title).toBe("Keep me");
  });

  it("duplicate create with the same idempotency key is a no-op", () => {
    resetIdSequence();
    const slice = new TaskSlice();
    const api = slice.openApi();
    const ctx = requestContext(ownerActor(), { idempotencyKey: "task-once", correlationId: "id1" });
    const first = api.createTask("Once", ctx);
    const second = api.createTask("Once", requestContext(ownerActor(), { idempotencyKey: "task-once", correlationId: "id2" }));
    expect(second.task.id).toBe(first.task.id);
    expect(api.listTasks([first.receipt])).toHaveLength(1);
  });

  it("cross-tenant and missing receipts deny; share+revoke hides the row (SEC-1)", () => {
    resetIdSequence();
    const slice = new TaskSlice();
    const api = slice.openApi();
    const { task, receipt } = api.createTask("Secret", requestContext(ownerActor(), { correlationId: "sec" }));
    const other = actorContext(userPrincipal(teammateId, fixtureId("team", 9)));
    expect(() =>
      slice.engine.mint({
        actor: other,
        entityType: "document",
        entityId: task.id,
        need: "view",
      }),
    ).toThrow(/tenant/);

    const shared = grantShare(emptyAccess(ownerId, tenant), teammateId, "comment");
    slice.access.put(task.id, shared);
    const teammate = slice.engine.mint({
      actor: actorContext(userPrincipal(teammateId, tenant)),
      entityType: "document",
      entityId: task.id,
      need: "view",
    });
    expect(api.listTasks([teammate])).toHaveLength(1);
    slice.access.put(task.id, emptyAccess(ownerId, tenant));
    expect(() =>
      slice.engine.mint({
        actor: actorContext(userPrincipal(teammateId, tenant)),
        entityType: "document",
        entityId: task.id,
        need: "view",
      }),
    ).toThrow(/lacks view/);
    expect(api.listTasks([])).toHaveLength(0);
    expect(api.listTasks([receipt])).toHaveLength(1);
  });

  it("exercises 15 slice command identities including c+t and soup tab/property rows", () => {
    expect(SLICE_COMMAND_IDS).toHaveLength(15);
    const chrome = defaultChromeContext({ leader: "c", signedIn: true });
    expect(chromeEnabled("global.create", chrome)).toBe(true);
    expect(chromeEnabled("create-menu.task", chrome)).toBe(true);
    expect(chromeEnabled("launcher.task", defaultChromeContext({ createMenuOpen: true }))).toBe(true);
    expect(chromeEnabled("command-menu.open-category.tasks", chrome)).toBe(true);
    expect(chromeEnabled("go-to.tasks", chrome)).toBe(true);

    resetIdSequence();
    const slice = new TaskSlice();
    const api = slice.openApi();
    const created = runSliceCommand(api, "global.create", requestContext(ownerActor(), { correlationId: "c" }), {
      title: "Cmd",
    });
    if (!created || !("task" in created)) throw new Error("expected TaskView");
    const ctx = requestContext(ownerActor(), { receipt: created.receipt, correlationId: "c-mut" });
    const renamed = runSliceCommand(api, "soup-entity.rename", ctx, { title: "Cmd renamed" });
    expect(renamed && "title" in renamed ? renamed.title : undefined).toBe("Cmd renamed");
    const statused = runSliceCommand(api, "soup-entity.status", ctx, { status: "in_progress" });
    expect(statused && "status" in statused ? statused.status : undefined).toBe("in_progress");
    const prioritized = runSliceCommand(api, "soup-entity.priority", ctx, { priority: "high" });
    expect(prioritized && "priority" in prioritized ? prioritized.priority : undefined).toBe("high");
    const assigned = runSliceCommand(api, "soup-entity.assignee", ctx, { assigneeId: ownerId });
    expect(assigned && "assigneeIds" in assigned ? assigned.assigneeIds : undefined).toEqual([ownerId]);
    const done = runSliceCommand(api, "soup-entity.mark-done", ctx);
    expect(done && "done" in done ? done.done : undefined).toBe(true);
    const undone = runSliceCommand(api, "soup-entity.mark-not-done", ctx);
    expect(undone && "done" in undone ? undone.done : undefined).toBe(false);
    expect(runSliceCommand(api, "soup.open", ctx)).toHaveLength(1);

    const soup = soupCtx({ receipt: created.receipt });
    expect(soupEnabled("soup.tab-1", soup)).toBe(true);
    expect(soupEnabled("soup.open", soup)).toBe(true);
    expect(soupEnabled("soup-entity.mark-done", soup)).toBe(true);
    expect(soupEnabled("soup-entity.mark-not-done", soup)).toBe(true);
    expect(soupEnabled("soup-entity.rename", soup)).toBe(true);
    expect(soupEnabled("soup-entity.properties", soup)).toBe(true);
    expect(soupEnabled("soup-entity.tags", soup)).toBe(true);
    expect(soupEnabled("soup-entity.priority", soup)).toBe(true);
    expect(soupEnabled("soup-entity.assignee", soup)).toBe(true);
    expect(soupEnabled("soup-entity.status", soup)).toBe(true);

    const registry = new CommandRegistry();
    bindSliceCommands(
      registry,
      api,
      () => requestContext(ownerActor(), { correlationId: "c-t" }),
      () => ({ title: "From chord" }),
    );
    registry.activateLeader("c");
    expect(registry.dispatch({ chord: "t", inputFocused: false, touch: false, platform: "mac" })).toBe(
      "create-menu.task",
    );
    expect(slice.toSnapshot().docs.map((doc) => doc.title)).toContain("From chord");
  });

  it("renders the task list and compose popover on the custom React shell", () => {
    resetIdSequence();
    const slice = new TaskSlice();
    const api = slice.openApi();
    const { receipt } = api.createTask("Visible task", requestContext(ownerActor(), { correlationId: "ui" }));
    const html = renderToString(
      createElement(TaskWorkspace, {
        items: api.listTasks([receipt]),
        composeOpen: true,
        draft: "Visible task",
      }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-split=\"tasks\"");
    expect(html).toContain("Visible task");
    expect(html).toContain("data-scope=\"task-compose-popover\"");
    expect(html).toContain("aria-label=\"Task title\"");
    expect(html).not.toMatch(/macro/i);
  });
});
