import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fixtureId, resetIdSequence } from "registry";
import { userPrincipal } from "identity/principal";
import { ownerOf } from "control-plane";
import { ConnectivityError, loopbackSafeFetch } from "connectivity";
import { FilesSlice, actorContext, requestContext } from "./slice.js";
import { dryRunIdentityMapping, FILE_METADATA_FIELDS, LEGACY_FILE_TABLES } from "./mapping.js";
import { FILE_COMMAND_IDS, N14_PARITY_COMMAND_IDS } from "./commands.js";
import { IMAGE_PROXY, FILES_HTTP_ROUTE, UPLOAD_STATES } from "./types.js";
import { FilesError } from "./errors.js";
import { FileWorkspace } from "./ui.js";
import { defaultSafeFetch, proxyImage } from "./unfurl.js";

const tenant = fixtureId("team", 1);
const ownerId = fixtureId("user", 1);
const outsiderId = fixtureId("user", 3);
const otherTenant = fixtureId("team", 2);

const ADVERSARIAL_URLS = [
  "http://localhost/secret",
  "http://127.0.0.1/admin",
  "http://169.254.169.254/latest/meta-data/",
  "file:///etc/passwd",
  "http://evil.test/redirect?url=http://169.254.169.254/",
] as const;

function ownerActor() {
  return actorContext(userPrincipal(ownerId, tenant));
}

function outsiderActor() {
  return actorContext(userPrincipal(outsiderId, otherTenant));
}

function src(name: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), name), "utf8");
}

describe("N14 static files / unfurl (05-MAP row 16)", () => {
  it("maps reconstructed DynamoDB static-file rows without writing (OD-1 Branch A)", () => {
    const slice = new FilesSlice();
    expect(LEGACY_FILE_TABLES).toEqual(["static_files", "s3_objects"]);
    expect(FILE_METADATA_FIELDS).toEqual(["name", "content_type", "extension_data", "upload_state"]);
    const mapped = dryRunIdentityMapping([
      { table: "static_files", dynamoKey: "SF#42", n: 42 },
      { table: "s3_objects", dynamoKey: "s3://bucket/42", n: 42 },
    ]);
    expect(mapped.every((row) => row.wrote === false)).toBe(true);
    expect(mapped[0]).toMatchObject({
      entityType: "static_file",
      role: "metadata",
      mappedId: fixtureId("static_file", 42),
      wrote: false,
    });
    expect(mapped[1]?.role).toBe("blob");
    expect(slice.registry.get(mapped[0]!.mappedId)).toBeNull();
  });

  it("runs the pending→ready upload/download machine and refuses download before ready", () => {
    resetIdSequence();
    const slice = new FilesSlice();
    const api = slice.openApi();
    const ctx = requestContext(ownerActor(), { correlationId: "up-1" });
    const { file, receipt } = api.beginUpload(
      { name: "brief.pdf", contentType: "application/pdf", extensionData: { source: "chat" } },
      ctx,
    );
    expect(file.state).toBe("pending");
    expect(UPLOAD_STATES).toContain("pending");
    expect(file.extensionData).toEqual({ source: "chat" });
    expect(file.size).toBeNull();

    const viewCtx = requestContext(ownerActor(), { receipt, correlationId: "get-1" });
    expect(() => api.download(viewCtx)).toThrow(FilesError);
    expect(() => api.download(viewCtx)).toThrow(/not ready/);

    const bytes = new TextEncoder().encode("hello-r2");
    const afterPut = api.putBlob(file.id, bytes);
    expect(afterPut.state).toBe("pending");
    expect(afterPut.sha).toHaveLength(64);
    expect(afterPut.size).toBe(bytes.byteLength);
    expect(() => api.download(viewCtx)).toThrow(/not ready/);

    const ready = api.finalize(file.id);
    expect(ready.state).toBe("ready");
    const downloaded = api.download(viewCtx);
    expect(new TextDecoder().decode(downloaded.bytes)).toBe("hello-r2");
    expect(api.get(viewCtx).state).toBe("ready");
    expect(api.list([receipt]).map((row) => row.name)).toEqual(["brief.pdf"]);
  });

  it("marks poison uploads failed when finalize runs before the blob PUT", () => {
    resetIdSequence();
    const api = new FilesSlice().openApi();
    const { file } = api.beginUpload({ name: "empty.bin" }, requestContext(ownerActor(), { correlationId: "fail" }));
    const failed = api.finalize(file.id);
    expect(failed.state).toBe("failed");
    expect(failed.failReason).toMatch(/missing blob/);
  });

  it("bulk-deletes ready files behind owner receipts", () => {
    resetIdSequence();
    const api = new FilesSlice().openApi();
    const a = api.beginUpload({ name: "a.txt" }, requestContext(ownerActor(), { correlationId: "a" }));
    const b = api.beginUpload({ name: "b.txt" }, requestContext(ownerActor(), { correlationId: "b" }));
    api.putBlob(a.file.id, new Uint8Array([1]));
    api.putBlob(b.file.id, new Uint8Array([2]));
    api.finalize(a.file.id);
    api.finalize(b.file.id);
    const deleted = api.bulkDelete([
      requestContext(ownerActor(), { receipt: a.receipt, correlationId: "da" }),
      requestContext(ownerActor(), { receipt: b.receipt, correlationId: "db" }),
    ]);
    expect(deleted).toEqual([a.file.id, b.file.id]);
    expect(api.list([a.receipt, b.receipt])).toEqual([]);
  });

  it("denies outsider mint on another tenant's file", () => {
    resetIdSequence();
    const slice = new FilesSlice();
    const { file } = slice.openApi().beginUpload(
      { name: "secret.txt" },
      requestContext(ownerActor(), { correlationId: "sec" }),
    );
    expect(() =>
      slice.engine.mint({
        actor: outsiderActor(),
        entityType: "static_file",
        entityId: file.id,
        need: "view",
      }),
    ).toThrow(/tenant/);
  });
});

