import type { SoupItem } from "./item.js";

export type SoupGroupBy = "none" | "type" | "facet" | "project";

export interface SoupGroup {
  key: string;
  label: string;
  items: SoupItem[];
  collapsed: boolean;
}

export function groupKey(item: SoupItem, by: SoupGroupBy): string {
  if (by === "type") return item.entityType;
  if (by === "facet") return item.facet ?? "none";
  if (by === "project") return item.projectId ?? "unfiled";
  return "all";
}

export function groupLabel(key: string, by: SoupGroupBy): string {
  if (by === "none") return "All";
  return key;
}

/** Group headers for soup-nav collapse/expand. Collapsed groups omit members from the flat list. */
export function groupItems(
  items: readonly SoupItem[],
  by: SoupGroupBy,
  collapsedKeys: ReadonlySet<string> = new Set(),
): SoupGroup[] {
  if (by === "none") {
    return [{ key: "all", label: "All", items: [...items], collapsed: false }];
  }
  const order: string[] = [];
  const buckets = new Map<string, SoupItem[]>();
  for (const item of items) {
    const key = groupKey(item, by);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }
  return order.map((key) => ({
    key,
    label: groupLabel(key, by),
    items: buckets.get(key) ?? [],
    collapsed: collapsedKeys.has(key),
  }));
}

export function flattenGroups(groups: readonly SoupGroup[]): SoupItem[] {
  return groups.flatMap((group) => (group.collapsed ? [] : group.items));
}

export function toggleCollapsed(collapsed: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(collapsed);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
