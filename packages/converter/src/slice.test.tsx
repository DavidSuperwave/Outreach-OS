import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ConverterSlice, preview } from "./slice.js";
import {
  CONVERTED_PDF_LOCATION,
  CONVERTER_INTERNAL_HTTP,
  CONVERTER_PUBLIC_ROUTE,
  CONVERTER_STORAGE,
  FFMPEG_ELECTED,
  GOLDEN_DOCX_V1,
  JOB_TYPES,
  POISON_DOCX,
} from "./types.js";
import { CONVERTER_COMMAND_IDS, N15_CHROME_COMMAND_IDS } from "./commands.js";
import { ConverterError } from "./errors.js";
import { contentSha, encodeUtf8, fromKeyFor, toKeyFor } from "./store.js";
import { goldenPdfBody } from "./container.js";
import { ConverterWorkspace } from "./ui.js";
import type { ConverterFn, MediaTransformPort } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

function src(name: string): string {
  return readFileSync(join(here, name), "utf8");
}

function srcFiles(): string[] {
  return readdirSync(here).filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"));
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("N15 golden conversion fixtures (05-MAP row 17)", () => {
  it("converts GOLDEN_DOCX_V1 to PDF: + sha256(input)", () => {
    const slice = new ConverterSlice();
    const input = encodeUtf8(GOLDEN_DOCX_V1);
    slice.blobs.put("in/golden.docx", input);
    const job = slice.enqueue({
      job_id: "job-golden",
      type: "doc-convert",
      fromKey: "in/golden.docx",
      toKey: "out/golden.pdf",
    });
    expect(job.state).toBe("queued");
    expect(job.fixture).toBe("golden");
    const drained = slice.drain();
    expect(drained).toHaveLength(1);
    expect(drained[0]!.state).toBe("succeeded");
    const output = slice.blobs.get("out/golden.pdf");
    expect(output).toBeDefined();
    expect(new TextDecoder().decode(output!)).toBe(goldenPdfBody(input));
    expect(new TextDecoder().decode(output!)).toBe(`PDF:${contentSha(input)}`);
  });

  it("fails POISON_DOCX with convert_failed and does not write an output blob", () => {
    const slice = new ConverterSlice();
    const input = encodeUtf8(POISON_DOCX);
    slice.blobs.put("in/poison.docx", input);
    slice.enqueue({
      job_id: "job-poison",
      type: "doc-convert",
      fromKey: "in/poison.docx",
      toKey: "out/poison.pdf",
    });
    const [job] = slice.drain();
    expect(job!.state).toBe("failed");
    expect(job!.error).toBe("convert_failed");
    expect(job!.fixture).toBe("poison");
    expect(slice.blobs.has("out/poison.pdf")).toBe(false);
    expect(slice.blobs.has("in/poison.docx")).toBe(true);
  });
});

describe("N15 orchestrator jobs", () => {
  it("treats the same job_id as a no-op", () => {
    const slice = new ConverterSlice();
    slice.blobs.put("in/a.docx", encodeUtf8(GOLDEN_DOCX_V1));
    const first = slice.enqueue({
      job_id: "same-id",
      type: "doc-convert",
      fromKey: "in/a.docx",
      toKey: "out/a.pdf",
    });
    const second = slice.enqueue({
      job_id: "same-id",
      type: "doc-convert",
      fromKey: "in/other.docx",
      toKey: "out/other.pdf",
    });
    expect(second).toEqual(first);
    expect(second.fromKey).toBe("in/a.docx");
    slice.drain();
    const third = slice.enqueue({
      job_id: "same-id",
      type: "doc-convert",
      fromKey: "in/a.docx",
      toKey: "out/a.pdf",
    });
    expect(third.state).toBe("succeeded");
    expect(third.attempts).toBe(1);
    slice.drain();
    expect(slice.get("same-id").attempts).toBe(1);
    expect(slice.apply("same-id").state).toBe("succeeded");
    expect(slice.jobs.size).toBe(1);
  });

  it("exposes no public HTTP route", () => {
    const slice = new ConverterSlice();
    expect(CONVERTER_PUBLIC_ROUTE).toBeNull();
    expect(slice.publicRoute()).toBeNull();
    expect(CONVERTER_INTERNAL_HTTP.convert).toBeNull();
    expect(CONVERTER_INTERNAL_HTTP.backfill).toBeNull();
    expect(CONVERTER_INTERNAL_HTTP.health).toBeNull();
    for (const name of srcFiles()) {
      if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
      const text = stripComments(src(name));
      expect(text).not.toMatch(/createServer\s*\(/);
      expect(text).not.toMatch(/\/internal\/convert/);
      expect(text).not.toMatch(/app\.(get|post|use)\s*\(/);
    }
  });

  it("throws preview_unsupported for preview() and media-preview without a MediaTransform port (OD-8)", () => {
    const slice = new ConverterSlice();
    expect(FFMPEG_ELECTED).toBe(false);
    expect(JOB_TYPES).toEqual(["doc-convert", "media-preview"]);
    expect(slice.ffmpegElected).toBe(false);

    expect(() => preview()).toThrow(ConverterError);
    try {
      preview();
    } catch (err) {
      expect(err).toBeInstanceOf(ConverterError);
      expect((err as ConverterError).code).toBe("preview_unsupported");
    }

    try {
      slice.enqueue({
        job_id: "preview-1",
        type: "media-preview",
        fromKey: "in/call.webm",
        toKey: "out/call.jpg",
      });
      throw new Error("expected preview_unsupported");
    } catch (err) {
      expect(err).toBeInstanceOf(ConverterError);
      expect((err as ConverterError).code).toBe("preview_unsupported");
    }

    expect(() =>
      slice.preview({
        job_id: "preview-2",
        type: "media-preview",
        fromKey: "in/call.webm",
        toKey: "out/call.jpg",
      }),
    ).toThrow(ConverterError);

    expect(slice.jobs.size).toBe(0);
  });

  it("runs media-preview through an injected MediaTransform port (same interface)", () => {
    const media: MediaTransformPort = {
      transform: (input) => encodeUtf8(`PREVIEW:${contentSha(input)}`),
    };
    const slice = new ConverterSlice(undefined, media);
    const input = encodeUtf8("recording-bytes");
    slice.blobs.put("in/call.webm", input);
    const job = slice.preview({
      job_id: "preview-ok",
      type: "media-preview",
      fromKey: "in/call.webm",
      toKey: "out/call.jpg",
    });
    expect(job.state).toBe("succeeded");
    expect(job.type).toBe("media-preview");
    expect(new TextDecoder().decode(slice.blobs.get("out/call.jpg")!)).toBe(`PREVIEW:${contentSha(input)}`);
  });
});

describe("ConvertedPdfPort invokes the converter", () => {
  it("calls converter, enqueues+drains a doc-convert job, and returns ConvertedPdf", () => {
    const slice = new ConverterSlice();
    const converter: ConverterFn = vi.fn(() => ({
      location: CONVERTED_PDF_LOCATION,
      body: GOLDEN_DOCX_V1,
      sha: "source-sha",
    }));
    const handle = slice.convertedPdf.attach("doc_1", "source-sha", converter);
    expect(converter).toHaveBeenCalledTimes(1);
    expect(converter).toHaveBeenCalledWith({ documentId: "doc_1", sourceSha: "source-sha" });
    expect(handle.location).toBe("ConvertedPdf");
    expect(handle.body).toBe(goldenPdfBody(encodeUtf8(GOLDEN_DOCX_V1)));
    expect(handle.sha).toBe(contentSha(encodeUtf8(handle.body)));
    const job = slice.get("doc-convert:doc_1:source-sha");
    expect(job.type).toBe("doc-convert");
    expect(job.state).toBe("succeeded");
    expect(slice.blobs.has(fromKeyFor("doc_1", "source-sha"))).toBe(true);
    expect(slice.blobs.has(toKeyFor("doc_1", "source-sha"))).toBe(true);
  });

  it("poison attach invokes converter, fails the job, and leaves authority uncorrupted", () => {
    const slice = new ConverterSlice();
    const converter = vi.fn(() => ({
      location: CONVERTED_PDF_LOCATION,
      body: POISON_DOCX,
      sha: "poison-sha",
    }));
    expect(() => slice.convertedPdf.attach("doc_bad", "poison-sha", converter)).toThrow(ConverterError);
    expect(converter).toHaveBeenCalled();
    const job = slice.get("doc-convert:doc_bad:poison-sha");
    expect(job.state).toBe("failed");
    expect(job.error).toBe("convert_failed");
    expect(slice.blobs.has(fromKeyFor("doc_bad", "poison-sha"))).toBe(true);
    expect(slice.blobs.has(toKeyFor("doc_bad", "poison-sha"))).toBe(false);
  });
});

describe("N15 isolation + chrome + STORAGE_OWNERS", () => {
  it("has no fetch( in converter src except comments", () => {
    for (const name of srcFiles()) {
      if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
      const stripped = stripComments(src(name));
      expect(stripped, name).not.toMatch(/(?<![.\w])fetch\s*\(/);
      expect(stripped, name).not.toMatch(/globalThis\.fetch/);
    }
  });

  it("keeps browser.ts free of node:crypto", () => {
    expect(src("browser.ts")).not.toContain("node:crypto");
    expect(src("ui.tsx")).not.toContain("node:crypto");
    expect(src("browser.ts")).not.toContain('from "./slice');
    expect(src("browser.ts")).not.toContain('from "./store');
    expect(src("browser.ts")).not.toContain('from "./container');
  });

  it("names zero converter command rows", () => {
    expect(CONVERTER_COMMAND_IDS).toHaveLength(0);
    expect(N15_CHROME_COMMAND_IDS).toEqual(["go-to.documents", "go-to.calls"]);
  });

  it("exposes CONVERTER_STORAGE for the parent to copy into STORAGE_OWNERS", async () => {
    expect(CONVERTER_STORAGE).toEqual({
      name: "converter_jobs",
      kind: "queue",
      owner: "converter.ConverterSlice",
      rebuildSource: "idempotent re-enqueue by (input sha, converter version)",
      checkpoint: "converter.jobs",
    });
    try {
      const { ownerOf } = await import("control-plane");
      const row = ownerOf("converter_jobs");
      expect(row.kind).toBe("queue");
      expect(row.owner).toBe("converter.ConverterSlice");
    } catch (err) {
      expect(String(err)).toMatch(/unowned storage: converter_jobs/);
    }
  });

  it("renders ConverterWorkspace on Shell /documents with job states and golden/poison labels", () => {
    const html = renderToString(
      createElement(ConverterWorkspace, {
        jobs: [
          {
            job_id: "job-golden",
            type: "doc-convert",
            fromKey: "in/golden.docx",
            toKey: "out/golden.pdf",
            state: "succeeded",
            attempts: 1,
            error: null,
            fixture: "golden",
            createdAt: 1,
            updatedAt: 2,
          },
          {
            job_id: "job-poison",
            type: "doc-convert",
            fromKey: "in/poison.docx",
            toKey: "out/poison.pdf",
            state: "failed",
            attempts: 1,
            error: "convert_failed",
            fixture: "poison",
            createdAt: 3,
            updatedAt: 4,
          },
        ],
      }),
    );
    expect(html).toContain('data-slice="converter"');
    expect(html).toContain('data-surface="converter.jobs"');
    expect(html).toContain('data-shell="outreach-os"');
    expect(html).toContain('data-split="documents"');
    expect(html).toContain('data-path="/documents/_"');
    expect(html).toContain('href="/documents"');
    expect(html).toContain('data-job-state="succeeded"');
    expect(html).toContain('data-job-state="failed"');
    expect(html).toContain('data-fixture="golden"');
    expect(html).toContain('data-fixture="poison"');
    expect(html).toContain("golden");
    expect(html).toContain("poison");
    expect(html).not.toMatch(/macro/i);
  });
});
