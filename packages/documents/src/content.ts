import { createHash } from "node:crypto";

/**
 * Five content locations from `crates/documents/src/domain/content.rs:26-38`.
 * ObjectStorage / SyncService / Unknown are the core trio; DocxBomParts and
 * ConvertedPdf are the named DOCX/PDF pair. N7 stores an in-memory handle —
 * no R2 live uploads.
 */
export const CONTENT_LOCATIONS = [
  "ObjectStorage",
  "SyncService",
  "DocxBomParts",
  "ConvertedPdf",
  "Unknown",
] as const;

export type ContentLocation = (typeof CONTENT_LOCATIONS)[number];

/** Creation flavors that still sit on a content-location (G1 core, not task). */
export const DOCUMENT_KINDS = ["markdown", "canvas", "code"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface ContentHandle {
  location: ContentLocation;
  /** In-memory bytes. R2 object keys are N14. */
  body: string;
  sha: string;
}

export function contentSha(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function inMemoryHandle(location: ContentLocation, body: string): ContentHandle {
  return { location, body, sha: contentSha(body) };
}

/**
 * Two CRDT planes (ADR-008):
 * - Loro is the document content plane. N7 lifts it in-process as
 *   `SyncServiceWorker` (`SyncService` location). No live Loro network.
 * - Kernel Yjs (workspace code, draft/merge/revert) is untouched (ADR-014).
 *   `SyncServiceWorker.updateCode()` throws.
 */
export const CRDT_PLANES = {
  documentContent: "loro-sync-service",
  workspaceCode: "kernel-yjs-untouched",
} as const;

/**
 * N15/OD-8 interface stub. ConvertedPdf is a derived location; the converter
 * substrate is not invoked from N7.
 */
export type ConverterFn = (input: { documentId: string; sourceSha: string }) => ContentHandle;

export interface ConvertedPdfPort {
  /** Always returns a ConvertedPdf handle. Never calls `converter`. */
  attach(documentId: string, sourceSha: string, converter?: ConverterFn): ContentHandle;
}

export function convertedPdfStub(): ConvertedPdfPort {
  return {
    attach(documentId, sourceSha, converter) {
      void documentId;
      void converter;
      return { location: "ConvertedPdf", body: "", sha: sourceSha };
    },
  };
}
