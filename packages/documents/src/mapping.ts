import { fixtureId } from "registry";

/**
 * OD-1 Branch A migration fixture: identity-mapping dry run.
 * Never writes authorities. Postgres numeric rows map onto typed ids.
 */
export type LegacyDocumentTable = "documents" | "projects" | "document_instance";

export interface LegacyDocumentRef {
  table: LegacyDocumentTable;
  pgId: number;
}

export interface IdentityMappingResult {
  legacy: LegacyDocumentRef;
  mappedId: string;
  entityType: "document" | "project";
  /** Project = Folder. Instances are sub-records of the document aggregate. */
  role: "document" | "folder" | "version";
  wrote: false;
}

export function mapLegacyDocumentId(ref: LegacyDocumentRef): IdentityMappingResult {
  if (ref.table === "projects") {
    return {
      legacy: ref,
      mappedId: fixtureId("project", ref.pgId),
      entityType: "project",
      role: "folder",
      wrote: false,
    };
  }
  if (ref.table === "document_instance") {
    return {
      legacy: ref,
      mappedId: fixtureId("document", ref.pgId),
      entityType: "document",
      role: "version",
      wrote: false,
    };
  }
  return {
    legacy: ref,
    mappedId: fixtureId("document", ref.pgId),
    entityType: "document",
    role: "document",
    wrote: false,
  };
}

export function dryRunIdentityMapping(refs: readonly LegacyDocumentRef[]): IdentityMappingResult[] {
  return refs.map(mapLegacyDocumentId);
}
