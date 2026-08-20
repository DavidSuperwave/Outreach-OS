import type { DocumentFacet, EntityType } from "registry";

/**
 * Soup has no Task item type (OD-7). Tasks ride Document with a subtype marker.
 * Harvested SoupItem variants used by the N4 freeze (slice-sufficient).
 */
export const SOUP_ITEM_TYPES = [
  "document",
  "project",
  "email_thread",
  "chat",
  "channel",
  "call",
  "calendar_event",
  "crm_company",
  "foreign_entity",
  "reminder",
] as const;

export type SoupItemType = (typeof SOUP_ITEM_TYPES)[number];

export interface SoupItem {
  entityType: SoupItemType;
  entityId: string;
  tenantId: string;
  title: string;
  updatedAt: number;
  version: number;
  facet: DocumentFacet | null;
  tombstoned: boolean;
}

export function soupItemType(type: EntityType): SoupItemType | null {
  return (SOUP_ITEM_TYPES as readonly string[]).includes(type) ? (type as SoupItemType) : null;
}
