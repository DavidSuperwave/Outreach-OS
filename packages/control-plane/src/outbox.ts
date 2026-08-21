import type { EventEnvelope } from "./envelope.js";
import { ControlPlaneError } from "./context.js";

export type OutboxStatus = "pending" | "published" | "poison";

export interface OutboxRecord {
  envelope: EventEnvelope;
  attempts: number;
  status: OutboxStatus;
  poisonReason: string | null;
}

export interface ProjectionCheckpoint {
  projection: string;
  lastEventId: string;
  lastVersion: number;
  updatedAt: number;
}

const MAX_ATTEMPTS = 5;

/**
 * In-process outbox (ADR-005 3a). Physical DO storage rides domain nodes.
 * Drain publishes pending rows; poison is marked-and-skipped, never dropped.
 */
export class Outbox {
  #rows: OutboxRecord[] = [];
  #checkpoints = new Map<string, ProjectionCheckpoint>();

  append(envelope: EventEnvelope): OutboxRecord {
    const existing = this.#rows.find((row) => row.envelope.eventId === envelope.eventId);
    if (existing) return existing;
    const record: OutboxRecord = { envelope, attempts: 0, status: "pending", poisonReason: null };
    this.#rows.push(record);
    return record;
  }

  pending(): OutboxRecord[] {
    return this.#rows.filter((row) => row.status === "pending");
  }

  poison(): OutboxRecord[] {
    return this.#rows.filter((row) => row.status === "poison");
  }

  all(): readonly OutboxRecord[] {
    return this.#rows;
  }

  /**
   * Drain pending records through `publish`. Duplicate eventIds are no-ops.
   * Failures increment attempts; at MAX_ATTEMPTS the row is poisoned.
   */
  drain(publish: (envelope: EventEnvelope) => void): void {
    for (const row of this.pending()) {
      try {
        publish(row.envelope);
        row.status = "published";
      } catch (error) {
        row.attempts += 1;
        if (row.attempts >= MAX_ATTEMPTS) {
          row.status = "poison";
          row.poisonReason = error instanceof Error ? error.message : "publish failed";
        }
      }
    }
  }

  checkpoint(projection: string, lastEventId: string, lastVersion: number, at = Date.now()): ProjectionCheckpoint {
    const record: ProjectionCheckpoint = { projection, lastEventId, lastVersion, updatedAt: at };
    this.#checkpoints.set(projection, record);
    return record;
  }

  getCheckpoint(projection: string): ProjectionCheckpoint | undefined {
    return this.#checkpoints.get(projection);
  }

  snapshot(): { rows: OutboxRecord[]; checkpoints: ProjectionCheckpoint[] } {
    return {
      rows: this.#rows.map((row) => ({
        envelope: row.envelope,
        attempts: row.attempts,
        status: row.status,
        poisonReason: row.poisonReason,
      })),
      checkpoints: [...this.#checkpoints.values()].map((row) => ({ ...row })),
    };
  }

  restore(snapshot: { rows: readonly OutboxRecord[]; checkpoints: readonly ProjectionCheckpoint[] }): void {
    this.#rows = snapshot.rows.map((row) => ({
      envelope: row.envelope,
      attempts: row.attempts,
      status: row.status,
      poisonReason: row.poisonReason,
    }));
    this.#checkpoints = new Map(snapshot.checkpoints.map((row) => [row.projection, { ...row }]));
  }

  /** Replay non-poison envelopes after `fromEventId` (checkpoint resume). */
  replay(fromEventId?: string): EventEnvelope[] {
    const apply = this.#rows.filter((row) => row.status !== "poison").map((row) => row.envelope);
    if (!fromEventId) return apply;
    const idx = this.#rows.findIndex((row) => row.envelope.eventId === fromEventId);
    if (idx < 0) throw new ControlPlaneError("checkpoint_gap", `unknown checkpoint event ${fromEventId}`);
    const after = new Set(this.#rows.slice(idx + 1).map((row) => row.envelope.eventId));
    return apply.filter((item) => after.has(item.eventId));
  }
}
