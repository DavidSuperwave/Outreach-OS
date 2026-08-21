import { AccessStore, PolicyEngine, requireReceipt, type Receipt } from "authz";
import {
  ACTIVITY_ACTIONS,
  ActivityLog,
  type ActivityAction,
  type ActivityFact,
} from "control-plane";
import type { ActorContext } from "identity/principal";
import { EntityRegistry, type EntityType } from "registry";
import {
  FavoritesIndex,
  MAX_FAVORITES_PER_COLLECTION,
  SoupIndex,
  fractionalBetween,
  type FavoriteRow,
  type HydratedFavorite,
} from "soup";
import { ActivityError } from "./errors.js";
import { rankRecents, scoreEntity, type FrecencyScore } from "./frecency.js";
import { activityFactId } from "./ids.js";
import type { ActivityView } from "./types.js";

export interface ActivityInput {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  tenantId: string;
  occurredAt?: number;
}

export interface ActivityApi {
  record(input: ActivityInput): ActivityFact | null;
  myActivity(actorId: string): ActivityView[];
  entityActivity(entityId: string, viewReceipt: Receipt): ActivityView[];
  recents(actorId: string): FrecencyScore[];
  score(actorId: string, entityId: string): FrecencyScore | null;
  addFavorite(row: Omit<FavoriteRow, "sortOrder"> & { sortOrder?: number }, viewReceipt: Receipt): FavoriteRow;
  removeFavorite(entityId: string): void;
  reorderFavorite(
    row: Omit<FavoriteRow, "sortOrder">,
    viewReceipt: Receipt,
    after?: number,
    before?: number,
  ): FavoriteRow;
  listFavorites(receipts: readonly Receipt[]): FavoriteRow[];
  hydrateFavorites(receipts: readonly Receipt[]): HydratedFavorite[];
}

function isActivityAction(value: string): value is ActivityAction {
  return (ACTIVITY_ACTIONS as readonly string[]).includes(value);
}

function toView(fact: ActivityFact): ActivityView {
  return {
    id: fact.id,
    action: fact.action,
    entityType: fact.entityType,
    entityId: fact.entityId,
    actorId: fact.actorId,
    occurredAt: fact.occurredAt,
  };
}

function newestFirst(a: ActivityFact, b: ActivityFact): number {
  return b.occurredAt - a.occurredAt || a.id.localeCompare(b.id);
}

/**
 * Append-only activity facts + lazy frecency + soup-backed favorites.
 * Activity rides the N3 fact log, not a bus topic. Query never mints.
 * OD-19: no retention/deletion job.
 */
export class ActivitySlice {
  readonly registry = new EntityRegistry();
  readonly access = new AccessStore();
  readonly engine = new PolicyEngine(this.registry, this.access);
  readonly activity = new ActivityLog();
  readonly soup = new SoupIndex();
  readonly favorites = new FavoritesIndex();
  poisonCount = 0;
  #now: number;
  #favoriteMaxSort = 0;

  constructor(now = 0) {
    this.#now = now;
  }

  setNow(now: number): void {
    this.#now = now;
  }

  now(): number {
    return this.#now;
  }

  openApi(): ActivityApi {
    return {
      record: (input) => this.record(input),
      myActivity: (actorId) => this.myActivity(actorId),
      entityActivity: (entityId, viewReceipt) => this.entityActivity(entityId, viewReceipt),
      recents: (actorId) => this.recents(actorId),
      score: (actorId, entityId) => this.score(actorId, entityId),
      addFavorite: (row, viewReceipt) => this.addFavorite(row, viewReceipt),
      removeFavorite: (entityId) => this.removeFavorite(entityId),
      reorderFavorite: (row, viewReceipt, after, before) => this.reorderFavorite(row, viewReceipt, after, before),
      listFavorites: (receipts) => this.listFavorites(receipts),
      hydrateFavorites: (receipts) => this.hydrateFavorites(receipts),
    };
  }

