import { ConverterError } from "./errors.js";
import { goldenContainer } from "./container.js";
import { createConvertedPdfPort } from "./converted-pdf.js";
import { decodeUtf8, JobStore, MemoryBlobStore } from "./store.js";
import {
  CONVERTER_PUBLIC_ROUTE,
  FFMPEG_ELECTED,
  GOLDEN_DOCX_V1,
  POISON_DOCX,
  type ContainerPort,
  type ConvertedPdfPort,
  type ConvertJob,
  type EnqueueJob,
  type FixtureLabel,
  type MediaTransformPort,
} from "./types.js";

export interface ConverterApi {
  enqueue(input: EnqueueJob): ConvertJob;
  drain(): ConvertJob[];
  apply(jobId: string): ConvertJob;
  preview(input: EnqueueJob): ConvertJob;
  get(jobId: string): ConvertJob;
  list(): ConvertJob[];
}

/**
 * DO-shaped orchestrator (ADR-012 §4a). Jobs enqueue with `job_id` idempotency;
 * drain/apply dispatch the container; the container never sees keys or the
 * network. No public HTTP route.
 */
export class ConverterSlice {
  readonly blobs = new MemoryBlobStore();
  readonly jobs = new JobStore();
  readonly container: ContainerPort;
  readonly media: MediaTransformPort | null;
  readonly convertedPdf: ConvertedPdfPort;
  #clock = 0;

  constructor(container?: ContainerPort, media: MediaTransformPort | null = null) {
    this.container = container ?? goldenContainer();
    this.media = media;
    this.convertedPdf = createConvertedPdfPort(this);
  }

  openApi(): ConverterApi {
    return {
      enqueue: (input) => this.enqueue(input),
      drain: () => this.drain(),
      apply: (jobId) => this.apply(jobId),
      preview: (input) => this.preview(input),
      get: (jobId) => this.get(jobId),
      list: () => this.list(),
    };
  }

  /** Same `job_id` is a no-op — returns the existing job without re-work. */
  enqueue(input: EnqueueJob): ConvertJob {
    const existing = this.jobs.get(input.job_id);
    if (existing) return existing;
    if (input.type === "media-preview" && !this.media) {
      throw new ConverterError(
        "preview_unsupported",
        "media-preview is OD-8; ffmpeg not elected and no MediaTransform port",
      );
    }
    const now = this.#now();
    return this.jobs.insert({
      job_id: input.job_id,
      type: input.type,
      fromKey: input.fromKey,
      toKey: input.toKey,
      state: "queued",
      attempts: 0,
      error: null,
      fixture: detectFixture(this.blobs, input.fromKey),
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Apply every queued job in enqueue order. */
  drain(): ConvertJob[] {
    const processed: ConvertJob[] = [];
    for (const job of this.jobs.queued()) {
      processed.push(this.apply(job.job_id));
    }
    return processed;
  }

  /** Run one job through the container (or MediaTransform). Terminal jobs no-op. */
  apply(jobId: string): ConvertJob {
    const job = this.jobs.require(jobId);
    if (job.state === "succeeded" || job.state === "failed") return job;
    if (job.type === "media-preview" && !this.media) {
      this.jobs.update(jobId, {
        state: "failed",
        error: "preview_unsupported",
        attempts: job.attempts + 1,
        updatedAt: this.#now(),
      });
      throw new ConverterError(
        "preview_unsupported",
        "media-preview is OD-8; ffmpeg not elected and no MediaTransform port",
      );
    }
    this.jobs.update(jobId, { state: "running", attempts: job.attempts + 1, updatedAt: this.#now() });
    const input = this.blobs.get(job.fromKey);
    if (!input) {
      return this.jobs.update(jobId, {
        state: "failed",
        error: "missing_blob",
        updatedAt: this.#now(),
      });
    }
    try {
      const port = job.type === "media-preview" ? this.media : this.container;
      if (!port) {
        throw new ConverterError("preview_unsupported", "no transform port for job type");
      }
      const output = port.transform(input);
      this.blobs.put(job.toKey, output);
      return this.jobs.update(jobId, {
        state: "succeeded",
        error: null,
        fixture: detectFixture(this.blobs, job.fromKey),
        updatedAt: this.#now(),
      });
    } catch (err) {
      const code = err instanceof ConverterError ? err.code : "convert_failed";
      if (code === "preview_unsupported") {
        this.jobs.update(jobId, {
          state: "failed",
          error: "preview_unsupported",
          updatedAt: this.#now(),
        });
        throw err;
      }
      // Poison / convert_failed: mark failed, do not write toKey, do not delete fromKey.
      return this.jobs.update(jobId, {
        state: "failed",
        error: code === "missing_blob" ? "missing_blob" : "convert_failed",
        updatedAt: this.#now(),
      });
    }
  }

  /**
   * Call-recording preview. Without a MediaTransform port (OD-8 not elected)
   * this throws `preview_unsupported`. Interface stays the same either way.
   */
  preview(input: EnqueueJob): ConvertJob {
    if (!this.media) {
      throw new ConverterError(
        "preview_unsupported",
        "call recording preview is OD-8; ffmpeg not elected and no MediaTransform port",
      );
    }
    const job = this.enqueue({ ...input, type: "media-preview" });
    this.drain();
    return this.get(job.job_id);
  }

  get(jobId: string): ConvertJob {
    return this.jobs.require(jobId);
  }

  list(): ConvertJob[] {
    return this.jobs.list();
  }

  /** Documented absence: no public HTTP listener. */
  publicRoute(): null {
    return CONVERTER_PUBLIC_ROUTE;
  }

  get ffmpegElected(): boolean {
    return FFMPEG_ELECTED;
  }

  #now(): number {
    this.#clock += 1;
    return this.#clock;
  }
}

export function detectFixture(blobs: MemoryBlobStore, fromKey: string): FixtureLabel | null {
  const bytes = blobs.get(fromKey);
  if (!bytes) return null;
  const text = decodeUtf8(bytes);
  if (text === GOLDEN_DOCX_V1) return "golden";
  if (text === POISON_DOCX) return "poison";
  return null;
}

/**
 * Module-level preview used by N13 consumers. Always unsupported until a
 * MediaTransform port is elected (OD-8).
 */
export function preview(): never {
  throw new ConverterError(
    "preview_unsupported",
    "call recording preview is OD-8; ffmpeg not elected and no MediaTransform port",
  );
}
