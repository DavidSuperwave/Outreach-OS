import type { DocumentFacet } from "registry";
import type { SoupItem, SoupItemType } from "./item.js";

/**
 * Slice-sufficient filter AST (crates/item_filters literals port in 4a).
 * Type, facet, and title-contains are the mixed-list cut.
 */
export type SoupFilter =
  | { kind: "type"; types: readonly SoupItemType[] }
  | { kind: "facet"; facet: DocumentFacet | null }
  | { kind: "title"; contains: string }
  | { kind: "project"; projectId: string | null }
  | { kind: "and"; filters: readonly SoupFilter[] }
  | { kind: "or"; filters: readonly SoupFilter[] };

export type SoupSortField = "updatedAt" | "title" | "createdAt";
export type SoupSortOrder = "asc" | "desc";

export function matchesFilter(item: SoupItem, filter: SoupFilter): boolean {
  switch (filter.kind) {
    case "type":
      return filter.types.includes(item.entityType);
    case "facet":
      return item.facet === filter.facet;
    case "title":
      return item.title.toLowerCase().includes(filter.contains.toLowerCase());
    case "project":
      return item.projectId === filter.projectId;
    case "and":
      return filter.filters.every((next) => matchesFilter(item, next));
    case "or":
      return filter.filters.some((next) => matchesFilter(item, next));
  }
}

export function compareItems(a: SoupItem, b: SoupItem, field: SoupSortField, order: SoupSortOrder): number {
  const dir = order === "asc" ? 1 : -1;
  let cmp = 0;
  if (field === "title") cmp = a.title.localeCompare(b.title);
  else if (field === "createdAt") cmp = a.createdAt - b.createdAt;
  else cmp = a.updatedAt - b.updatedAt;
  if (cmp !== 0) return cmp * dir;
  return a.entityId.localeCompare(b.entityId);
}
