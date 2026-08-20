import { createHash } from "node:crypto";
import { ConverterError } from "./errors.js";
import type { ConvertJob } from "./types.js";

export interface BlobRecord {
  key: string;
  bytes: Uint8Array;
}

/** In-memory R2 stand-in. The only I/O the orchestrator performs. */
export class MemoryBlobStore {
  #blobs = new Map<string, Uint8Array>();

  put(key: string, bytes: Uint8Array): BlobRecord {
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

/** In-process queue stand-in for `converter_jobs` (kind: queue). */
export class JobStore {
  #jobs = new Map<string, ConvertJob>();

  insert(job: ConvertJob): ConvertJob {
    this.#jobs.set(job.job_id, job);
    return job;
  }

  get(jobId: string): ConvertJob | undefined {
    return this.#jobs.get(jobId);
  }

  require(jobId: string): ConvertJob {
    const job = this.#jobs.get(jobId);
    if (!job) throw new ConverterError("unknown_job", `unknown job ${jobId}`);
    return job;
  }

  update(jobId: string, patch: Partial<ConvertJob>): ConvertJob {
    const current = this.require(jobId);
    const next = { ...current, ...patch, job_id: current.job_id };
    this.#jobs.set(jobId, next);
    return next;
  }

  list(): ConvertJob[] {
    return [...this.#jobs.values()];
  }

  queued(): ConvertJob[] {
    return this.list().filter((job) => job.state === "queued");
  }

  get size(): number {
    return this.#jobs.size;
  }
}

export function contentSha(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function fromKeyFor(documentId: string, sourceSha: string): string {
  return `docx:${documentId}:${sourceSha}`;
}

export function toKeyFor(documentId: string, sourceSha: string): string {
  return `pdf:${documentId}:${sourceSha}`;
}
