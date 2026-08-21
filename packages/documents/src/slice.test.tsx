import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { grantShare, emptyAccess } from "authz";
import { envelope, ownerOf } from "control-plane";
import { commandEnabled as chromeEnabled, defaultChromeContext, CommandRegistry } from "shell";
import { commandEnabled as soupEnabled, type SoupCommandContext } from "soup";
import { DocumentsSlice, actorContext, requestContext } from "./slice.js";
import { DOCUMENT_TABLES, dryRunIdentityMapping } from "./mapping.js";
import { KERNEL_YJS_PLANE, LIFTED_WORKERS, WORKER_SCHEMAS } from "./workers.js";
import {
  DOCUMENT_COMMAND_IDS,
  DOCUMENT_COMMAND_FREEZE,
  DOCUMENT_COMMAND_FREEZE_COUNT,
  N7_PARITY_COMMAND_IDS,
} from "./commands.js";
import { CONTENT_LOCATIONS, CRDT_PLANES, type ConverterFn } from "./content.js";
import { DocumentWorkspace } from "./ui.js";

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
    facet: null,
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
    supportsBranchName: false,
    hasPriorityProperty: false,
    hasAssigneeProperty: false,
    hasStatusProperty: false,
    allCrmCompanies: false,
    favoriteExists: true,
    ...overrides,
  };
}

