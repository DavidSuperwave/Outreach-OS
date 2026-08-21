import type { EntityType } from "registry";
import { levelSatisfies } from "./levels.js";
import type { Receipt } from "./receipt.js";
import { AuthzError } from "./receipt.js";

export type ReadEnforcement = "enforced" | "unenforced-by-design";

export interface ProjectionRead {
  surface: string;
  enforcement: ReadEnforcement;
  justification: string;
}

/**
 * Read-side enforcement registry (ADR-004 §3). Favorites listing is enforced
 * (SEC-1 fixed, not recreated). Untagged surfaces fail CI.
 */
export const N2_PROJECTION_READS: readonly ProjectionRead[] = [
  {
    surface: "favorites.list",
    enforcement: "enforced",
    justification: "SEC-1: revoked grants must not remain visible on stale list/favorites paths",
  },
  {
    surface: "soup.list",
    enforcement: "enforced",
    justification: "list rows the actor cannot View never render",
  },
  {
    surface: "search.results",
    enforcement: "enforced",
    justification: "search enrichment filters by view receipt / access projection",
  },
  {
    surface: "entity_access_index",
    enforcement: "enforced",
    justification: "N4 projection is a cache of policy outcomes; authority path never reads it",
  },
];

const BY_SURFACE = new Map(N2_PROJECTION_READS.map((row) => [row.surface, row]));

export function readTag(surface: string): ProjectionRead {
  const row = BY_SURFACE.get(surface);
  if (!row) {
    throw new AuthzError("denied", `untagged projection read: ${surface}`);
  }
  return row;
}

export function assertAllReadsTagged(surfaces: readonly string[]): void {
  for (const surface of surfaces) readTag(surface);
}

/** Filter a list by View receipts. Used by favorites.list (SEC-1). */
export function filterVisible<T extends { entityId: string; entityType: EntityType }>(
  rows: readonly T[],
  receipts: readonly Receipt[],
): T[] {
  const allowed = new Set(
    receipts.filter((receipt) => levelSatisfies(receipt.level, "view")).map((receipt) => receipt.entityId),
  );
  return rows.filter((row) => allowed.has(row.entityId));
}
