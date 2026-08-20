/**
 * In-process converter job + ConvertedPdf port types (ADR-012 / SUP-562).
 * The live Cloudflare Container is not in this node; jobs are DO-orchestrated
 * queue records over an in-memory R2 stand-in.
 */

export const JOB_TYPES = ["doc-convert", "media-preview"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATES = ["queued", "running", "succeeded", "failed"] as const;
export type JobState = (typeof JOB_STATES)[number];

export const FIXTURE_LABELS = ["golden", "poison"] as const;
export type FixtureLabel = (typeof FIXTURE_LABELS)[number];

export const GOLDEN_DOCX_V1 = "GOLDEN_DOCX_V1";
export const POISON_DOCX = "POISON_DOCX";
export const PDF_PREFIX = "PDF:";

/**
 * Named fixture input. Golden output is `PDF:` + sha256(utf8(GOLDEN_DOCX_V1)).
 * Poison input fails with `convert_failed` and writes no output blob.
 */
export const GOLDEN_FIXTURE_INPUT = GOLDEN_DOCX_V1;
export const POISON_FIXTURE_INPUT = POISON_DOCX;

export interface ConvertJob {
  job_id: string;
  type: JobType;
  fromKey: string;
  toKey: string;
  state: JobState;
  attempts: number;
  error: ConverterJobError | null;
  fixture: FixtureLabel | null;
  createdAt: number;
  updatedAt: number;
}

export type ConverterJobError = "convert_failed" | "preview_unsupported" | "missing_blob";

export interface EnqueueJob {
  job_id: string;
  type: JobType;
  fromKey: string;
  toKey: string;
}

/**
 * Parent copies this into N3 `STORAGE_OWNERS`. Converter owns the job queue
 * only — R2 outputs stay derived artifacts under documents/files.
 */
export const CONVERTER_STORAGE = {
  name: "converter_jobs",
  kind: "queue",
  owner: "converter.ConverterSlice",
  rebuildSource: "idempotent re-enqueue by (input sha, converter version)",
  checkpoint: "converter.jobs",
} as const;

/** No inbound public HTTP (ADR-012). Source `/internal/convert` is not exposed. */
export const CONVERTER_PUBLIC_ROUTE: null = null;

export const CONVERTER_INTERNAL_HTTP = {
  convert: null,
  backfill: null,
  health: null,
} as const;

/**
 * OD-8: ffmpeg-in-container vs Cloudflare Media Transformations. Not elected
 * in this node. The media-preview job type and MediaTransform port stay.
 */
export const FFMPEG_ELECTED = false;

export const CONVERTED_PDF_LOCATION = "ConvertedPdf" as const;

/** Structurally compatible with documents.ContentHandle for ConvertedPdf. */
export interface ContentHandle {
  location: typeof CONVERTED_PDF_LOCATION;
  body: string;
  sha: string;
}

export type ConverterFn = (input: { documentId: string; sourceSha: string }) => ContentHandle;

/**
 * N7 stub ignored `converter`. N15 MUST invoke it, then enqueue+drain a
 * doc-convert job and return the derived ConvertedPdf handle.
 */
export interface ConvertedPdfPort {
  attach(documentId: string, sourceSha: string, converter?: ConverterFn): ContentHandle;
}

/** Pure `{input bytes} → {output bytes}` transformer. No keys, no network. */
export interface ContainerPort {
  transform(input: Uint8Array): Uint8Array;
}

/**
 * Same interface whether ffmpeg rides the container or Media Transformations
 * (OD-8). Unset → `preview_unsupported`.
 */
export type MediaTransformPort = ContainerPort;
