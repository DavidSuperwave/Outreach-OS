/**
 * D1-shaped static-file metadata reconstructed from ADR-010 / 04-TARGET (OD-1
 * Branch A). The live DynamoDB table was never harvested; there is no DynamoDB
 * in this rewrite.
 *
 * Shared conceptually with documents' future ObjectStorage R2 lift: one
 * pending → ready (+ failed) content-state machine.
 */
export const UPLOAD_STATES = ["pending", "ready", "failed"] as const;
export type UploadState = (typeof UPLOAD_STATES)[number];

export interface FileMetadata {
  id: string;
  tenantId: string;
  ownerId: string;
  name: string;
  contentType: string;
  /** Reconstructed DynamoDB `extension_data` JSONB. */
  extensionData: Record<string, unknown>;
  state: UploadState;
  /** Opaque in-memory R2 key. Live object keys stay N14-later. */
  blobKey: string;
  size: number | null;
  sha: string | null;
  createdAt: number;
  updatedAt: number;
  failReason: string | null;
}

export interface FileBlob {
  key: string;
  bytes: Uint8Array;
}

export interface UnfurlCard {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export interface FetchedImage {
  url: string;
  contentType: string;
  body: string;
}

/**
 * Image proxy is defer/kill-leaning (ADR-010 ledger:79). Do not implement a
 * `/proxy` image launderer. Cloudflare Images / Image Resizing may absorb
 * remote-image laundering after the mailbox rebuild.
 */
export const IMAGE_PROXY = {
  status: "deferred",
  implemented: false,
  route: null,
  absorbInto: "cloudflare-images",
  note: "No /proxy image launderer. Cloudflare Images may absorb remote-image laundering after mailbox rebuild (ADR-010).",
} as const;

/** HTTP byte-delivery prefix (R3). Distinct from any image-proxy path. */
export const FILES_HTTP_ROUTE = "/files/:id";
