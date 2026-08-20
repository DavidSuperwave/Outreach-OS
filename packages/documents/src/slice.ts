import { AccessStore, PolicyEngine, emptyAccess, requireReceipt, type Receipt } from "authz";
import {
  ActivityLog,
  IdempotencyStore,
  Outbox,
  envelope,
  requestContext,
  runOnce,
  type ActivityAction,
  type EventEnvelope,
  type RequestContext,
  type Topic,
} from "control-plane";
import type { ActorContext } from "identity/principal";
import { EntityRegistry, nextId } from "registry";
import { ProjectionPlane, type SoupItem, type SoupListener } from "soup";
import {
  convertedPdfStub,
  inMemoryHandle,
  type ContentHandle,
  type ContentLocation,
  type ConvertedPdfPort,
  type ConverterFn,
  type DocumentKind,
} from "./content.js";

export interface DocumentVersion {
  version: number;
  sha: string;
  location: ContentLocation;
  body: string;
  createdAt: number;
}

export interface DocumentRecord {
  id: string;
  tenantId: string;
  title: string;
  kind: DocumentKind;
  projectId: string | null;
  deleted: boolean;
  version: number;
  current: ContentHandle;
  versions: DocumentVersion[];
  /** G1 core documents are not the task facet (OD-7 / OD-18). */
  facet: null;
}

/** Project = Folder (Q20). Registry type is `project`. */
export interface FolderRecord {
  id: string;
  tenantId: string;
  title: string;
  parentId: string | null;
  deleted: boolean;
  version: number;
}

export type ProjectRecord = FolderRecord;

export interface DocumentView {
  document: DocumentRecord;
  receipt: Receipt;
}

export interface FolderView {
  folder: FolderRecord;
  receipt: Receipt;
}

export interface CreateDocumentInput {
  title: string;
  kind?: DocumentKind;
  location?: ContentLocation;
  body?: string;
  projectId?: string | null;
}

export interface DocumentsApi {
  createDocument(input: CreateDocumentInput, ctx: RequestContext): DocumentView;
  editDocument(patch: { title?: string; body?: string; location?: ContentLocation }, ctx: RequestContext): DocumentRecord;
  moveDocument(projectId: string | null, ctx: RequestContext): DocumentRecord;
  deleteDocument(ctx: RequestContext): DocumentRecord;
  restoreDocument(ctx: RequestContext): DocumentRecord;
  createFolder(title: string, ctx: RequestContext, parentId?: string | null): FolderView;
  listDocuments(receipts: readonly Receipt[]): SoupItem[];
  listFolders(receipts: readonly Receipt[]): SoupItem[];
  listInFolder(projectId: string, receipts: readonly Receipt[]): SoupItem[];
  subscribe(listener: SoupListener): () => void;
  convertedPdf: ConvertedPdfPort;
}

/**
 * Authoritative document store is G1 core (not annotations, not tasks).
 * Folders are `project` entities. Outbox drain is the async side effect;
 * Soup is the projection; ActivityLog is audit.
 */
export class DocumentsSlice {
  readonly registry = new EntityRegistry();
  readonly access = new AccessStore();
  readonly engine = new PolicyEngine(this.registry, this.access);
  outbox = new Outbox();
  plane = new ProjectionPlane();
  readonly activity = new ActivityLog();
  readonly idempotency = new IdempotencyStore();
  readonly convertedPdf = convertedPdfStub();
  #docs = new Map<string, DocumentRecord>();
  #folders = new Map<string, FolderRecord>();
  #clock = 0;

  openApi(): DocumentsApi {
    return {
      createDocument: (input, ctx) => this.createDocument(input, ctx),
      editDocument: (patch, ctx) => this.editDocument(patch, ctx),
      moveDocument: (projectId, ctx) => this.moveDocument(projectId, ctx),
      deleteDocument: (ctx) => this.deleteDocument(ctx),
      restoreDocument: (ctx) => this.restoreDocument(ctx),
      createFolder: (title, ctx, parentId) => this.createFolder(title, ctx, parentId),
      listDocuments: (receipts) => this.listDocuments(receipts),
      listFolders: (receipts) => this.listFolders(receipts),
      listInFolder: (projectId, receipts) => this.listInFolder(projectId, receipts),
      subscribe: (listener) => this.plane.lists.subscribe(listener),
      convertedPdf: this.convertedPdf,
    };
  }

