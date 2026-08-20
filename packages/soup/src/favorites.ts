import type { Receipt } from "authz";
import { filterVisible } from "authz";
import type { EntityType } from "registry";

export const MAX_FAVORITES_PER_COLLECTION = 500;

export interface FavoriteRow {
  entityId: string;
  entityType: EntityType;
  sortOrder: number;
}

/** Favorites listing is enforced (SEC-1). Cap 500; fractional sort_order. */
export class FavoritesIndex {
  #rows: FavoriteRow[] = [];

  add(row: FavoriteRow): void {
    if (this.#rows.some((item) => item.entityId === row.entityId)) return;
    if (this.#rows.length >= MAX_FAVORITES_PER_COLLECTION) {
      throw new Error("favorites cap 500");
    }
    this.#rows.push(row);
    this.#rows.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  list(receipts: readonly Receipt[]): FavoriteRow[] {
    return filterVisible(this.#rows, receipts);
  }
}
