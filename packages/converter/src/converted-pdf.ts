import { ConverterError } from "./errors.js";
import type { ConverterSlice } from "./slice.js";
import { contentSha, decodeUtf8, encodeUtf8, fromKeyFor, toKeyFor } from "./store.js";
import {
  CONVERTED_PDF_LOCATION,
  type ContentHandle,
  type ConvertedPdfPort,
  type ConverterFn,
} from "./types.js";

/**
 * Real ConvertedPdf port (N7's stub ignored `converter`). attach always
 * invokes `converter` when provided, then enqueues+drains a doc-convert job
 * and returns `{ location: "ConvertedPdf", body, sha }` from the output blob.
 */
export function createConvertedPdfPort(slice: ConverterSlice): ConvertedPdfPort {
  return {
    attach(documentId: string, sourceSha: string, converter?: ConverterFn): ContentHandle {
      const produced = converter ? converter({ documentId, sourceSha }) : undefined;
      const fromKey = fromKeyFor(documentId, sourceSha);
      const toKey = toKeyFor(documentId, sourceSha);
      if (produced?.body && !slice.blobs.has(fromKey)) {
        slice.blobs.put(fromKey, encodeUtf8(produced.body));
      }
      if (!slice.blobs.has(fromKey)) {
        throw new ConverterError("missing_blob", `no source blob for ${fromKey}`);
      }
      const jobId = `doc-convert:${documentId}:${sourceSha}`;
      slice.enqueue({ job_id: jobId, type: "doc-convert", fromKey, toKey });
      slice.drain();
      const job = slice.get(jobId);
      if (job.state === "failed") {
        throw new ConverterError("convert_failed", job.error ?? "convert_failed");
      }
      const bytes = slice.blobs.get(toKey);
      if (!bytes) throw new ConverterError("missing_blob", `no output blob for ${toKey}`);
      const body = decodeUtf8(bytes);
      return { location: CONVERTED_PDF_LOCATION, body, sha: contentSha(bytes) };
    },
  };
}
