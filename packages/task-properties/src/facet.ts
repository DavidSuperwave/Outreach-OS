import type { DocumentFacet, EntityType, PropertyEntityType } from "registry";
import { PROPERTY_TYPE_MAP } from "registry";

/**
 * Properties-domain storage discriminator (OD-7). Tasks stay Document at every
 * public/access boundary; TASK is resolved from the document facet here.
 */
export function resolveStorageType(
  entityType: EntityType,
  facet: DocumentFacet | null | undefined,
): PropertyEntityType {
  if (entityType === "document" && facet === "task") return "TASK";
  if (entityType === "email_thread") return "THREAD";
  if (entityType === "crm_company") return "COMPANY";
  if (entityType === "call") return "CALL_RECORD";
  if (entityType === "calendar_event") return "CALENDAR_EVENT";
  if (entityType === "channel") return "CHANNEL";
  if (entityType === "chat") return "CHAT";
  if (entityType === "project") return "PROJECT";
  if (entityType === "user") return "USER";
  return "DOCUMENT";
}

export function accessTypeForStorage(storage: PropertyEntityType): EntityType {
  const mapped = PROPERTY_TYPE_MAP[storage];
  return mapped.kind === "facet" ? mapped.type : mapped.type;
}

export function isTaskOnly(applicable: readonly PropertyEntityType[]): boolean {
  return applicable.length === 1 && applicable[0] === "TASK";
}