  createDocument(input: CreateDocumentInput, ctx: RequestContext): DocumentView {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new Error("createDocument requires a tenant-scoped actor");
    const run = () => {
      const id = nextId("document");
      this.registry.register({ type: "document", id, tenantId, createdAt: this.#now(), facet: null });
      this.access.put(id, { ...emptyAccess(ctx.actor.actor.id, tenantId), parentId: input.projectId ?? null });
      const handle = inMemoryHandle(input.location ?? "ObjectStorage", input.body ?? "");
      const createdAt = this.#now();
      const document: DocumentRecord = {
        id,
        tenantId,
        title: input.title,
        kind: input.kind ?? "markdown",
        projectId: input.projectId ?? null,
        deleted: false,
        version: 1,
        current: handle,
        versions: [{ version: 1, sha: handle.sha, location: handle.location, body: handle.body, createdAt }],
        facet: null,
      };
      this.#docs.set(id, document);
      this.#publishDocument(document, ctx, "created");
      const receipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "document",
        entityId: id,
        need: "owner",
      });
      return { document, receipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  createFolder(title: string, ctx: RequestContext, parentId: string | null = null): FolderView {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new Error("createFolder requires a tenant-scoped actor");
    const run = () => {
      const id = nextId("project");
      this.registry.register({ type: "project", id, tenantId, createdAt: this.#now(), facet: null });
      this.access.put(id, { ...emptyAccess(ctx.actor.actor.id, tenantId), parentId });
      const folder: FolderRecord = {
        id,
        tenantId,
        title,
        parentId,
        deleted: false,
        version: 1,
      };
      this.#folders.set(id, folder);
      this.#publishFolder(folder, ctx, "created");
      const receipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "project",
        entityId: id,
        need: "owner",
      });
      return { folder, receipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  editDocument(
    patch: { title?: string; body?: string; location?: ContentLocation },
    ctx: RequestContext,
  ): DocumentRecord {
    return this.#mutateDocument(ctx, "edit", (doc) => {
      if (doc.deleted) throw new Error(`cannot edit a deleted document ${doc.id}`);
      const body = patch.body ?? doc.current.body;
      const location = patch.location ?? doc.current.location;
      const handle = inMemoryHandle(location, body);
      const version = doc.version + 1;
      const createdAt = this.#now();
      return {
        ...doc,
        title: patch.title ?? doc.title,
        current: handle,
        version,
        versions: [
          ...doc.versions,
          { version, sha: handle.sha, location: handle.location, body: handle.body, createdAt },
        ],
      };
    });
  }

  moveDocument(projectId: string | null, ctx: RequestContext): DocumentRecord {
    if (projectId) {
      const folder = this.#folders.get(projectId);
      if (!folder || folder.deleted) throw new Error(`unknown folder ${projectId}`);
    }
    const next = this.#mutateDocument(ctx, "edit", (doc) => {
      if (doc.deleted) throw new Error(`cannot move a deleted document ${doc.id}`);
      return { ...doc, projectId, version: doc.version + 1 };
    });
    const access = this.access.require(next.id);
    this.access.put(next.id, { ...access, parentId: projectId });
    return next;
  }

  deleteDocument(ctx: RequestContext): DocumentRecord {
    return this.#mutateDocument(ctx, "owner", (doc) => {
      if (doc.deleted) throw new Error(`document already deleted ${doc.id}`);
      return { ...doc, deleted: true, version: doc.version + 1 };
    }, "deleted");
  }

