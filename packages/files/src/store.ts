import { createHash } from "node:crypto";
import { FilesError } from "./errors.js";
import type { FileBlob, FileMetadata, UploadState } from "./types.js";

/** In-memory R2 stand-in. Bytes never share a store with D1-shaped metadata. */
export class MemoryBlobStore {
  #blobs = new Map<string, Uint8Array>();

  put(key: string, bytes: Uint8Array): FileBlob {
    const copy = bytes.slice();
    this.#blobs.set(key, copy);
    return { key, bytes: copy };
  }

  get(key: string): Uint8Array | undefined {
    const bytes = this.#blobs.get(key);
    return bytes ? bytes.slice() : undefined;
  }

  has(key: string): boolean {
    return this.#blobs.has(key);
  }

  delete(key: string): void {
    this.#blobs.delete(key);
  }

  get size(): number {
    return this.#blobs.size;
  }
}

/** In-process D1 stand-in for the reconstructed static-file metadata table. */
export class FileMetadataStore {
  #rows = new Map<string, FileMetadata>();

  insert(row: FileMetadata): FileMetadata {
    this.#rows.set(row.id, row);
    return row;
  }

  get(id: string): FileMetadata | undefined {
    return this.#rows.get(id);
  }

  require(id: string): FileMetadata {
    const row = this.#rows.get(id);
    if (!row) throw new FilesError("unknown_file", `unknown file ${id}`);
    return row;
  }

  update(id: string, patch: Partial<FileMetadata>): FileMetadata {
    const current = this.require(id);
    const next = { ...current, ...patch, id: current.id };
    this.#rows.set(id, next);
    return next;
  }

  delete(id: string): void {
    this.#rows.delete(id);
  }

  list(): FileMetadata[] {
    return [...this.#rows.values()];
  }

  get size(): number {
    return this.#rows.size;
  }
}

export function blobKeyFor(fileId: string): string {
  return `r2:${fileId}`;
}

export function contentSha(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isUploadState(value: string): value is UploadState {
  return value === "pending" || value === "ready" || value === "failed";
}
