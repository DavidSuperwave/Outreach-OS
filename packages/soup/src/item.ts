import type { EntityType } from "registry";

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
  body: string;
  updatedAt: number;
  createdAt: number;
  version: number;
  facet: import("registry").DocumentFacet | null;
  projectId: string | null;
  unread: boolean;
  done: boolean;
  tombstoned: boolean;
  /** Task property bundle on the document row (OD-7). Optional on other types. */
  status?: string | null;
  priority?: string | null;
}

export function soupItemType(type: EntityType): SoupItemType | null {
  return (SOUP_ITEM_TYPES as readonly string[]).includes(type) ? (type as SoupItemType) : null;
}

export function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

export function payloadBool(payload: Record<string, unknown>, key: string): boolean | undefined {
  const value = payload[key];
  return typeof value === "boolean" ? value : undefined;
}

export function payloadNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}