describe("N7 documents + projects (05-MAP row 5)", () => {
  it("maps legacy document and project ids without writing (OD-1 Branch A)", () => {
    const slice = new DocumentsSlice();
    const mapped = dryRunIdentityMapping([
      { table: "documents", pgId: 42 },
      { table: "projects", pgId: 7 },
      { table: "document_instance", pgId: 99 },
    ]);
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
    expect(mapped[0]).toMatchObject({
      entityType: "document",
      role: "document",
      mappedId: fixtureId("document", 42),
      wrote: false,
    });
    expect(mapped[1]).toMatchObject({
      entityType: "project",
      role: "folder",
      mappedId: fixtureId("project", 7),
      wrote: false,
    });
    expect(mapped[2]?.role).toBe("version");
    expect(slice.registry.get(mapped[0]!.mappedId)).toBeNull();
    expect(slice.registry.get(mapped[1]!.mappedId)).toBeNull();
  });

  it("creates, edits with a new version, moves into a folder, restores, and updates Soup", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const api = slice.openApi();
    const ctx = requestContext(ownerActor(), { correlationId: "create-1" });
    const { document, receipt } = api.createDocument({ title: "Brief", body: "v1" }, ctx);
    expect(document.facet).toBeNull();
    expect(document.current.location).toBe("ObjectStorage");
    expect(document.versions).toHaveLength(1);
    expect(slice.registry.resolve(document.id, "document").facet).toBeNull();
    expect(slice.registry.resolve(document.id, "document").type).toBe("document");

    expect(api.listDocuments([receipt]).map((item) => item.title)).toEqual(["Brief"]);

    const writeCtx = requestContext(ownerActor(), { receipt, correlationId: "edit-1" });
    const edited = api.editDocument({ title: "Brief v2", body: "v2 body" }, writeCtx);
    expect(edited.version).toBe(2);
    expect(edited.versions).toHaveLength(2);
    expect(edited.versions[1]?.sha).not.toBe(edited.versions[0]?.sha);
    expect(api.listDocuments([receipt])[0]?.title).toBe("Brief v2");

    const { folder, receipt: folderReceipt } = api.createFolder(
      "Outreach",
      requestContext(ownerActor(), { correlationId: "folder-1" }),
    );
    expect(slice.registry.resolve(folder.id, "project").type).toBe("project");
    expect(api.listFolders([folderReceipt]).map((item) => item.title)).toEqual(["Outreach"]);

    const moved = api.moveDocument(folder.id, writeCtx);
    expect(moved.projectId).toBe(folder.id);
    expect(api.listInFolder(folder.id, [receipt]).map((item) => item.entityId)).toEqual([document.id]);
    expect(api.listDocuments([receipt])[0]?.projectId).toBe(folder.id);

    api.deleteDocument(writeCtx);
    expect(api.listDocuments([receipt])).toHaveLength(0);
    expect(slice.get(document.id)?.deleted).toBe(true);

    const restored = api.restoreDocument(writeCtx);
    expect(restored.deleted).toBe(false);
    expect(api.listDocuments([receipt]).map((item) => item.title)).toEqual(["Brief v2"]);
    expect(api.listInFolder(folder.id, [receipt])[0]?.entityId).toBe(document.id);
    expect(slice.activity.list().map((fact) => fact.action)).toEqual([
      "created",
      "edited",
      "created",
      "edited",
      "deleted",
      "edited",
    ]);
    expect(api.listDocuments([])).toHaveLength(0);
  });

  it("exposes all five content locations and never invokes a ConvertedPdf converter", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const api = slice.openApi();
    expect(CONTENT_LOCATIONS).toEqual([
      "ObjectStorage",
      "SyncService",
      "DocxBomParts",
      "ConvertedPdf",
      "Unknown",
    ]);
    const created = CONTENT_LOCATIONS.map((location, index) =>
      api.createDocument(
        { title: location, location, body: `bytes-${index}` },
        requestContext(ownerActor(), { correlationId: `loc-${location}` }),
      ),
    );
    expect(created.map((row) => row.document.current.location)).toEqual([...CONTENT_LOCATIONS]);

    let invoked = 0;
    const converter: ConverterFn = () => {
      invoked += 1;
      throw new Error("converter must not run in N7");
    };
    const handle = slice.attachConvertedPdf(created[0]!.document.id, converter);
    expect(invoked).toBe(0);
    expect(handle.location).toBe("ConvertedPdf");
    expect(api.convertedPdf.attach(created[2]!.document.id, created[2]!.document.current.sha, converter).location).toBe(
      "ConvertedPdf",
    );
    expect(invoked).toBe(0);
    expect(CRDT_PLANES.documentContent).toBe("loro-sync-service");
    expect(CRDT_PLANES.workspaceCode).toBe("kernel-yjs-untouched");
  });

  it("live-subscribes and reconnects without loss or duplication", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const api = slice.openApi();
    const seen: string[] = [];
    const unsub = api.subscribe((delta) => seen.push(`${delta.seq}:${delta.item.title}`));
    const { document, receipt } = api.createDocument(
      { title: "One" },
      requestContext(ownerActor(), { correlationId: "s1" }),
    );
    const cursor = slice.plane.lists.seq;
    unsub();
    api.editDocument({ title: "Two" }, requestContext(ownerActor(), { receipt, correlationId: "s2" }));
    const missed = slice.plane.lists.replayFrom(cursor);
    expect(missed.map((delta) => delta.item.title)).toEqual(["Two"]);
    expect(seen.some((row) => row.endsWith(":One"))).toBe(true);
    expect(missed).toHaveLength(1);
    void document;
  });

  it("rebuilds the projection after drop and poisons failing publishes", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const api = slice.openApi();
    const { document, receipt } = api.createDocument(
      { title: "Keep me" },
      requestContext(ownerActor(), { correlationId: "p1" }),
    );
    slice.rebuildProjection();
    expect(api.listDocuments([receipt])[0]?.title).toBe("Keep me");

    let blows = 0;
    slice.outbox.append(
      envelope({
        topic: "documents",
        entityType: "document",
        entityId: document.id,
        tenantId: tenant,
        actorId: ownerId,
        onBehalfOfId: null,
        occurredAt: 99,
        version: 99,
        payload: { title: "never", facet: null },
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
    expect(api.listDocuments([receipt])[0]?.title).toBe("Keep me");
  });

  it("duplicate create with the same idempotency key is a no-op", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const api = slice.openApi();
    const ctx = requestContext(ownerActor(), { idempotencyKey: "doc-once", correlationId: "id1" });
    const first = api.createDocument({ title: "Once" }, ctx);
    const second = api.createDocument(
      { title: "Once" },
      requestContext(ownerActor(), { idempotencyKey: "doc-once", correlationId: "id2" }),
    );
    expect(second.document.id).toBe(first.document.id);
    expect(api.listDocuments([first.receipt])).toHaveLength(1);
  });

  it("cross-tenant and missing receipts deny; share+revoke hides the row (SEC-1)", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const api = slice.openApi();
    const { document, receipt } = api.createDocument(
      { title: "Secret" },
      requestContext(ownerActor(), { correlationId: "sec" }),
    );
    const other = actorContext(userPrincipal(teammateId, fixtureId("team", 9)));
    expect(() =>
      slice.engine.mint({
        actor: other,
        entityType: "document",
        entityId: document.id,
        need: "view",
      }),
    ).toThrow(/tenant/);

    const shared = grantShare(emptyAccess(ownerId, tenant), teammateId, "comment");
    slice.access.put(document.id, shared);
    const teammate = slice.engine.mint({
      actor: actorContext(userPrincipal(teammateId, tenant)),
      entityType: "document",
      entityId: document.id,
      need: "view",
    });
    expect(api.listDocuments([teammate])).toHaveLength(1);
    slice.access.put(document.id, emptyAccess(ownerId, tenant));
    expect(() =>
      slice.engine.mint({
        actor: actorContext(userPrincipal(teammateId, tenant)),
        entityType: "document",
        entityId: document.id,
        need: "view",
      }),
    ).toThrow(/lacks view/);
    expect(api.listDocuments([])).toHaveLength(0);
    expect(api.listDocuments([receipt])).toHaveLength(1);
  });

  it("names the 71-command freeze and exercises the create/edit/move/restore parity set", () => {
    expect(DOCUMENT_COMMAND_IDS).toHaveLength(DOCUMENT_COMMAND_FREEZE_COUNT);
    expect(DOCUMENT_COMMAND_IDS.filter((id) => id.startsWith("canvas."))).toHaveLength(DOCUMENT_COMMAND_FREEZE.canvas);
    expect(DOCUMENT_COMMAND_IDS.filter((id) => id.startsWith("md."))).toHaveLength(DOCUMENT_COMMAND_FREEZE.md);
    expect(DOCUMENT_COMMAND_IDS.filter((id) => id.startsWith("code."))).toHaveLength(DOCUMENT_COMMAND_FREEZE.code);
    expect(N7_PARITY_COMMAND_IDS).toEqual(expect.arrayContaining(["create-menu.md", "create-menu.project", "document.edit", "document.move", "document.restore"]));

    const chrome = defaultChromeContext({ leader: "c", signedIn: true });
    expect(chromeEnabled("create-menu.md", chrome)).toBe(true);
    expect(chromeEnabled("create-menu.project", chrome)).toBe(true);
    expect(chromeEnabled("create-menu.canvas", chrome)).toBe(true);
    expect(chromeEnabled("create-menu.code", chrome)).toBe(true);
    expect(chromeEnabled("go-to.documents", chrome)).toBe(true);

    resetIdSequence();
    const slice = new DocumentsSlice();
    const { receipt } = slice.openApi().createDocument({ title: "Cmd" }, requestContext(ownerActor(), { correlationId: "c" }));
    const soup = soupCtx({ receipt });
    expect(soupEnabled("soup-entity.rename", soup)).toBe(true);
    expect(soupEnabled("soup-entity.move-to-folder", soup)).toBe(true);

    const registry = new CommandRegistry();
    registry.activateLeader("c");
    registry.register({
      id: "create-menu.md",
      scope: "command-scope-create-menu",
      chord: "d",
      priority: 0,
      registrationType: "override",
      runWithInputFocused: true,
      handle: () => true,
    });
    expect(registry.dispatch({ chord: "d", inputFocused: false, touch: false, platform: "mac" })).toBe("create-menu.md");
  });

  it("renders the document list and compose popovers on the custom React shell", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const api = slice.openApi();
    const { receipt } = api.createDocument(
      { title: "Visible doc" },
      requestContext(ownerActor(), { correlationId: "ui" }),
    );
    const { receipt: folderReceipt } = api.createFolder(
      "Files",
      requestContext(ownerActor(), { correlationId: "ui-folder" }),
    );
    const html = renderToString(
      createElement(DocumentWorkspace, {
        items: api.listDocuments([receipt]),
        folders: api.listFolders([folderReceipt]),
        composeOpen: true,
        folderComposeOpen: true,
        draft: "Visible doc",
        folderDraft: "Files",
      }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-split=\"documents\"");
    expect(html).toContain("Visible doc");
    expect(html).toContain("Files");
    expect(html).toContain("data-scope=\"document-compose-popover\"");
    expect(html).toContain("data-command=\"create-menu.md\"");
    expect(html).toContain("data-command=\"create-menu.project\"");
    expect(html).toContain("aria-label=\"Document title\"");
    expect(html).toContain("data-surface=\"documents.workers\"");
    expect(html).toContain("data-worker=\"sync-service\"");
    expect(html).toContain("data-worker=\"lexical-service\"");
    expect(html).toContain("data-worker=\"ai-editing-worker\"");
    expect(html).not.toMatch(/macro/i);
  });

  it("registers document_authority, folder_edges, and lifted-worker storage in STORAGE_OWNERS", () => {
    expect(ownerOf("document_authority").owner).toBe("documents.DocumentsSlice");
    expect(ownerOf("folder_edges").kind).toBe("d1");
    expect(ownerOf("sync_service_docs").owner).toBe("documents.SyncServiceWorker");
    expect(ownerOf("lexical_documents").kind).toBe("d1");
    expect(ownerOf("edit_traces").owner).toBe("documents.AiEditingWorker");
    expect(ownerOf("folder_upload_jobs").kind).toBe("queue");
  });
});