describe("05-MAP row 16 SSRF adversarial suite (OD-6 blocked)", () => {
  it("defaults unfurl/image to connectivity blockedSafeFetch", () => {
    const slice = new FilesSlice();
    expect(slice.fetch.kind).toBe("blocked");
    expect(defaultSafeFetch().kind).toBe("blocked");
  });

  it("unfurl and fetchImage throw od6_blocked for localhost, metadata IP, file://, and redirect-like URLs", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const api = new FilesSlice().openApi();
    for (const url of ADVERSARIAL_URLS) {
      await expect(api.unfurl(url)).rejects.toMatchObject({ code: "od6_blocked", name: "ConnectivityError" });
      await expect(api.fetchImage(url)).rejects.toMatchObject({ code: "od6_blocked", name: "ConnectivityError" });
    }
    await expect(api.unfurl("https://example.com/ok")).rejects.toBeInstanceOf(ConnectivityError);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not implement a /proxy image launderer", () => {
    expect(IMAGE_PROXY.implemented).toBe(false);
    expect(IMAGE_PROXY.route).toBeNull();
    expect(IMAGE_PROXY.status).toBe("deferred");
    expect(IMAGE_PROXY.absorbInto).toBe("cloudflare-images");
    expect(FILES_HTTP_ROUTE).toBe("/files/:id");
    expect(() => proxyImage()).toThrow(FilesError);
    expect(() => new FilesSlice().proxyImage()).toThrow(/Cloudflare Images/);
  });

  it("imports blockedSafeFetch from connectivity and never live-fetches request-derived URLs", () => {
    const unfurlSrc = src("unfurl.ts");
    const sliceSrc = src("slice.ts");
    expect(unfurlSrc).toContain('from "connectivity"');
    expect(unfurlSrc).toContain("blockedSafeFetch");
    expect(sliceSrc).toContain('from "connectivity"');
    expect(sliceSrc).toContain("blockedSafeFetch");
    for (const text of [unfurlSrc, sliceSrc, src("store.ts")]) {
      expect(text).not.toMatch(/(?<![.\w])fetch\s*\(/);
      expect(text).not.toMatch(/globalThis\.fetch/);
    }
  });

  it("parses OG cards only after SafeFetch returns (loopback, never live fetch)", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const fetch = loopbackSafeFetch(() => ({
      status: 200,
      body: `<html><meta property="og:title" content="Fixture card" /><meta property="og:site_name" content="Outreach" /></html>`,
    }));
    const card = await new FilesSlice(fetch).unfurl("https://fixture.test/page");
    expect(card.title).toBe("Fixture card");
    expect(card.siteName).toBe("Outreach");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("N14 chrome + STORAGE_OWNERS", () => {
  it("names chrome upload commands and zero direct file command rows", () => {
    expect(FILE_COMMAND_IDS).toHaveLength(0);
    expect(N14_PARITY_COMMAND_IDS).toEqual(["global.upload-files", "global.upload-folders"]);
  });

  it("registers file_blob and file_metadata in STORAGE_OWNERS", () => {
    expect(ownerOf("file_blob").kind).toBe("r2");
    expect(ownerOf("file_blob").owner).toBe("files.MemoryBlobStore");
    expect(ownerOf("file_metadata").kind).toBe("d1");
    expect(ownerOf("file_metadata").owner).toBe("files.FilesSlice");
  });

  it("renders FileWorkspace on Shell /file", () => {
    const html = renderToString(
      createElement(FileWorkspace, {
        files: [
          {
            id: fixtureId("static_file", 1),
            tenantId: tenant,
            ownerId,
            name: "brief.pdf",
            contentType: "application/pdf",
            extensionData: {},
            state: "ready",
            blobKey: "r2:file_1",
            size: 8,
            sha: "abc",
            createdAt: 1,
            updatedAt: 1,
            failReason: null,
          },
        ],
        uploadOpen: true,
        draft: "brief.pdf",
      }),
    );
    expect(html).toContain("data-shell=\"outreach-os\"");
    expect(html).toContain("data-split=\"files\"");
    expect(html).toContain("data-path=\"/files/_\"");
    expect(html).toContain("href=\"/file\"");
    expect(html).toContain("brief.pdf");
    expect(html).toContain("data-command=\"global.upload-files\"");
    expect(html).toContain("data-upload-state=\"ready\"");
    expect(html).toContain("data-status=\"deferred\"");
    expect(html).not.toMatch(/macro/i);
  });
});