  restoreDocument(ctx: RequestContext): DocumentRecord {
    return this.#mutateDocument(ctx, "owner", (doc) => {
      if (!doc.deleted) throw new Error(`document is not deleted ${doc.id}`);
      return { ...doc, deleted: false, version: doc.version + 1 };
    }, "edited");
  }

  /**
   * ConvertedPdf interface only (N15/OD-8). `converter` is accepted so tests can
   * prove it is never invoked.
   */
  attachConvertedPdf(id: string, converter?: ConverterFn): ContentHandle {
    const doc = this.#docs.get(id);
    if (!doc) throw new Error(`unknown document ${id}`);
    return this.convertedPdf.attach(id, doc.current.sha, converter);
  }

  listDocuments(receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["document"], facet: null }, receipts).items;
  }

  listFolders(receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["project"] }, receipts).items;
  }

  listInFolder(projectId: string, receipts: readonly Receipt[]): SoupItem[] {
    return this.plane.lists.query({ types: ["document"], facet: null, projectId }, receipts).items;
  }

  get(id: string): DocumentRecord | undefined {
    return this.#docs.get(id);
  }

  getFolder(id: string): FolderRecord | undefined {
    return this.#folders.get(id);
  }

  /** Drop projection and rebuild from outbox. */
  rebuildProjection(): void {
    this.plane = new ProjectionPlane();
    this.plane.rebuild(this.outbox);
  }

  drain(publish: (env: EventEnvelope) => void = () => undefined): void {
    this.outbox.drain(publish);
    this.plane.ingest(this.outbox);
  }

  #mutateDocument(
    ctx: RequestContext,
    need: "view" | "edit" | "owner",
    patch: (doc: DocumentRecord) => DocumentRecord,
    action: Extract<ActivityAction, "created" | "edited" | "deleted"> = "edited",
  ): DocumentRecord {
    const receipt = ctx.receipt;
    if (!receipt) throw new Error("document mutation requires a receipt");
    requireReceipt(receipt, need, receipt.entityId);
    const current = this.#docs.get(receipt.entityId);
    if (!current) throw new Error(`unknown document ${receipt.entityId}`);
    const next = patch(current);
    this.#docs.set(next.id, next);
    this.#publishDocument(next, ctx, action);
    return next;
  }

  #publishDocument(
    document: DocumentRecord,
    ctx: RequestContext,
    action: Extract<ActivityAction, "created" | "edited" | "deleted">,
  ): void {
    this.#publish({
      topic: "documents",
      entityType: "document",
      entityId: document.id,
      tenantId: document.tenantId,
      version: document.version,
      ctx,
      action,
      payload: {
        title: document.title,
        facet: null,
        body: document.current.body,
        projectId: document.projectId,
        tombstoned: document.deleted,
        location: document.current.location,
        sha: document.current.sha,
        kind: document.kind,
        createdAt: document.versions[0]?.createdAt,
      },
    });
  }

  #publishFolder(
    folder: FolderRecord,
    ctx: RequestContext,
    action: Extract<ActivityAction, "created" | "edited" | "deleted">,
  ): void {
    this.#publish({
      topic: "projects",
      entityType: "project",
      entityId: folder.id,
      tenantId: folder.tenantId,
      version: folder.version,
      ctx,
      action,
      payload: {
        title: folder.title,
        facet: null,
        projectId: folder.parentId,
        tombstoned: folder.deleted,
        createdAt: folder.version,
      },
    });
  }

  #publish(input: {
    topic: Topic;
    entityType: "document" | "project";
    entityId: string;
    tenantId: string;
    version: number;
    ctx: RequestContext;
    action: Extract<ActivityAction, "created" | "edited" | "deleted">;
    payload: Record<string, unknown>;
  }): void {
    const occurredAt = this.#now();
    this.outbox.append(
      envelope({
        topic: input.topic,
        entityType: input.entityType,
        entityId: input.entityId,
        tenantId: input.tenantId,
        actorId: input.ctx.actor.actor.id,
        onBehalfOfId: input.ctx.actor.onBehalfOf?.id ?? null,
        occurredAt,
        version: input.version,
        payload: input.payload,
        receipt: {
          level: input.ctx.receipt?.level ?? "owner",
          entityType: input.entityType,
          entityId: input.entityId,
          actorId: input.ctx.actor.actor.id,
        },
        correlationId: input.ctx.correlationId,
      }),
    );
    this.activity.append({
      id: `${input.action}:${input.entityId}:${input.version}`,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.ctx.actor.actor.id,
      tenantId: input.tenantId,
      occurredAt,
    });
    this.drain();
  }

  #now(): number {
    this.#clock += 1;
    return this.#clock;
  }
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: false };
}

export { requestContext };
