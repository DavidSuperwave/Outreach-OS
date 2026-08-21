import type { Receipt } from "authz";
import { filterVisible, readTag } from "authz";
import type { EntityType } from "registry";
import type { SoupIndex } from "./soup-index.js";

export const MAX_FAVORITES_PER_COLLECTION = 500;

export interface FavoriteRow {
  entityId: string;
  entityType: EntityType;
  sortOrder: number;
}

export interface HydratedFavorite extends FavoriteRow {
  title: string;
}

/** Midpoint between two fractional keys; appends after `after` when `before` is omitted. */
export function fractionalBetween(after?: number, before?: number): number {
  if (after === undefined && before === undefined) return 1;
  if (after === undefined) return before! / 2;
  if (before === undefined) return after + 1;
  return (after + before) / 2;
}

/** Favorites listing is enforced (SEC-1). Cap 500; fractional sort_order. */
export class FavoritesIndex {
  readonly surface = "favorites.list" as const;
  #rows: FavoriteRow[] = [];

  constructor() {
    readTag(this.surface);
  }

  add(row: FavoriteRow): void {
    if (this.#rows.some((item) => item.entityId === row.entityId)) return;
    if (this.#rows.length >= MAX_FAVORITES_PER_COLLECTION) {
      throw new Error("favorites cap 500");
    }
    this.#rows.push(row);
    this.#rows.sort((a, b) => a.sortOrder - b.sortOrder || a.entityId.localeCompare(b.entityId));
  }

  insertBetween(row: Omit<FavoriteRow, "sortOrder">, after?: number, before?: number): FavoriteRow {
    const next: FavoriteRow = { ...row, sortOrder: fractionalBetween(after, before) };
    this.add(next);
    return next;
  }

  remove(entityId: string): void {
    this.#rows = this.#rows.filter((row) => row.entityId !== entityId);
  }

  list(receipts: readonly Receipt[]): FavoriteRow[] {
    return filterVisible(this.#rows, receipts);
  }

  /** Hydrate display metadata from the entity-row projection (ADR-006), then recheck access. */
  hydrate(soup: SoupIndex, receipts: readonly Receipt[]): HydratedFavorite[] {
    return this.list(receipts).flatMap((row) => {
      const item = soup.get(row.entityId);
      if (!item || item.tombstoned) return [];
      return [{ ...row, title: item.title }];
    });
  }
}
