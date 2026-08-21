import { fixtureId } from "registry";

/**
 * OD-1 Branch A migration fixture: identity-mapping dry run.
 * Never writes authorities. Postgres numeric rows map onto typed ids.
 * CRM re-derives from mail once mail has data — derived rows are not ETL'd.
 */
export const CRM_TABLES = [
  "crm_companies",
  "crm_contacts",
  "email_links",
  "crm_directory",
  "crm_hidden",
] as const;

export type LegacyCrmTable = (typeof CRM_TABLES)[number];

export interface LegacyCrmRef {
  table: LegacyCrmTable;
  pgId: number;
}

export interface IdentityMappingResult {
  legacy: LegacyCrmRef;
  mappedId: string;
  entityType: "crm_company" | "crm_contact";
  role: "company" | "contact" | "email_link" | "directory" | "hidden";
  wrote: false;
}

export function mapLegacyCrmId(ref: LegacyCrmRef): IdentityMappingResult {
  if (ref.table === "crm_companies") {
    return {
      legacy: ref,
      mappedId: fixtureId("crm_company", ref.pgId),
      entityType: "crm_company",
      role: "company",
      wrote: false,
    };
  }
  if (ref.table === "crm_contacts") {
    return {
      legacy: ref,
      mappedId: fixtureId("crm_contact", ref.pgId),
      entityType: "crm_contact",
      role: "contact",
      wrote: false,
    };
  }
  if (ref.table === "email_links") {
    return {
      legacy: ref,
      mappedId: fixtureId("crm_company", ref.pgId),
      entityType: "crm_company",
      role: "email_link",
      wrote: false,
    };
  }
  if (ref.table === "crm_directory") {
    return {
      legacy: ref,
      mappedId: fixtureId("crm_company", ref.pgId),
      entityType: "crm_company",
      role: "directory",
      wrote: false,
    };
  }
  return {
    legacy: ref,
    mappedId: fixtureId("crm_company", ref.pgId),
    entityType: "crm_company",
    role: "hidden",
    wrote: false,
  };
}

export function dryRunIdentityMapping(refs: readonly LegacyCrmRef[]): IdentityMappingResult[] {
  return refs.map(mapLegacyCrmId);
}