describe("N7 lifted workers (SUP-555)", () => {
  it("freezes the 15-table document schema as design reference (OD-1)", () => {
    expect(DOCUMENT_TABLES).toHaveLength(15);
    const mapped = dryRunIdentityMapping(DOCUMENT_TABLES.map((table, index) => ({ table, pgId: index + 1 })));
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
  });

  it("names the ruled lift set and keeps kernel Yjs untouched", () => {
    expect(LIFTED_WORKERS).toEqual(["sync-service", "lexical-service", "ai-editing-worker"]);
    expect(KERNEL_YJS_PLANE).toBe("untouched");
    expect(WORKER_SCHEMAS["sync-service"]).toEqual(["sync_documents", "sync_updates"]);
    const slice = new DocumentsSlice();
    expect(() => slice.sync.updateCode()).toThrow(/kernel Yjs is untouched/);
  });

  it("extracts Loro-plane text without writing kernel Yjs", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const { document } = slice.createDocument(
      { title: "Sync me", body: "loro body", location: "SyncService" },
      requestContext(ownerActor(), { correlationId: "sync-1" }),
    );
    const extracted = slice.syncExtract(document.id);
    expect(extracted).toEqual({ documentId: document.id, text: "loro body", version: 1 });
  });

  it("parses markdown into a lexical JSON stand-in", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const { document } = slice.createDocument(
      { title: "Lex", body: "hello lexical" },
      requestContext(ownerActor(), { correlationId: "lex-1" }),
    );
    const parsed = slice.parseLexical(document.id);
    expect(parsed.documentId).toBe(document.id);
    expect(JSON.parse(parsed.json)).toMatchObject({
      type: "root",
      children: [{ type: "paragraph", text: "hello lexical" }],
    });
  });

  it("requires approval before applying an AI edit trace", () => {
    resetIdSequence();
    const slice = new DocumentsSlice();
    const { document } = slice.createDocument(
      { title: "Edit me", body: "draft" },
      requestContext(ownerActor(), { correlationId: "ai-1" }),
    );
    const pending = slice.proposeAiEdit(document.id, "tighten", "tight draft");
    expect(pending.status).toBe("pending");
    expect(() => slice.applyAiEdit(pending.id)).toThrow(/approval/);
    expect(slice.approveAiEdit(pending.id).status).toBe("approved");
    expect(slice.applyAiEdit(pending.id).status).toBe("applied");
    expect(slice.aiEditing.traces()).toHaveLength(1);
  });

  it("runs folder-upload jobs with 0/50/100 progress and idempotent jobId", () => {
    const slice = new DocumentsSlice();
    const first = slice.beginFolderUpload("job_folder_1", "proj_1", ["a.md", "b.md"]);
    expect(first).toMatchObject({ state: "queued", progress: 0 });
    expect(slice.beginFolderUpload("job_folder_1", "proj_1", ["a.md", "b.md"]).progress).toBe(0);
    expect(slice.tickFolderUpload("job_folder_1")).toMatchObject({ state: "running", progress: 50 });
    expect(slice.tickFolderUpload("job_folder_1")).toMatchObject({ state: "succeeded", progress: 100 });
    expect(slice.tickFolderUpload("job_folder_1").state).toBe("succeeded");
  });
});