  /**
   * Closed 10-action vocabulary. Unknown actions are poison (counter++, skip).
   * Ids are uuidv5 over (action, entityType, entityId, actorId, occurredAt).
   * Replay of the same tuple is a no-op via ActivityLog append-by-id.
   */
  record(input: ActivityInput): ActivityFact | null {
    if (!isActivityAction(input.action)) {
      this.poisonCount += 1;
      return null;
    }
    const occurredAt = input.occurredAt ?? this.#now;
    const fact: ActivityFact = {
      id: activityFactId({
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actorId,
        occurredAt,
      }),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId,
      tenantId: input.tenantId,
      occurredAt,
    };
    this.activity.append(fact);
    return fact;
  }

  /** Self-scoped keyset. Does not mint receipts. */
  myActivity(actorId: string): ActivityView[] {
    return this.activity
      .list()
      .filter((fact) => fact.actorId === actorId)
      .slice()
      .sort(newestFirst)
      .map(toView);
  }

  /** Entity-scoped keyset. Requires a View receipt; never mints. */
  entityActivity(entityId: string, viewReceipt: Receipt): ActivityView[] {
    if (!viewReceipt) throw new ActivityError("missing_receipt", "entityActivity requires a view receipt");
    requireReceipt(viewReceipt, "view", entityId);
    return this.activity
      .list()
      .filter((fact) => fact.entityId === entityId)
      .slice()
      .sort(newestFirst)
      .map(toView);
  }

  /** Recents = frecency ranking for a user. Stable sort: score desc, entityId. */
  recents(actorId: string): FrecencyScore[] {
    return rankRecents(this.activity.list(), actorId, this.#now);
  }

  score(actorId: string, entityId: string): FrecencyScore | null {
    const facts = this.activity.list().filter((fact) => fact.actorId === actorId && fact.entityId === entityId);
    return scoreEntity(facts, this.#now);
  }

  /** Add requires a View receipt. Favorites emit no activity facts and no outbox events. */
  addFavorite(row: Omit<FavoriteRow, "sortOrder"> & { sortOrder?: number }, viewReceipt: Receipt): FavoriteRow {
    if (!viewReceipt) throw new ActivityError("missing_receipt", "addFavorite requires a view receipt");
    requireReceipt(viewReceipt, "view", row.entityId);
    try {
      if (row.sortOrder !== undefined) {
        const next: FavoriteRow = { entityId: row.entityId, entityType: row.entityType, sortOrder: row.sortOrder };
        this.favorites.add(next);
        this.#favoriteMaxSort = Math.max(this.#favoriteMaxSort, next.sortOrder);
        return next;
      }
      const after = this.#favoriteMaxSort > 0 ? this.#favoriteMaxSort : undefined;
      const next = this.favorites.insertBetween({ entityId: row.entityId, entityType: row.entityType }, after);
      this.#favoriteMaxSort = Math.max(this.#favoriteMaxSort, next.sortOrder);
      return next;
    } catch (error) {
      if (error instanceof Error && error.message.includes("cap 500")) {
        throw new ActivityError("cap", error.message);
      }
      throw error;
    }
  }

  removeFavorite(entityId: string): void {
    this.favorites.remove(entityId);
  }

  reorderFavorite(
    row: Omit<FavoriteRow, "sortOrder">,
    viewReceipt: Receipt,
    after?: number,
    before?: number,
  ): FavoriteRow {
    if (!viewReceipt) throw new ActivityError("missing_receipt", "reorderFavorite requires a view receipt");
    requireReceipt(viewReceipt, "view", row.entityId);
    this.favorites.remove(row.entityId);
    return this.favorites.insertBetween(row, after, before);
  }

  /** Listing re-checks receipts (SEC-1). */
  listFavorites(receipts: readonly Receipt[]): FavoriteRow[] {
    return this.favorites.list(receipts);
  }

  /** Hydrate titles from SoupIndex, then recheck access. */
  hydrateFavorites(receipts: readonly Receipt[]): HydratedFavorite[] {
    return this.favorites.hydrate(this.soup, receipts);
  }
}

export function actorContext(actor: ActorContext["actor"], kernelUsername = "admin"): ActorContext {
  return { actor, kernelUsername, isDeploymentAdmin: false };
}

export { MAX_FAVORITES_PER_COLLECTION, fractionalBetween };
export type { EntityType };
