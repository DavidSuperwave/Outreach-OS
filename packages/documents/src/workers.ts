/**
 * N7 lifted workers (SUP-555 / ADR-008). In-process ports — no live
 * Cloudflare Workers, no kernel Yjs writes, no Instantly.
 *
 * Planes:
 * - Document content = Loro sync-service (`SyncService` location)
 * - Workspace code = kernel Yjs (untouched; 182-cap freeze)
 * Bridges are read-only extraction only.
 */

export const LIFTED_WORKERS = ["sync-service", "lexical-service", "ai-editing-worker"] as const;
export type LiftedWorkerId = (typeof LIFTED_WORKERS)[number];

export const KERNEL_YJS_PLANE = "untouched" as const;

export const WORKER_SCHEMAS = {
  "sync-service": ["sync_documents", "sync_updates"],
  "lexical-service": ["lexical_documents"],
  "ai-editing-worker": ["edit_traces"],
} as const;

export interface SyncExtract {
  documentId: string;
  text: string;
  version: number;
}

export class SyncServiceWorker {
  readonly id = "sync-service" as const;
  readonly plane = "loro" as const;
  #docs = new Map<string, { text: string; version: number }>();

  /** Authoritative backend for SyncService-located content. */
  put(documentId: string, text: string, version: number): void {
    this.#docs.set(documentId, { text, version });
  }

  /** ADR-007 /extract_sync successor: read-only text for search. */
  extractSync(documentId: string): SyncExtract | null {
    const row = this.#docs.get(documentId);
    if (!row) return null;
    return { documentId, text: row.text, version: row.version };
  }

  /** Kernel Yjs is a different plane. This worker never calls it. */
  updateCode(): never {
    throw new Error("kernel Yjs is untouched (ADR-008 / ADR-014)");
  }
}

export interface LexicalDocument {
  documentId: string;
  json: string;
  version: number;
}

export class LexicalServiceWorker {
  readonly id = "lexical-service" as const;
  #docs = new Map<string, LexicalDocument>();

  parseMarkdown(documentId: string, markdown: string, version: number): LexicalDocument {
    const json = JSON.stringify({ type: "root", children: [{ type: "paragraph", text: markdown }] });
    const row: LexicalDocument = { documentId, json, version };
    this.#docs.set(documentId, row);
    return row;
  }

  get(documentId: string): LexicalDocument | undefined {
    return this.#docs.get(documentId);
  }
}

export type AiEditStatus = "pending" | "approved" | "applied" | "rejected";

export interface AiEditTrace {
  id: number;
  documentId: string;
  instruction: string;
  proposed: string;
  status: AiEditStatus;
}

export class AiEditingWorker {
  readonly id = "ai-editing-worker" as const;
  #traces: AiEditTrace[] = [];
  #seq = 0;

  propose(documentId: string, instruction: string, proposed: string): AiEditTrace {
    this.#seq += 1;
    const trace: AiEditTrace = { id: this.#seq, documentId, instruction, proposed, status: "pending" };
    this.#traces.push(trace);
    return trace;
  }

  approve(id: number): AiEditTrace {
    const trace = this.#require(id);
    if (trace.status !== "pending") throw new Error(`edit ${id} is ${trace.status}`);
    trace.status = "approved";
    return trace;
  }

  apply(id: number): AiEditTrace {
    const trace = this.#require(id);
    if (trace.status !== "approved") throw new Error("ai-editing apply requires approval");
    trace.status = "applied";
    return trace;
  }

  traces(): readonly AiEditTrace[] {
    return this.#traces;
  }

  #require(id: number): AiEditTrace {
    const trace = this.#traces.find((row) => row.id === id);
    if (!trace) throw new Error(`unknown edit ${id}`);
    return trace;
  }
}

export type FolderUploadState = "queued" | "running" | "succeeded" | "failed";

export interface FolderUploadJob {
  jobId: string;
  folderId: string;
  fileNames: readonly string[];
  state: FolderUploadState;
  progress: number;
}

export class FolderUploadQueue {
  #jobs = new Map<string, FolderUploadJob>();

  begin(jobId: string, folderId: string, fileNames: readonly string[]): FolderUploadJob {
    const existing = this.#jobs.get(jobId);
    if (existing) return existing;
    const job: FolderUploadJob = { jobId, folderId, fileNames, state: "queued", progress: 0 };
    this.#jobs.set(jobId, job);
    return job;
  }

  tick(jobId: string): FolderUploadJob {
    const job = this.#jobs.get(jobId);
    if (!job) throw new Error(`unknown folder upload ${jobId}`);
    if (job.state === "succeeded" || job.state === "failed") return job;
    job.state = "running";
    job.progress = Math.min(100, job.progress + 50);
    if (job.progress >= 100) job.state = "succeeded";
    return job;
  }

  get(jobId: string): FolderUploadJob | undefined {
    return this.#jobs.get(jobId);
  }

  list(): FolderUploadJob[] {
    return [...this.#jobs.values()];
  }
}
