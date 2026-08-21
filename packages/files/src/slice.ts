import { AccessStore, PolicyEngine, emptyAccess, requireReceipt, type Receipt } from "authz";
import { blockedSafeFetch, type SafeFetch } from "connectivity";
import {
  ActivityLog,
  IdempotencyStore,
  requestContext,
  runOnce,
  type RequestContext,
} from "control-plane";
import type { ActorContext } from "identity/principal";
import { EntityRegistry, nextId } from "registry";
import { FilesError } from "./errors.js";
import { blobKeyFor, contentSha, FileMetadataStore, MemoryBlobStore } from "./store.js";
import { IMAGE_PROXY, type FileMetadata, type FetchedImage, type UnfurlCard } from "./types.js";
import { fetchImage, proxyImage, unfurl } from "./unfurl.js";

export interface CreateFileInput {
  name: string;
  contentType?: string;
  extensionData?: Record<string, unknown>;
}

export interface FileView {
  file: FileMetadata;
  receipt: Receipt;
}

export interface FileDownload {
  file: FileMetadata;
  bytes: Uint8Array;
}

export interface FilesApi {
  beginUpload(input: CreateFileInput, ctx: RequestContext): FileView;
  putBlob(fileId: string, bytes: Uint8Array): FileMetadata;
  finalize(fileId: string): FileMetadata;
  download(ctx: RequestContext): FileDownload;
  get(ctx: RequestContext): FileMetadata;
  list(receipts: readonly Receipt[]): FileMetadata[];
  delete(ctx: RequestContext): void;
  bulkDelete(ctxs: readonly RequestContext[]): string[];
  unfurl(url: string): Promise<UnfurlCard>;
  fetchImage(url: string): Promise<FetchedImage>;
}

/**
 * Authoritative file metadata + in-memory R2 stand-in. One pending→ready
 * writer per file id (queue-consumer shape). Unfurl/image egress is the
 * connectivity blockedSafeFetch port — never global fetch.
 */
export class FilesSlice {
  readonly registry = new EntityRegistry();
  readonly access = new AccessStore();
  readonly engine = new PolicyEngine(this.registry, this.access);
  readonly activity = new ActivityLog();
  readonly idempotency = new IdempotencyStore();
  readonly blobs = new MemoryBlobStore();
  readonly metadata = new FileMetadataStore();
  readonly fetch: SafeFetch;
  #clock = 0;

  constructor(fetch: SafeFetch = blockedSafeFetch()) {
    this.fetch = fetch;
  }

  openApi(): FilesApi {
    return {
      beginUpload: (input, ctx) => this.beginUpload(input, ctx),
      putBlob: (fileId, bytes) => this.putBlob(fileId, bytes),
      finalize: (fileId) => this.finalize(fileId),
      download: (ctx) => this.download(ctx),
      get: (ctx) => this.get(ctx),
      list: (receipts) => this.list(receipts),
      delete: (ctx) => this.delete(ctx),
      bulkDelete: (ctxs) => this.bulkDelete(ctxs),
      unfurl: (url) => this.unfurl(url),
      fetchImage: (url) => this.fetchImage(url),
    };
  }

  beginUpload(input: CreateFileInput, ctx: RequestContext): FileView {
    const tenantId = ctx.actor.actor.tenantId;
    if (!tenantId) throw new FilesError("denied", "beginUpload requires a tenant-scoped actor");
    const run = () => {
      const id = nextId("static_file");
      const createdAt = this.#now();
      this.registry.register({ type: "static_file", id, tenantId, createdAt, facet: null });
      this.access.put(id, emptyAccess(ctx.actor.actor.id, tenantId));
      const file: FileMetadata = {
        id,
        tenantId,
        ownerId: ctx.actor.actor.id,
        name: input.name,
        contentType: input.contentType ?? "application/octet-stream",
        extensionData: input.extensionData ?? {},
        state: "pending",
        blobKey: blobKeyFor(id),
        size: null,
        sha: null,
        createdAt,
        updatedAt: createdAt,
        failReason: null,
      };
      this.metadata.insert(file);
      const receipt = this.engine.mint({
        actor: ctx.actor,
        entityType: "static_file",
        entityId: id,
        need: "owner",
      });
      return { file, receipt };
    };
    if (ctx.idempotencyKey) return runOnce(this.idempotency, ctx.idempotencyKey, run);
    return run();
  }

  /** R2 PUT stand-in. Does not flip pending→ready (crash window before notification). */
  putBlob(fileId: string, bytes: Uint8Array): FileMetadata {
    const row = this.metadata.require(fileId);
    this.blobs.put(row.blobKey, bytes);
    return this.metadata.update(fileId, {
      size: bytes.byteLength,
      sha: contentSha(bytes),
      updatedAt: this.#now(),
    });
  }

  /** R2-event / queue-consumer stand-in. Serialized writer per file id. */
  finalize(fileId: string): FileMetadata {
    const row = this.metadata.require(fileId);
    const hasBlob = this.blobs.has(row.blobKey);
    if (!hasBlob) {
      return this.metadata.update(fileId, {
        state: "failed",
        failReason: "missing blob at finalize",
        updatedAt: this.#now(),
      });
    }
    return this.metadata.update(fileId, {
      state: "ready",
      failReason: null,
      updatedAt: this.#now(),
    });
  }

  download(ctx: RequestContext): FileDownload {
    const file = this.#requireView(ctx);
    if (file.state !== "ready") {
      throw new FilesError("not_ready", `file ${file.id} is ${file.state}, not ready`);
    }
    const bytes = this.blobs.get(file.blobKey);
    if (!bytes) throw new FilesError("missing_blob", `blob missing for ${file.id}`);
    return { file, bytes };
  }

  get(ctx: RequestContext): FileMetadata {
    return this.#requireView(ctx);
  }

  list(receipts: readonly Receipt[]): FileMetadata[] {
    const allowed = new Set(receipts.map((receipt) => receipt.entityId));
    return this.metadata.list().filter((row) => allowed.has(row.id));
  }

  delete(ctx: RequestContext): void {
    const receipt = ctx.receipt;
    if (!receipt) throw new FilesError("denied", "delete requires a receipt");
    requireReceipt(receipt, "owner", receipt.entityId);
    const file = this.metadata.require(receipt.entityId);
    this.blobs.delete(file.blobKey);
    this.metadata.delete(file.id);
  }

  bulkDelete(ctxs: readonly RequestContext[]): string[] {
    const ids: string[] = [];
    for (const ctx of ctxs) {
      const id = ctx.receipt?.entityId;
      this.delete(ctx);
      if (id) ids.push(id);
    }
    return ids;
  }

  unfurl(url: string): Promise<UnfurlCard> {
    return unfurl(url, this.fetch);
  }

  fetchImage(url: string): Promise<FetchedImage> {
    return fetchImage(url, this.fetch);
  }

  /** Documented no-op: image proxy is not implemented. */
  proxyImage(): never {
    void IMAGE_PROXY;
    return proxyImage();
  }

  #requireView(ctx: RequestContext): FileMetadata {
    const receipt = ctx.receipt;
    if (!receipt) throw new FilesError("denied", "file read requires a receipt");
    requireReceipt(receipt, "view", receipt.entityId);
    return this.metadata.require(receipt.entityId);
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
