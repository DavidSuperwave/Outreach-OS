import { fixtureId } from "registry";

/**
 * OD-1 Branch A: identity-mapping dry run. Never writes authorities.
 * Old EAV table shapes are a design reference (semantics kept, storage replaced).
 */
export const PROPERTY_TABLES = [
  "property_definition",
  "property_option",
  "entity_properties",
  "tags",
] as const;

export type LegacyPropertyTable = (typeof PROPERTY_TABLES)[number];

export interface LegacyPropertyRef {
  table: LegacyPropertyTable;
  pgId: number;
}

export interface IdentityMappingResult {
  legacy: LegacyPropertyRef;
  mappedId: string;
  role: "definition" | "option" | "value" | "tag";
  storageHint: "TASK" | "schema";
  wrote: false;
}

export function mapLegacyPropertyId(ref: LegacyPropertyRef): IdentityMappingResult {
  if (ref.table === "property_definition") {
    return {
      legacy: ref,
      mappedId: `pdef_${ref.pgId.toString(16).padStart(32, "0")}`,
      role: "definition",
      storageHint: "schema",
      wrote: false,
    };
  }
  if (ref.table === "property_option") {
    return {
      legacy: ref,
      mappedId: `opt_${ref.pgId.toString(16).padStart(32, "0")}`,
      role: "option",
      storageHint: "schema",
      wrote: false,
    };
  }
  if (ref.table === "tags") {
    return {
      legacy: ref,
      mappedId: `tag_${ref.pgId.toString(16).padStart(32, "0")}`,
      role: "tag",
      storageHint: "schema",
      wrote: false,
    };
  }
  return {
    legacy: ref,
    mappedId: fixtureId("document", ref.pgId),
    role: "value",
    storageHint: "TASK",
    wrote: false,
  };
}

export function dryRunIdentityMapping(refs: readonly LegacyPropertyRef[]): IdentityMappingResult[] {
  return refs.map(mapLegacyPropertyId);
}
