import { fixtureId } from "registry";

/**
 * OD-1 Branch A: reconstruct the unharvested DynamoDB static-file table from
 * ADR-010 (name, content type, extension_data, upload state) plus the S3/R2
 * blob key. Never writes authorities. No Postgres load. No DynamoDB client.
 */
export const LEGACY_FILE_TABLES = ["static_files", "s3_objects"] as const;
export type LegacyFileTable = (typeof LEGACY_FILE_TABLES)[number];

export interface LegacyFileRef {
  table: LegacyFileTable;
  dynamoKey: string;
  n: number;
}

export interface IdentityMappingResult {
  legacy: LegacyFileRef;
  mappedId: string;
  entityType: "static_file";
  role: "metadata" | "blob";
  fields: readonly string[];
  wrote: false;
}

/** Reconstructed DynamoDB item shape (design, not a harvested table). */
export const FILE_METADATA_FIELDS = ["name", "content_type", "extension_data", "upload_state"] as const;

export function mapLegacyFileId(ref: LegacyFileRef): IdentityMappingResult {
  if (ref.table === "s3_objects") {
    return {
      legacy: ref,
      mappedId: fixtureId("static_file", ref.n),
      entityType: "static_file",
      role: "blob",
      fields: ["blob_key"],
      wrote: false,
    };
  }
  return {
    legacy: ref,
    mappedId: fixtureId("static_file", ref.n),
    entityType: "static_file",
    role: "metadata",
    fields: FILE_METADATA_FIELDS,
    wrote: false,
  };
}

export function dryRunIdentityMapping(refs: readonly LegacyFileRef[]): IdentityMappingResult[] {
  return refs.map(mapLegacyFileId);
}
