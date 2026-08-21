import type { ActivityFact } from "control-plane";
import {
  FREQUENCY_PERCENT,
  MAX_RECENT_EVENTS,
  MS_PER_HOUR,
  RECENCY_DECAY_RATE,
  RECENCY_PERCENT,
  type RecentsView,
} from "./types.js";

export { FREQUENCY_PERCENT, RECENCY_PERCENT, RECENCY_DECAY_RATE, MAX_RECENT_EVENTS };

export interface FrecencyScore extends RecentsView {}

export function hoursSince(lastOccurredAt: number, now: number): number {
  return (now - lastOccurredAt) / MS_PER_HOUR;
}

/** `exp(-0.1 * hoursSinceLast)` — 0.1/hour decay, computed lazily at read. */
export function recencyValue(hoursSinceLast: number): number {
  return Math.exp(-RECENCY_DECAY_RATE * hoursSinceLast);
}

/** `count(last 10 involving entity) / 10`. */
export function frequencyValue(eventCount: number): number {
  return Math.min(eventCount, MAX_RECENT_EVENTS) / MAX_RECENT_EVENTS;
}

export function combineScore(frequency: number, recency: number): number {
  return FREQUENCY_PERCENT * frequency + RECENCY_PERCENT * recency;
}

function lastEventsForEntity(facts: readonly ActivityFact[]): ActivityFact[] {
  return [...facts].sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id)).slice(0, MAX_RECENT_EVENTS);
}

/** Score one (user, entity) pair from its last-10 events. No cron decay job. */
export function scoreEntity(facts: readonly ActivityFact[], now: number): FrecencyScore | null {
  const last10 = lastEventsForEntity(facts);
  const newest = last10[0];
  if (!newest) return null;
  const frequency = frequencyValue(last10.length);
  const recency = recencyValue(hoursSince(newest.occurredAt, now));
  return {
    entityId: newest.entityId,
    entityType: newest.entityType,
    frequency,
    recency,
    score: combineScore(frequency, recency),
    lastOccurredAt: newest.occurredAt,
    eventCount: last10.length,
  };
}

/**
 * Recents = frecency ranking for one actor. Stable sort: score desc, entityId.
 * Same activity stream always yields the same order.
 */
export function rankRecents(facts: readonly ActivityFact[], actorId: string, now: number): FrecencyScore[] {
  const byEntity = new Map<string, ActivityFact[]>();
  for (const fact of facts) {
    if (fact.actorId !== actorId) continue;
    const rows = byEntity.get(fact.entityId) ?? [];
    rows.push(fact);
    byEntity.set(fact.entityId, rows);
  }
  const ranked: FrecencyScore[] = [];
  for (const group of byEntity.values()) {
    const row = scoreEntity(group, now);
    if (row) ranked.push(row);
  }
  ranked.sort((a, b) => b.score - a.score || a.entityId.localeCompare(b.entityId));
  return ranked;
}
