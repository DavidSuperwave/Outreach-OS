/** OD-21: closed 10-action activity vocabulary. Renaming a variant is a storage migration. */
export const ACTIVITY_ACTIONS = [
  "created",
  "edited",
  "opened",
  "deleted",
  "messaged",
  "sent",
  "property_changed",
  "participant_added",
  "participant_removed",
  "call_started",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityFact {
  id: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  actorId: string;
  tenantId: string;
  occurredAt: number;
}

/**
 * Activity is a fact log, not a bus topic (corrected E3).
 * N17 owns ranking; N3 freezes the vocabulary and append-only log shape.
 */
export class ActivityLog {
  #facts: ActivityFact[] = [];

  append(fact: ActivityFact): void {
    if (this.#facts.some((row) => row.id === fact.id)) return;
    this.#facts.push(fact);
  }

  list(): readonly ActivityFact[] {
    return this.#facts;
  }
}
