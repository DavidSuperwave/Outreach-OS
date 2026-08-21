export interface OperatorAlert {
  id: string;
  kind: "outbox_poison";
  entityId: string;
  reason: string;
  attempts: number;
}

export function operatorAlertsFromPoison(
  rows: readonly {
    envelope: { eventId: string; entityId: string };
    attempts: number;
    poisonReason: string | null;
  }[],
  visibleEntityIds: ReadonlySet<string>,
): OperatorAlert[] {
  return rows
    .filter((row) => visibleEntityIds.has(row.envelope.entityId))
    .map((row) => ({
      id: row.envelope.eventId,
      kind: "outbox_poison" as const,
      entityId: row.envelope.entityId,
      reason: row.poisonReason ?? "poison",
      attempts: row.attempts,
    }));
}
