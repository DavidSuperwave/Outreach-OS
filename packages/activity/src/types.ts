/**
 * Source leftover: the only recents HTTP path was `GET /recents/deleted`.
 * Visible "recents" IS frecency — this package does not serve a second
 * recents engine. Trash restore lives on DocumentsApi (N7), not here.
 */
export const RECENTS_DELETED_HTTP = "/recents/deleted" as const;

export const MS_PER_HOUR = 3_600_000;

/** OD-21 / J11 frozen frecency constants. Changing a weight is a parity break. */
export const FREQUENCY_PERCENT = 0.7;
export const RECENCY_PERCENT = 0.3;
export const RECENCY_DECAY_RATE = 0.1;
export const MAX_RECENT_EVENTS = 10;

export interface ActivityView {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  occurredAt: number;
}

export interface RecentsView {
  entityId: string;
  entityType: string;
  score: number;
  frequency: number;
  recency: number;
  lastOccurredAt: number;
  eventCount: number;
}

export interface FavoriteView {
  entityId: string;
  entityType: string;
  title: string;
  sortOrder: number;
}
