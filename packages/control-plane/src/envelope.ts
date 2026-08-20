import { createHash } from "node:crypto";
import type { EntityType } from "registry";
import type { AccessLevel } from "authz";
import type { Topic } from "./topics.js";

export const ENVELOPE_SCHEMA_VERSION = 1;

/** Receipt context on the envelope — never the branded in-process Receipt (ADR-004). */
export interface ReceiptContext {
  level: AccessLevel;
  entityType: EntityType;
  entityId: string;
  actorId: string;
}

export interface EventEnvelope {
  eventId: string;
  topic: Topic;
  entityType: EntityType;
  entityId: string;
  tenantId: string;
  actorId: string;
  onBehalfOfId: string | null;
  occurredAt: number;
  schemaVersion: number;
  version: number;
  payload: Record<string, unknown>;
  receipt: ReceiptContext | null;
  correlationId: string;
}

export function deterministicEventId(entityType: EntityType, entityId: string, version: number | string): string {
  return createHash("sha256").update(`${entityType}:${entityId}:${version}`).digest("hex");
}

export function envelope(input: Omit<EventEnvelope, "eventId" | "schemaVersion"> & { eventId?: string }): EventEnvelope {
  return {
    ...input,
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    eventId: input.eventId ?? deterministicEventId(input.entityType, input.entityId, input.version),
  };
}
