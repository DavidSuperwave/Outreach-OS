import { fixtureId } from "registry";

/**
 * OD-1 Branch A migration fixture: identity-mapping dry run.
 * Never writes authorities. Postgres numeric task ids map onto document typed ids.
 */
export interface LegacyTaskRef {
  table: "tasks";
  pgId: number;
}

export interface IdentityMappingResult {
  legacy: LegacyTaskRef;
  mappedId: string;
  entityType: "document";
  facet: "task";
  wrote: false;
}

export function mapLegacyTaskId(ref: LegacyTaskRef): IdentityMappingResult {
  return {
    legacy: ref,
    mappedId: fixtureId("document", ref.pgId),
    entityType: "document",
    facet: "task",
    wrote: false,
  };
}

export function dryRunIdentityMapping(refs: readonly LegacyTaskRef[]): IdentityMappingResult[] {
  return refs.map(mapLegacyTaskId);
}
